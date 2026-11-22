import { Action, ActionPanel, Icon, List, open, openExtensionPreferences } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { OrcaCliError, runOrca } from "../lib/orca-cli";
import { getOrcaPath } from "../lib/preferences";
import { parseStatus } from "../lib/status";

export const ORCA_APP_PATH = "/Applications/Orca.app";

/**
 * Vérifie qu'Orca est joignable avant d'afficher la commande.
 * Pendant la vérification, les enfants sont rendus tels quels : leur liste porte son propre `isLoading`.
 */
export function OrcaGuard({ children }: { children: ReactNode }) {
  // `onError` vide : l'état vide affiché plus bas suffit, sans le toast anglais par défaut de Raycast.
  const { data, error } = usePromise(
    async () => parseStatus(await runOrca(["status"], { orcaPath: getOrcaPath() })),
    [],
    { onError: () => {} },
  );

  if (error) {
    if (error instanceof OrcaCliError && error.code === "binary_not_found") {
      return (
        <List>
          <List.EmptyView
            icon={Icon.Warning}
            title="CLI Orca introuvable"
            description="Vérifie le chemin dans les préférences de l'extension."
            actions={
              <ActionPanel>
                <Action title="Ouvrir les préférences" icon={Icon.Gear} onAction={openExtensionPreferences} />
              </ActionPanel>
            }
          />
        </List>
      );
    }
    return (
      <List>
        <List.EmptyView icon={Icon.Warning} title="Orca ne répond pas" description={error.message} />
      </List>
    );
  }

  if (data && !data.running) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Power}
          title="Orca n'est pas lancé"
          description="Lance Orca pour parler à tes bots et voir tes agents."
          actions={
            <ActionPanel>
              <Action title="Lancer Orca" icon={Icon.Play} onAction={() => open(ORCA_APP_PATH)} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return <>{children}</>;
}
