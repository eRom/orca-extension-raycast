import {
  Action,
  ActionPanel,
  Color,
  Icon,
  Keyboard,
  List,
  Toast,
  closeMainWindow,
  open,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect } from "react";
import { ConversationView } from "./components/ConversationView";
import { ORCA_APP_PATH, OrcaGuard } from "./components/OrcaGuard";
import { type AgentSection, type OpenAgent, groupBySection, parseOpenAgents } from "./lib/agents";
import { runOrca } from "./lib/orca-cli";
import { getOrcaPath } from "./lib/preferences";
import { formatSince } from "./lib/time";

const REFRESH_INTERVAL_MS = 5_000;

const SECTION_ICONS: Record<AgentSection, { source: Icon; tintColor: Color }> = {
  attention: { source: Icon.ExclamationMark, tintColor: Color.Orange },
  running: { source: Icon.CircleProgress, tintColor: Color.Blue },
  done: { source: Icon.CheckCircle, tintColor: Color.Green },
};

const STATE_LABELS: Record<string, string> = {
  working: "En cours",
  blocked: "Bloqué",
  waiting: "En attente",
  done: "Terminé",
};

async function fetchOpenAgents(): Promise<OpenAgent[]> {
  return parseOpenAgents(await runOrca<unknown>(["worktree", "ps"], { orcaPath: getOrcaPath() }));
}

const quote = (text: string): string =>
  text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

/** Markdown du panneau de détail : chaque section n'apparaît que si elle a du contenu. */
function detailMarkdown(agent: OpenAgent): string {
  const sections: string[] = [];
  if (agent.lastPrompt) {
    sections.push(`**Dernière demande**\n\n${quote(agent.lastPrompt)}`);
  }
  if (agent.lastMessage) {
    sections.push(`**Dernier message**\n\n${agent.lastMessage}`);
  }
  return sections.join("\n\n");
}

/** « Aller voir » : cible le terminal, puis met Orca au premier plan. En cas d'échec de la CLI, Orca n'est pas ouvert. */
async function goToTerminal(handle: string): Promise<void> {
  try {
    await runOrca(["terminal", "switch", "--terminal", handle], { orcaPath: getOrcaPath() });
    await open(ORCA_APP_PATH);
    await closeMainWindow();
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Impossible d'ouvrir ce terminal",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function AgentItem({ agent, onRefresh }: { agent: OpenAgent; onRefresh: () => void }) {
  const { push } = useNavigation();

  const readConversation = () =>
    push(<ConversationView sessionId={agent.sessionId} title={agent.title} harness={agent.harness} />);
  const stateLabel = STATE_LABELS[agent.state] ?? (agent.state || "inconnu");
  const since = agent.stateSince === null ? null : formatSince(agent.stateSince, Date.now());
  const handle = agent.terminalHandle;

  return (
    <List.Item
      title={agent.title}
      subtitle={agent.subtitle}
      icon={SECTION_ICONS[agent.section]}
      accessories={[{ tag: agent.harness || "inconnu" }, ...(since === null ? [] : [{ text: since }])]}
      detail={
        <List.Item.Detail
          markdown={detailMarkdown(agent)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Projet" text={agent.repo || "inconnu"} />
              <List.Item.Detail.Metadata.Label title="Workspace" text={agent.workspace || "inconnu"} />
              <List.Item.Detail.Metadata.Label title="Harness" text={agent.harness || "inconnu"} />
              <List.Item.Detail.Metadata.Label
                title="État"
                text={since === null ? stateLabel : `${stateLabel} · ${since}`}
              />
              <List.Item.Detail.Metadata.Label title="ID de session" text={agent.sessionId} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          {handle !== null ? (
            <>
              <Action title="Aller voir" icon={Icon.Terminal} onAction={() => goToTerminal(handle)} />
              <Action title="Lire la conversation" icon={Icon.Message} onAction={readConversation} />
            </>
          ) : (
            <>
              <Action title="Lire la conversation" icon={Icon.Message} onAction={readConversation} />
              <Action title="Ouvrir Orca" icon={Icon.AppWindow} onAction={() => open(ORCA_APP_PATH)} />
            </>
          )}
          <Action.CopyToClipboard
            title="Copier l'ID de session"
            content={agent.sessionId}
            shortcut={Keyboard.Shortcut.Common.Copy}
          />
          <Action
            title="Rafraîchir"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
    />
  );
}

function AgentList() {
  const {
    data: agents,
    isLoading,
    error,
    revalidate,
  } = useCachedPromise(fetchOpenAgents, [], {
    // Toast en français à la place de celui, anglais, de Raycast.
    onError: (listError) =>
      void showToast({
        style: Toast.Style.Failure,
        title: "Impossible de lister les agents",
        message: listError.message,
      }),
  });

  // Rafraîchissement périodique ; les données en cache restent affichées pendant la relecture, donc pas de clignotement.
  useEffect(() => {
    const timer = setInterval(() => revalidate(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [revalidate]);

  return (
    // Chargement visible au premier fetch seulement : sinon la barre clignote à chaque rafraîchissement de 5 s.
    <List isLoading={isLoading && agents === undefined} isShowingDetail searchBarPlaceholder="Chercher un agent">
      {error && agents === undefined ? (
        <List.EmptyView icon={Icon.Warning} title="Impossible de lister les agents" description={error.message} />
      ) : agents !== undefined && agents.length === 0 ? (
        <List.EmptyView
          icon={Icon.Person}
          title="Aucun agent ouvert"
          description="Lance un agent dans Orca pour le voir ici."
        />
      ) : null}
      {groupBySection(agents ?? []).map((group) => (
        <List.Section key={group.section} title={group.title}>
          {group.agents.map((agent) => (
            <AgentItem key={agent.sessionId} agent={agent} onRefresh={revalidate} />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

export default function Command() {
  return (
    <OrcaGuard>
      <AgentList />
    </OrcaGuard>
  );
}
