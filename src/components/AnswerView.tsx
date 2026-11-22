import { Action, ActionPanel, Detail, Icon, Keyboard } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useEffect, useRef, useState } from "react";
import { type Bot, launchArgs } from "../lib/bots";
import { type Conversation, isAnswered, latestReply, parseConversation } from "../lib/conversation";
import { OrcaCliError, runOrca } from "../lib/orca-cli";
import { getOrcaPath } from "../lib/preferences";

const POLL_INTERVAL_MS = 1_500;
const MAX_WAIT_MS = 10 * 60 * 1_000;

type Phase = "waiting" | "answered" | "timeout" | "error";

type Props = {
  bot: Bot;
  prompt: string;
  /** Ouvre un nouveau formulaire pour le même bot. Sans ce rappel, l'action n'est pas proposée. */
  onAskAgain?: () => void;
};

/** `result.outcome.sessionId` de `orca agent launch`, ou une erreur typée si la réponse est inattendue. */
function extractSessionId(result: unknown): string {
  const outcome = (result as { outcome?: { sessionId?: unknown } } | null)?.outcome;
  if (typeof outcome?.sessionId === "string" && outcome.sessionId) {
    return outcome.sessionId;
  }
  throw new OrcaCliError("invalid_output", "Orca n'a pas renvoyé d'identifiant de session pour ce prompt.");
}

/** Lance le prompt sans jamais mettre Orca au premier plan (pas de --focus) et renvoie l'ID de session. */
async function launchPrompt(bot: Bot, prompt: string): Promise<string> {
  return extractSessionId(await runOrca<unknown>(launchArgs(bot, prompt), { orcaPath: getOrcaPath() }));
}

const quote = (text: string): string =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

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

  // Une seule sollicitation par montage, même si l'effet est rejoué (double montage React).
  const launchRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const fail = (title: string, error: unknown) => {
      if (cancelled) return;
      setErrorMessage(describeError(error));
      setPhase("error");
      void showFailureToast(error, { title, message: describeError(error) });
    };

    // Lectures enchaînées (jamais deux en vol) : la suivante n'est planifiée qu'une fois la précédente terminée.
    const poll = async (id: string) => {
      let conversation: Conversation;
      try {
        conversation = parseConversation(await runOrca<unknown>(["agent", "read", id], { orcaPath: getOrcaPath() }));
      } catch (error) {
        fail("Impossible de lire la réponse", error);
        return;
      }
      if (cancelled) return;

      if (isAnswered(conversation)) {
        setReply(latestReply(conversation));
        setPhase("answered");
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
        setSessionId(id);
        void poll(id);
      },
      (error) => fail("Impossible d'envoyer le prompt", error),
    );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  let body: string;
  switch (phase) {
    case "answered":
      body = reply ?? "";
      break;
    case "timeout":
      body = `*Toujours en cours. La réponse arrivera dans les chats de ${bot.name} dans Orca.*`;
      break;
    case "error":
      body = `*Échec : ${errorMessage ?? "erreur inconnue"}*`;
      break;
    default:
      body = `*${bot.name} réfléchit…*`;
  }

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
