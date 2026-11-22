const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Durée écoulée depuis `sinceMs`, en français : « depuis quelques s » sous 60 s, puis minutes, heures, jours.
 * Les valeurs sont tronquées (59 min 59 s reste « depuis 59 min »). Un début dans le futur compte comme « maintenant ».
 */
export function formatSince(sinceMs: number, nowMs: number): string {
  const elapsed = Math.max(0, nowMs - sinceMs);
  if (elapsed < MINUTE_MS) {
    return "depuis quelques s";
  }
  if (elapsed < HOUR_MS) {
    return `depuis ${Math.floor(elapsed / MINUTE_MS)} min`;
  }
  if (elapsed < DAY_MS) {
    return `depuis ${Math.floor(elapsed / HOUR_MS)} h`;
  }
  return `depuis ${Math.floor(elapsed / DAY_MS)} j`;
}
