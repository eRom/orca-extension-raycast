import { Action, ActionPanel, Detail, Icon, Keyboard, Toast, showToast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { type Bot, extractSessionId, launchArgs } from "../lib/bots";
import { type Conversation, isAnswered, latestError, latestReply, parseConversation } from "../lib/conversation";
import { quote } from "../lib/markdown";
import { OrcaCliError, runOrca } from "../lib/orca-cli";
import { getOrcaPath } from "../lib/preferences";

const POLL_INTERVAL_MS = 1_500;
const MAX_WAIT_MS = 10 * 60 * 1_000;
/** Échecs de lecture consécutifs tolérés avant d'abandonner (un hoquet de la CLI ne doit pas tuer l'attente). */
const MAX_READ_FAILURES = 3;

type Phase = "waiting" | "answered" | "ended" | "terminal" | "timeout" | "error";

type Props = {
  bot: Bot;
  prompt: string;
  /** Ouvre un nouveau formulaire pour le même bot. Sans ce rappel, l'action n'est pas proposée. */
  onAskAgain?: () => void;
};

/**
 * Lance le prompt sans jamais mettre Orca au premier plan (pas de --focus) et renvoie l'ID de session.
 * `null` : le lancement a réussi mais sans session de chat lisible (repli terminal).
 */
async function launchPrompt(bot: Bot, prompt: string): Promise<string | null> {
  return extractSessionId(await runOrca<unknown>(launchArgs(bot, prompt), { orcaPath: getOrcaPath() }));
}

const describeError = (error: unknown): string =>
  error instanceof OrcaCliError
    ? `${error.message} (${error.code})`
    : error instanceof Error
      ? error.message
      : String(error);

export function AnswerView({ bot, prompt, onAskAgain }: Props) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [reply, setReply] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Erreur remontée par le bot lui-même (entrée `error` de la conversation).
  const [botError, setBotError] = useState<string | null>(null);
  // Incrémenté par « Relire la réponse » : rejoue la lecture sur la même session, sans relancer le prompt.
  const [attempt, setAttempt] = useState(0);

  // Une seule sollicitation par montage, même si l'effet est rejoué (double montage React, relecture).
  const launchRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    let readFailures = 0;

    const fail = (title: string, error: unknown) => {
      if (cancelled) return;
      setErrorMessage(describeError(error));
      setPhase("error");
      void showToast({ style: Toast.Style.Failure, title, message: describeError(error) });
    };

    // Lectures enchaînées (jamais deux en vol) : la suivante n'est planifiée qu'une fois la précédente terminée.
    const poll = async (id: string) => {
      let conversation: Conversation;
      try {
        conversation = parseConversation(await runOrca<unknown>(["agent", "read", id], { orcaPath: getOrcaPath() }));
        readFailures = 0;
      } catch (error) {
        if (cancelled) return;
        readFailures += 1;
        if (readFailures >= MAX_READ_FAILURES) {
          fail("Impossible de lire la réponse", error);
          return;
        }
        timer = setTimeout(() => void poll(id), POLL_INTERVAL_MS);
        return;
      }
      if (cancelled) return;

      if (isAnswered(conversation)) {
        setReply(latestReply(conversation));
        setPhase("answered");
        return;
      }
      setBotError(latestError(conversation));
      // Tour terminé sans réponse exploitable : inutile d'attendre davantage.
      if (conversation.state === "done") {
        setPhase("ended");
        return;
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        setPhase("timeout");
        return;
      }
      timer = setTimeout(() => void poll(id), POLL_INTERVAL_MS);
    };

    launchRef.current ??= launchPrompt(bot, prompt);
    launchRef.current.then(
      (id) => {
        if (cancelled) return;
        if (id === null) {
          setPhase("terminal");
          return;
        }
        setSessionId(id);
        void poll(id);
      },
      (error) => fail("Impossible d'envoyer le prompt", error),
    );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  const reread = () => {
    setErrorMessage(null);
    setPhase("waiting");
    setAttempt((current) => current + 1);
  };

  let body: string;
  switch (phase) {
    case "answered":
      body = reply ?? "";
      break;
    case "ended":
      body = botError
        ? `**Erreur**\n\n${quote(botError)}`
        : `*${bot.name} n'a pas répondu. Ouvre ses chats dans Orca pour voir ce qui s'est passé.*`;
      break;
    case "terminal":
      body = `*Le prompt est parti, mais ${bot.name} tourne dans un terminal : sa réponse sera dans Orca.*`;
      break;
    case "timeout":
      body = `*Toujours en cours. La réponse arrivera dans les chats de ${bot.name} dans Orca.*`;
      break;
    case "error":
      body = quote(`Échec : ${errorMessage ?? "erreur inconnue"}`);
      break;
    default:
      body = botError ? `**Erreur**\n\n${quote(botError)}` : `*${bot.name} réfléchit…*`;
  }

  const canReread = sessionId !== null && (phase === "error" || phase === "timeout");

  return (
    <Detail
      navigationTitle={bot.name}
      isLoading={phase === "waiting"}
      markdown={`${quote(prompt)}\n\n${body}`}
      actions={
        <ActionPanel>
          {phase === "answered" && reply !== null && (
            <>
              <Action.CopyToClipboard title="Copier la réponse" content={reply} />
              <Action.Paste title="Coller la réponse" content={reply} />
            </>
          )}
          {canReread && <Action title="Relire la réponse" icon={Icon.ArrowClockwise} onAction={reread} />}
          {sessionId && (
            <Action.CopyToClipboard
              title="Copier l'ID de session"
              content={sessionId}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          )}
          {onAskAgain && (
            <Action
              title={`Nouvelle question à ${bot.name}`}
              icon={Icon.Message}
              shortcut={Keyboard.Shortcut.Common.New}
              onAction={onAskAgain}
            />
          )}
        </ActionPanel>
      }
    />
  );
}
