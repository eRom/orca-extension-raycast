# Extension Raycast pour Orca : spec v1

Statut : proposée, 22/11/2026. Source : passation de la session `orca` (sondes du 22/11) et sondes complémentaires de cette session.

## Intention

Piloter Orca depuis Raycast sans jamais le faire passer au premier plan, sauf quand Romain demande explicitement à « aller voir ». Deux commandes en v1 :

1. **Demander à un bot** : choisir un bot, taper un prompt, lire la réponse dans Raycast.
2. **Agents ouverts** : voir d'un coup d'œil ce que font tous les agents, lire leur dernier message, sauter dans Orca sur celui qui m'intéresse.

## Faits sondés (shell nu `env -i HOME PATH`, comme Raycast)

| Besoin | Commande | Champs utiles |
|---|---|---|
| Binaire | `/Applications/Orca.app/Contents/Resources/bin/orca` | absent du PATH de Raycast |
| Orca lancé ? | `orca status --json` | `result.app.running`, `result.runtime.reachable` |
| Bots | `orca bot list --json` | `result.bots[]` : `id`, `name`, `agent`, `specialty`, `paused` ; dossier réel via `~/.orca/bots/*/bot.json` |
| Prompt à un bot | `orca agent launch --agent <bot.agent> --worktree "path:~/.orca/bots/<dossier>" --surface chat --prompt … --json` | `result.outcome.sessionId` ; pas de focus sans `--focus` |
| Lire une réponse | `orca agent read <sessionId> --json` | `result.state` (`done` à la fin), `result.entries[]` (`role`, `text`) |
| Agents ouverts | `orca worktree ps --json` | `result.worktrees[]` : `displayName`, `repo`, `workspaceKind`, `bot`, `agents[]` : `address`, `orcaSessionId`, `state`, `agentType`, `conversationName`, `prompt`, `lastAssistantMessage`, `stateStartedAt`, `updatedAt` |
| Aller voir un terminal | `orca terminal switch --terminal <address>` | `address` = `term_…` pour un agent en terminal |

Constats qui pèsent sur le design :

- `worktree ps` est la bonne source, pas `agent list` : il porte l'adresse `term_…` nécessaire pour sauter vers l'agent, et le nom du bot.
- Un chat de bot a pour adresse `orca_session_id:…`. **Aucune commande CLI ne sait ouvrir un chat ou un folder workspace dans l'UI** (`worktree activate` refuse les folder workspaces). Pour un chat, « aller voir » se limite donc à lire la conversation dans Raycast et à mettre Orca au premier plan sans cibler le chat.
- `conversationName` vaut parfois du bruit (`<local-command-caveat>…`) : titre de repli obligatoire.
- `agentWait` revient `null` sur tous les agents testés : non utilisé en v1.

## Design

### Commande « Demander à un bot »

- **Liste des bots** : nom, spécialité en sous-titre, icône du harness (claude, antigravity, grok) en accessoire. Le dernier bot utilisé remonte en tête. Un bot en pause reste visible, grisé avec un tag « En pause », et ne peut pas être sollicité.
- **Formulaire** : un seul champ texte multiligne, focus immédiat, `⌘↵` pour envoyer. Le nom du bot dans le titre de navigation.
- **Vue réponse** : Detail Markdown. Pendant l'attente, un état « {bot} réfléchit… » avec l'indicateur de chargement de Raycast ; dès `state = done`, la réponse s'affiche en Markdown rendu, prompt rappelé en tête. Actions : copier la réponse, coller la réponse dans l'app au premier plan, copier l'ID de session, nouvelle question au même bot.
- Polling `agent read` toutes les 1,5 s ; au-delà de 10 min, on arrête et on affiche « toujours en cours, la réponse sera dans les chats du bot ».
- Si Romain ferme Raycast pendant l'attente, le chat continue côté Orca : rien n'est perdu, la réponse reste dans les chats du bot.

### Commande « Agents ouverts »

- **Liste avec panneau de détail**, regroupée en sections par état, dans cet ordre : *Attend ta réponse* (`blocked`, `waiting`), *En cours* (`working`), *Terminés* (`done`). Sections vides masquées.
- **Ligne** : titre de conversation (repli : dernier prompt tronqué, puis « Session sans titre »), sous-titre `repo · workspace` ou `Bot · {nom}`, accessoires : icône du harness, durée dans l'état courant (« depuis 4 min »).
- **Panneau de détail** : dernier prompt et dernier message de l'agent en Markdown, métadonnées (repo, branche/workspace, harness, état, ID de session).
- **Actions** :
  - Agent en terminal : **Aller voir** (action principale) = `terminal switch` puis Orca au premier plan. C'est la seule voie qui met Orca devant.
  - Chat de bot : **Lire la conversation** (action principale) = `agent read` affiché dans Raycast ; action secondaire « Ouvrir Orca » sans ciblage.
  - Pour tous : copier l'ID de session, rafraîchir (`⌘R`).
