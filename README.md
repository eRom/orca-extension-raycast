# Orca pour Raycast

Pilote Orca depuis Raycast, sans quitter ce que tu fais. L'extension appelle la CLI `orca` : Orca ne passe jamais au premier plan, sauf pour « Aller voir », « Ouvrir Orca » et « Lancer Orca ».

## Commandes

- **Demander à un bot** : choisis un bot Orca, écris-lui un prompt et lis sa réponse directement dans Raycast. Chaque question ouvre un nouveau chat du bot.
- **Demander au bot par défaut** : tape ta question directement dans la barre Raycast, la réponse du bot par défaut s'affiche. Sans bot par défaut, tu choisis le bot et la question part aussitôt.
- **Agents ouverts** : la liste de tes agents Orca, rangés en « Attend ta réponse », « En cours » et « Terminés », rafraîchie toutes les 5 secondes. Tu peux lire la conversation d'un agent, aller voir son terminal, ou copier son ID de session.

## Installation locale

```sh
bun install
bun run dev
```

`bun run dev` lance `ray develop` : l'extension apparaît dans Raycast tant que la commande tourne. Il faut Raycast et Orca installés sur ce Mac.

## Préférences

- **Chemin de la CLI Orca** : laisse vide pour utiliser la CLI embarquée (`/Applications/Orca.app/Contents/Resources/bin/orca`). Renseigne-la seulement si ta CLI est ailleurs.
- **Bot par défaut** : le dossier d'un bot dans `~/.orca/bots` (par exemple `~/.orca/bots/leglaude`). L'extension lit son `bot.json` (id, nom, agent). Ce bot apparaît en tête avec le tag « Par défaut ». Un bot en pause n'est pas détecté avant l'envoi : c'est Orca qui refuse la question.

## Limites connues

- Un chat de bot ne s'ouvre pas dans Orca depuis la CLI : « Aller voir » ne concerne que les agents en terminal. Pour un chat, l'extension propose de lire la conversation ou d'ouvrir Orca.
- Chaque question à un bot crée un nouveau chat : il n'y a pas de suite de conversation.
- Le cas « Orca fermé » (message « Orca n'est pas lancé » et action « Lancer Orca ») n'est pas encore validé en conditions réelles.

## Outillage

Le projet utilise bun en local. Le Store Raycast exige npm et un `package-lock.json` (doc « Prepare an Extension for Store ») : la publication sur le Store est donc hors v1.
