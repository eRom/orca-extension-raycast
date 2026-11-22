export type OrcaStatus = { running: boolean };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/** Orca est joignable quand l'app tourne ET que son runtime répond. */
export function parseStatus(result: unknown): OrcaStatus {
  const root = asRecord(result);
  const appRunning = asRecord(root.app).running === true;
  const runtimeReachable = asRecord(root.runtime).reachable === true;
  return { running: appRunning && runtimeReachable };
}