- Rafraîchissement automatique toutes les 5 s tant que la liste est ouverte, sans clignotement (données en cache affichées d'abord).

### Transverse

- **Orca non lancé** : chaque commande vérifie `orca status` ; si Orca ne tourne pas, un état vide explicite « Orca n'est pas lancé » avec une action « Lancer Orca ». Jamais de lancement silencieux. *Comportement réel non sondé (Orca ne doit pas être fermé tant que des sessions tournent) : à valider plus tard.*
- **Binaire introuvable** : état vide « CLI Orca introuvable » et préférence d'extension pour indiquer un chemin.
- **Erreurs CLI** : `ok: false` dans le JSON → toast d'échec avec `error.code` et message lisible ; jamais d'écran blanc.
- Copie en français, design aligné sur les conventions natives de Raycast (icônes, raccourcis standards, pas de couleurs ad hoc hors tags d'état).

## Hors v1

Lancer une tâche (`worktree create --agent`), recherche plein texte (`orca search`), switcher de worktree, automations, répondre dans un chat existant, ouvrir un chat précis dans l'UI (pas de commande CLI).

## Outillage

TypeScript, API Raycast (`@raycast/api`, `@raycast/utils`). Hypothèse à confirmer au scaffold : le dépôt du Store Raycast exige un `package-lock.json` (CI en `npm ci`), donc npm serait requis pour les installations si on vise le Store ; sinon bun suffit en local. Décision au moment du scaffold, raison écrite dans le README.

## Critères d'acceptation

Tous joués sur l'extension chargée dans Raycast (`ray develop`), Orca réel, sauf mention.

**AC-1 : la liste des bots est fidèle**
- Comportement : quand j'ouvre « Demander à un bot », alors je vois exactement les bots de `orca bot list`, avec nom, spécialité et harness, et les bots en pause grisés avec le tag « En pause ».
- Vérifié par : comparaison visuelle avec `orca bot list --json`, capture de la liste.

**AC-2 : un prompt obtient sa réponse sans qu'Orca passe devant**
- Comportement : quand j'envoie « Quelle est la couleur du cheval blanc d'Henri IV ? » au bot `test`, alors la réponse s'affiche en Markdown dans Raycast et la fenêtre au premier plan reste celle d'avant pendant tout l'échange.
- Vérifié par : capture de la vue réponse ; `osascript -e 'tell application "System Events" to name of first process whose frontmost is true'` relevé avant et après, identique et différent de `Orca`.

**AC-3 : le chat créé est bien chez le bot**
- Comportement : quand une réponse vient d'être affichée, alors le chat figure dans les chats du bot côté Orca.
- Vérifié par : `orca bot chats --bot test --json` liste un chat avec le `sessionId` affiché par l'action « copier l'ID de session ».

**AC-4 : un bot en pause ne peut pas être sollicité**
- Comportement : quand je sélectionne un bot en pause, alors aucun formulaire ne s'ouvre et un toast explique qu'il est en pause.
- Vérifié par : mettre le bot `test` en pause depuis Orca, tenter, capture du toast, puis le réactiver.

**AC-5 : les agents ouverts sont tous là, au bon endroit**
- Comportement : quand j'ouvre « Agents ouverts », alors chaque agent de `orca worktree ps` apparaît une fois, dans la section de son état, avec un titre lisible (jamais `<local-command-caveat>`).
- Vérifié par : `orca worktree ps --json | jq '[.result.worktrees[].agents[]] | length'` égal au nombre de lignes de la liste ; capture.

**AC-6 : « Aller voir » ouvre le bon terminal**
- Comportement : quand je déclenche « Aller voir » sur un agent en terminal, alors Orca passe au premier plan sur ce terminal précis.
- Vérifié par : à jouer avec Romain présent (ça change son écran) : capture d'Orca après l'action, terminal attendu visible.

**AC-7 : un chat de bot se lit dans Raycast**
- Comportement : quand je déclenche « Lire la conversation » sur un chat de bot, alors ses messages s'affichent dans Raycast et Orca ne passe pas devant.
- Vérifié par : capture + relevé `osascript` du processus au premier plan comme en AC-2.

**AC-8 : la liste suit l'état réel**
- Comportement : quand un agent passe de *En cours* à *Terminé* pendant que la liste est ouverte, alors il change de section en moins de 10 s sans action de ma part.
- Vérifié par : lancer un prompt court à un bot, garder « Agents ouverts » ouvert, chronométrer le changement de section.

**AC-9 : une erreur CLI s'affiche proprement**
- Comportement : quand la CLI renvoie `ok: false` ou que le binaire est introuvable, alors l'extension affiche un état ou un toast lisible, jamais un écran vide ni une trace brute.
- Vérifié par : préférence de chemin pointée vers un fichier inexistant → état « CLI Orca introuvable » (capture) ; test unitaire du parseur sur une réponse `ok: false` réelle capturée (`agent show 7 --json` → `agent_invalid_id`).

**AC-10 : Orca non lancé (différé)**
- Comportement : quand Orca n'est pas lancé, alors chaque commande affiche « Orca n'est pas lancé » avec l'action « Lancer Orca », sans lancer Orca d'elle-même.
- Vérifié par : à jouer avec Orca fermé, quand aucune session ne tourne. Tant qu'il n'est pas joué, la v1 est livrée avec ce critère déclaré non vérifié.
