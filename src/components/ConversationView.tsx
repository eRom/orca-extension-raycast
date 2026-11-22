import { Action, ActionPanel, Detail, Icon, Keyboard, Toast, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { type Conversation, parseConversation } from "../lib/conversation";
import { runOrca } from "../lib/orca-cli";
import { getOrcaPath } from "../lib/preferences";

const ENTRY_LIMIT = "50";
const FALLBACK_AUTHOR = "Agent";

type Props = {
  sessionId: string;
  /** Titre de navigation de la vue. */
  title: string;
  /** Nom du harness de l'agent, utilisé comme en-tête de ses messages ; « Agent » s'il est vide ou absent. */
  harness?: string;
};

async function readConversation(sessionId: string): Promise<Conversation> {
  return parseConversation(
    await runOrca<unknown>(["agent", "read", sessionId, "--limit", ENTRY_LIMIT], { orcaPath: getOrcaPath() }),
  );
}

/** Texte de la dernière entrée de l'agent (jamais celle de l'utilisateur), ou null. */
function lastAgentMessage(conversation: Conversation): string | null {
  for (let index = conversation.entries.length - 1; index >= 0; index--) {
    if (conversation.entries[index].role !== "user") {
      return conversation.entries[index].text;
    }
  }
  return null;
}

function toMarkdown(conversation: Conversation, authorName: string): string {
  const blocks = conversation.entries.map(
    (entry) => `**${entry.role === "user" ? "Toi" : authorName}**\n\n${entry.text}`,
  );
  if (conversation.state === "working") {
    blocks.push("*En cours…*");
  }
  return blocks.join("\n\n---\n\n");
}

export function ConversationView({ sessionId, title, harness }: Props) {
  // Le hook annule la mise à jour d'état au démontage : aucune lecture ne touche une vue fermée.
  const { data, isLoading, error, revalidate } = usePromise(readConversation, [sessionId], {
    // Toast en français à la place de celui, anglais, de Raycast.
    onError: (readError) =>
      void showToast({
        style: Toast.Style.Failure,
        title: "Impossible de lire la conversation",
        message: readError.message,
      }),
  });

  const authorName = harness?.trim() ? harness.trim() : FALLBACK_AUTHOR;
  const lastMessage = data ? lastAgentMessage(data) : null;

  let markdown: string;
  if (data) {
    markdown = data.entries.length > 0 || data.state === "working" ? toMarkdown(data, authorName) : "*Aucun message.*";
  } else if (error) {
    markdown = `*Impossible de lire la conversation : ${error.message}*`;
  } else {
    markdown = "";
  }

  return (
    <Detail
      navigationTitle={title}
      isLoading={isLoading}
      markdown={markdown}
      actions={
        <ActionPanel>
          {lastMessage !== null && <Action.CopyToClipboard title="Copier le dernier message" content={lastMessage} />}
          <Action
            title="Rafraîchir"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={revalidate}
          />
        </ActionPanel>
      }
    />
  );
}
