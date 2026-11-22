import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { OrcaCliError } from "./orca-cli";

export type Harness = "claude" | "antigravity" | "grok" | string;

export type Bot = {
  id: string;
  name: string;
  harness: Harness;
  specialty: string;
  paused: boolean;
  /** Chemin absolu du dossier du bot, ou null si bot.json est introuvable ou illisible. */
  folder: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * Transforme le `result` de `orca bot list` en bots.
 * `folders` associe un id de bot à son dossier (voir readBotFolders) : un id absent donne `folder: null`.
 */
export function parseBotList(result: unknown, folders: Map<string, string>): Bot[] {
  const rawBots = asRecord(result).bots;
  if (!Array.isArray(rawBots)) {
    return [];
  }

  const bots: Bot[] = [];
  for (const raw of rawBots) {
    const record = asRecord(raw);
    const id = asString(record.id);
    // Sans id, le bot ne peut ni être sollicité ni apparié à son dossier.
    if (!id) {
      continue;
    }
    bots.push({
      id,
      name: asString(record.name) || id,
      harness: asString(record.agent),
      specialty: asString(record.specialty),
      paused: record.paused === true,
      folder: folders.get(id) ?? null,
    });
  }
  return bots;
}

/**
 * Lit le bot.json de chaque sous-dossier de `botsDir` et associe `bot.json.id` au dossier.
 * Un dossier sans bot.json, un JSON invalide ou un id non textuel sont ignorés en silence :
 * le bot concerné restera visible mais sans dossier résolu.
 */
export function readBotFolders(botsDir: string = join(homedir(), ".orca/bots")): Map<string, string> {
  const folders = new Map<string, string>();

  let names: string[];
  try {
    names = readdirSync(botsDir);
  } catch {
    return folders;
  }

  for (const name of names) {
    const folder = join(botsDir, name);
    try {
      const id = asRecord(JSON.parse(readFileSync(join(folder, "bot.json"), "utf8"))).id;
      if (typeof id === "string" && id) {
        folders.set(id, folder);
      }
    } catch {
      // bot.json absent, illisible ou invalide : on passe au suivant.
    }
  }
  return folders;
}

/** Dernier utilisé en tête, puis non pausés avant pausés, puis ordre alphabétique français. */
export function sortBots(bots: Bot[], lastUsedId?: string): Bot[] {
  const rank = (bot: Bot): number => (bot.id === lastUsedId ? 0 : bot.paused ? 2 : 1);
  return [...bots].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "fr"));
}

/**
 * Arguments de `orca agent launch` pour solliciter un bot dans son dossier.
 * Jamais de `--focus` : Orca ne doit pas passer au premier plan.
 * Refuse de deviner un chemin quand le dossier du bot n'est pas résolu.
 */
export function launchArgs(bot: Bot, prompt: string): string[] {
  if (bot.folder === null) {
    throw new OrcaCliError(
      "bot_folder_missing",
      `Dossier introuvable pour le bot ${bot.name} : impossible de le solliciter sans risquer un mauvais chemin.`,
    );
  }
  return [
    "agent",
    "launch",
    "--agent",
    bot.harness,
    "--worktree",
    `path:${bot.folder}`,
    "--surface",
    "chat",
    // Forme `--prompt=<valeur>` en un seul argument : le parseur d'Orca prendrait sinon
    // un prompt commençant par `--` pour un autre flag (« Unknown flag »).
    `--prompt=${prompt}`,
  ];
}
