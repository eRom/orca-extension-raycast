import { Action, ActionPanel, Icon, List, Toast, open, openExtensionPreferences, showToast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import type { ReactNode } from "react";
import { OrcaCliError, runOrca } from "../lib/orca-cli";
import { getOrcaPath } from "../lib/preferences";
import { isOrcaDown, parseStatus } from "../lib/status";

export const ORCA_APP_PATH = "/Applications/Orca.app";

/** Ouvre Orca au premier plan ; un échec devient un toast français et renvoie false, jamais une exception. */
export async function openOrca(): Promise<boolean> {
  try {
    await open(ORCA_APP_PATH);
    return true;
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Impossible d'ouvrir Orca",
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

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

  // Orca planté (`runtime_unavailable`) revient à « pas lancé » : même copie, même action.
  const notRunning = isOrcaDown(data, error);

  if (error && !notRunning) {
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

  if (notRunning) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Power}
          title="Orca n'est pas lancé"
          description="Lance Orca pour parler à tes bots et voir tes agents."
          actions={
            <ActionPanel>
              <Action title="Lancer Orca" icon={Icon.Play} onAction={openOrca} />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return <>{children}</>;
}
