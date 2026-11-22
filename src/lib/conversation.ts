/** `unknown` couvre l'absence de `state` et toute valeur non gérée : ce n'est jamais une fin. */
export type TurnState = "done" | "working" | "unknown";

export type Entry = { role: "user" | "assistant" | string; text: string };

export type Conversation = { state: TurnState; entries: Entry[] };

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const asTurnState = (value: unknown): TurnState => (value === "done" || value === "working" ? value : "unknown");

/**
 * Transforme le `result` de `orca agent read` en conversation.
 * Juste après un launch, `state` est absent : « no state means unknown, never done ».
 * Ne garde que les entrées `message` au texte non vide (les appels d'outils sont écartés).
 */
export function parseConversation(result: unknown): Conversation {
  const root = asRecord(result);
  const rawEntries = Array.isArray(root.entries) ? root.entries : [];

  const entries: Entry[] = [];
  for (const raw of rawEntries) {
    const record = asRecord(raw);
    if (record.kind !== "message" || typeof record.text !== "string" || record.text === "") {
      continue;
    }
    entries.push({ role: typeof record.role === "string" ? record.role : "", text: record.text });
  }

  return { state: asTurnState(root.state), entries };
}

/** Texte de la dernière entrée `assistant` placée après la dernière entrée `user`, sinon null. */
export function latestReply(conv: Conversation): string | null {
  for (let index = conv.entries.length - 1; index >= 0; index--) {
    const entry = conv.entries[index];
    if (entry.role === "assistant") {
      return entry.text;
    }
    if (entry.role === "user") {
      return null;
    }
  }
  return null;
}

/** Le bot a répondu quand le tour est terminé ET qu'une réponse suit le dernier message utilisateur. */
export function isAnswered(conv: Conversation): boolean {
  return conv.state === "done" && latestReply(conv) !== null;
}
