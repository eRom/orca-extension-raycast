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
import { AnswerView } from "./components/AnswerView";
import { OrcaGuard } from "./components/OrcaGuard";
import { type Bot, parseBotList, readBotFolders, sortBots } from "./lib/bots";
import { runOrca } from "./lib/orca-cli";
import { getOrcaPath } from "./lib/preferences";

const LAST_BOT_KEY = "lastBotId";

async function loadBots(): Promise<Bot[]> {
  const result = await runOrca<unknown>(["bot", "list"], { orcaPath: getOrcaPath() });
  const lastUsedId = await LocalStorage.getItem<string>(LAST_BOT_KEY);
  return sortBots(parseBotList(result, readBotFolders()), lastUsedId);
}

function PromptForm({ bot }: { bot: Bot }) {
  const { push } = useNavigation();

  const { handleSubmit, itemProps } = useForm<{ prompt: string }>({
    onSubmit: async ({ prompt }) => {
      await LocalStorage.setItem(LAST_BOT_KEY, bot.id);
      push(<AnswerView bot={bot} prompt={prompt} onAskAgain={() => push(<PromptForm bot={bot} />)} />);
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

function BotList() {
  const { push } = useNavigation();
  const { data: bots, isLoading, error } = usePromise(loadBots);

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
    push(<PromptForm bot={bot} />);
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Chercher un bot">
      {error ? (
        <List.EmptyView icon={Icon.Warning} title="Impossible de lister les bots" description={error.message} />
      ) : (
        <List.EmptyView
          icon={Icon.Person}
          title="Aucun bot"
          description="Crée un bot dans Orca pour pouvoir lui écrire."
        />
      )}
      {(bots ?? []).map((bot) => (
        <List.Item
          key={bot.id}
          title={bot.name}
          subtitle={bot.specialty}
          icon={bot.paused ? { source: Icon.Pause, tintColor: Color.SecondaryText } : Icon.Person}
          accessories={[...(bot.harness ? [{ tag: bot.harness }] : []), ...(bot.paused ? [{ tag: "En pause" }] : [])]}
          actions={
            <ActionPanel>
              <Action title="Écrire au bot" icon={Icon.Message} onAction={() => writeToBot(bot)} />
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
