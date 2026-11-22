import { getPreferenceValues } from "@raycast/api";
import { resolveOrcaPath } from "./orca-cli";

/** Chemin de la CLI Orca : la préférence `orcaPath` si renseignée, sinon le binaire embarqué dans Orca.app. */
export function getOrcaPath(): string {
  return resolveOrcaPath(getPreferenceValues<{ orcaPath?: string }>().orcaPath);
}
