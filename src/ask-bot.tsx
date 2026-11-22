import {
  Action,
  ActionPanel,
  Color,
  Form,
  Icon,
  LocalStorage,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useForm, usePromise } from "@raycast/utils";
import { useRef } from "react";
import { AnswerView } from "./components/AnswerView";
import { OrcaGuard } from "./components/OrcaGuard";
import { type Bot, parseBotList, readBotFolders, readBotFromFolder, sortBots } from "./lib/bots";
import { runOrca } from "./lib/orca-cli";
import { getDefaultBotFolder, getOrcaPath } from "./lib/preferences";

const LAST_BOT_KEY = "lastBotId";

async function loadBots(): Promise<Bot[]> {
  const result = await runOrca<unknown>(["bot", "list"], { orcaPath: getOrcaPath() });
  // Le dernier bot utilisé n'est qu'un confort : un stockage local en panne ne bloque pas la liste.
  let lastUsedId: string | undefined;
  try {
    lastUsedId = await LocalStorage.getItem<string>(LAST_BOT_KEY);
  } catch {
    lastUsedId = undefined;
  }
  return sortBots(parseBotList(result, readBotFolders()), lastUsedId, defaultBotId());
}

/** Id du bot par défaut des préférences, s'il pointe vers un dossier de bot valide. */
function defaultBotId(): string | undefined {
  const folder = getDefaultBotFolder();
  return folder ? (readBotFromFolder(folder)?.id ?? undefined) : undefined;
}

export function PromptForm({ bot }: { bot: Bot }) {
  const { push } = useNavigation();
  // Garde contre le double envoi : deux validations rapprochées lanceraient deux fois le prompt.
  const isSubmitting = useRef(false);

  const { handleSubmit, itemProps } = useForm<{ prompt: string }>({
    onSubmit: async ({ prompt }) => {
      if (isSubmitting.current) {
        return;
      }
      isSubmitting.current = true;
      try {
        try {
          await LocalStorage.setItem(LAST_BOT_KEY, bot.id);
        } catch {
          // Mémoriser le dernier bot est facultatif : on envoie le prompt quand même.
        }
        push(<AnswerView bot={bot} prompt={prompt} onAskAgain={() => push(<PromptForm bot={bot} />)} />);
      } finally {
        isSubmitting.current = false;
      }
    },
    validation: {
      prompt: (value) => (value?.trim() ? undefined : "Écris un prompt pour ce bot."),
    },
  });

  return (
    <Form
      navigationTitle={bot.name}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Envoyer" icon={Icon.Message} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea title="Prompt" placeholder={`Écris à ${bot.name}…`} autoFocus {...itemProps.prompt} />
    </Form>
  );
}

/** Liste des bots. Avec `prompt` (venu de « Demander au bot par défaut »), choisir un bot envoie directement ce prompt. */
export function BotList({ prompt }: { prompt?: string } = {}) {
  const { push } = useNavigation();
  const defaultId = defaultBotId();
  const {
    data: bots,
    isLoading,
    error,
  } = usePromise(loadBots, [], {
    // Toast en français à la place de celui, anglais, de Raycast.
    onError: (loadError) =>
      void showToast({
        style: Toast.Style.Failure,
        title: "Impossible de lister les bots",
        message: loadError.message,
      }),
  });

  const writeToBot = (bot: Bot) => {
    if (bot.paused) {
      void showToast({
        style: Toast.Style.Failure,
        title: "Ce bot est en pause",
        message: "Réactive-le dans Orca pour lui écrire.",
      });
      return;
    }
    if (bot.folder === null) {
      void showToast({
        style: Toast.Style.Failure,
        title: "Dossier du bot introuvable",
        message: "Le fichier bot.json de ce bot est introuvable dans ~/.orca/bots.",
      });
      return;
    }
    if (!bot.harness) {
      void showToast({
        style: Toast.Style.Failure,
        title: "Bot mal configuré",
        message: "Ce bot n'a pas d'agent défini dans Orca.",
      });
      return;
    }
    if (prompt) {
      push(<AnswerView bot={bot} prompt={prompt} onAskAgain={() => push(<PromptForm bot={bot} />)} />);
      return;
    }
    push(<PromptForm bot={bot} />);
  };

  return (
    <List
      isLoading={isLoading}
      navigationTitle={prompt ? "Choisir un bot" : undefined}
      searchBarPlaceholder={prompt ? "À quel bot poser ta question ?" : "Chercher un bot"}
    >
      {error ? (
        <List.EmptyView icon={Icon.Warning} title="Impossible de lister les bots" description={error.message} />
      ) : bots !== undefined && bots.length === 0 ? (
        // Vue vide personnalisée seulement si Orca n'a vraiment aucun bot : sinon, la vue vide de Raycast couvre « recherche sans résultat ».
        <List.EmptyView
          icon={Icon.Person}
          title="Aucun bot"
          description="Crée un bot dans Orca pour pouvoir lui écrire."
        />
      ) : null}
      {(bots ?? []).map((bot) => (
        <List.Item
          key={bot.id}
          title={bot.name}
          subtitle={bot.specialty}
          icon={bot.paused ? { source: Icon.Pause, tintColor: Color.SecondaryText } : Icon.Person}
          accessories={[
            ...(bot.id === defaultId ? [{ tag: { value: "Par défaut", color: Color.Blue } }] : []),
            ...(bot.harness ? [{ tag: bot.harness }] : []),
            ...(bot.paused ? [{ tag: "En pause" }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action
                title={prompt ? "Envoyer la question" : "Écrire au bot"}
                icon={Icon.Message}
                onAction={() => writeToBot(bot)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function Command() {
  return (
    <OrcaGuard>
      <BotList />
    </OrcaGuard>
  );
}
