# Guide de publication d'une extension sur le Raycast Store

Ce document synthétise les exigences officielles de Raycast (`developers.raycast.com` et dépôt `raycast/extensions`), les fichiers obligatoires, les bonnes pratiques de review, ainsi que les écarts identifiés sur l'état actuel de `orca-raycast-extension`.

---

## 1. Arborescence et fichiers obligatoires

Une extension soumise au Raycast Store suit cette structure :

```text
mon-extension/
├── assets/
│   ├── icon.png              # Obligatoire - PNG 512x512 px
│   └── icon@dark.png         # Optionnel - variante Dark Mode (512x512 px)
├── metadata/                 # Recommandé (3 à 6 screenshots) - PNG 2000x1250 px
│   ├── screenshot-1.png
│   ├── screenshot-2.png
│   └── screenshot-3.png
├── src/                      # Code source TypeScript / React
│   └── <command-name>.tsx    # Un fichier par commande déclarée dans package.json
├── CHANGELOG.md              # Obligatoire - historique de versions avec {PR_MERGE_DATE}
├── README.md                 # Requis si setup externe, préférences ou app tierce
├── package.json              # Obligatoire - manifeste Raycast + dépendances npm
├── package-lock.json         # Obligatoire - généré via npm (pas bun/yarn/pnpm)
├── tsconfig.json             # Obligatoire
├── eslint.config.js          # Recommandé - basé sur @raycast/eslint-config
├── .prettierrc               # Recommandé - formatage Prettier
└── .gitignore                # Doit exclure node_modules/, dist/, raycast-env.d.ts
```

### Détails sur les fichiers clés

- **`package-lock.json` (obligatoire)** : la CI de `raycast/extensions` utilise `npm` pour installer et builder les extensions. Les lockfiles `bun.lock`, `bun.lockb`, `yarn.lock` et `pnpm-lock.yaml` sont ignorés par le `.gitignore` et les scripts du Store.
- **`raycast-env.d.ts` (à ne pas commiter)** : généré automatiquement par Raycast pour typer commandes, préférences et arguments. Il doit être présent dans `.gitignore`, tout en restant inclus dans `tsconfig.json` (`"include": ["src/**/*", "raycast-env.d.ts"]`).
- **`CHANGELOG.md` (obligatoire)** : placé à la racine de l'extension. Chaque entrée utilise un titre H2 (`##`) entre crochets suivi du placeholder `{PR_MERGE_DATE}` (remplacé automatiquement par la CI au moment du merge).

Exemple de `CHANGELOG.md` initial :

```markdown
# Orca Changelog

## [Initial Version] - {PR_MERGE_DATE}
- Add commands to ask Orca bots and monitor open agents.
```

---

## 2. Manifeste `package.json`

Le `package.json` sert de manifeste Raycast. Champs essentiels pour le Store :

| Champ | Statut | Règles Store |
| :--- | :--- | :--- |
| `$schema` | Recommandé | `"https://www.raycast.com/schemas/extension.json"` |
| `name` | Obligatoire | Identifiant unique en `kebab-case` (sert d'URL sur le Store, sans namespace) |
| `title` | Obligatoire | Nom affiché dans le Store (Title Case selon l'Apple Style Guide) |
| `description` | Obligatoire | Résumé clair en **US English** |
| `icon` | Obligatoire | Chemin relatif dans `assets/` (ex. `"icon.png"` ou `"extension-icon.png"`) |
| `author` | Obligatoire | Handle exact de ton compte Raycast Store |
| `contributors` | Optionnel | Tableau de handles Raycast des contributeurs |
| `license` | Obligatoire | Doit être `"MIT"` |
| `platforms` | Recommandé | `["macOS"]` ou `["macOS", "Windows"]` (restreindre si API spécifique à l'OS) |
| `categories` | Obligatoire | Tableau en Title Case, sensible à la casse (voir liste ci-dessous) |
| `keywords` | Optionnel | Mots-clés pour améliorer la recherche dans le Store |
| `access` | Optionnel | `"public"` (Store) ou `"private"` (organisation) |
| `commands` | Obligatoire | Chaque `name` correspond à un fichier dans `src/` |
| `preferences` | Optionnel | Préférences utilisateur (`textfield`, `password`, `directory`, etc.) |
| `tools` | Optionnel | Outils exposés à Raycast AI |
| `dependencies` | Obligatoire | `@raycast/api` à la dernière version |
| `scripts.publish` | Recommandé | `"npx @raycast/api@latest publish"` |

### Valeurs valides pour `categories`

`Applications`, `Communication`, `Data`, `Design Tools`, `Developer Tools`, `Documentation`, `Finance`, `Fun`, `Media`, `News`, `Productivity`, `Security`, `System`, `Web`.

---

## 3. Règles éditoriales, langue et UI (Store Review Guidelines)

### Langue : US English uniquement

- Le Raycast Store **ne supporte pas la localisation** et refuse les systèmes i18n personnalisés.
- **US English obligatoire** (orthographe américaine, pas britannique) pour :
  - `package.json` (`title`, `description`, `commands`, `preferences`, `arguments`)
  - Tous les textes affichés dans l'UI (titres, placeholders, toasts, actions, états vides)
  - `README.md` et `CHANGELOG.md`
  - Les captures d'écran dans `metadata/`

### Conventions de nommage (Apple Style Guide)

- **Title Case** pour les titres d'extension, titres de commandes et titres d'actions (`Ask Bot`, `Open Agents`, `Copy Session ID`).
- **Commandes** : format `<Verb> <Noun>` ou `<Noun>` clair, sans article superflu (`Search Packages` plutôt que `Search a Package` ou `NPM`).
- **Actions avec sous-menu** : terminer le titre par `…` sans répéter le nom de l'action parente dans les sous-items.
- **Icônes d'actions** : si certaines actions d'un `ActionPanel` ont des icônes, en fournir de manière cohérente sur les actions similaires.

### Assets visuels (`assets/` et `metadata/`)

- **Icône d'extension** (`assets/`) : PNG exactement en **512 x 512 px**, lisible en thème clair et sombre (prévoir `@dark.png` si le contraste l'exige). Utiliser un rendu soigné et cohérent avec Raycast (ou l'outil officiel Icon Maker).
- **Screenshots** (`metadata/`) :
  - Format **PNG 2000 x 1250 px**.
  - **3 minimum recommandés, 6 maximum**.
  - Arrière-plan cohérent, aucune donnée personnelle ou sensible visible, aucune fenêtre tierce parasite.
  - Méthode officielle : utiliser la commande intégrée Raycast **Capture Window** avec un raccourci dédié et cocher **Save to Metadata** pendant que l'extension tourne en dev (le badge dev est masqué automatiquement).

---

## 4. Bonnes pratiques techniques et sécurité

- **Gestion d'erreurs gracieuse** : aucune erreur attendue (réseau coupé, CLI absente, app fermée) ne doit provoquer de crash. Utiliser `showToast` (`Toast.Style.Failure`) ou un `Detail` / `EmptyView` explicite avec une action corrective (ouvrir les préférences, lancer l'app, copier la commande d'installation).
- **Données sensibles** : utiliser des préférences `type: "password"` pour tout token/secret, et `LocalStorage` pour les données persistantes (stockage chiffré local isolé par extension).
- **Dépendances externes, binaires et apps locales** :
  - Documenter clairement dans `README.md` tout prérequis (ex. application desktop ou CLI à installer).
  - Interdit d'embarquer des binaires opaques sans sources traçables, ou de télécharger des exécutables depuis un serveur contrôlé par l'auteur. Si un téléchargement runtime est indispensable, il doit pointer vers une source publique tierce de confiance avec vérification de hash.
- **Conformité légale** : respecter les Conditions d'Utilisation (ToS) des services ou APIs tiers appelés.

---

## 5. Checklist et workflow de publication

### Étape 1 : Vérifications locales

Dans le dossier de l'extension (avec `npm` pour valider la parité CI) :

```sh
npm install
npm run lint
npm run build
```

- `npm run build` lance la compilation de production et le type-checking strict.
- Charger le build dans Raycast et tester chaque commande en conditions réelles (y compris cas d'erreur / app absente).

### Étape 2 : Ouvrir la Pull Request sur `raycast/extensions`

**Méthode recommandée (CLI officielle)** :

1. Vérifier que `"publish": "npx @raycast/api@latest publish"` figure dans `scripts` du `package.json`.
2. Exécuter :
   ```sh
   npm run publish
   ```
3. Suivre l'authentification GitHub demandée dans le terminal. La CLI gère le fork, la branche, le squash des commits et ouvre la PR sur `raycast/extensions`.

*(Pour pousser des modifications après des commentaires de review, relancer `npm run publish`, ou exécuter `npx @raycast/api@latest pull-contributions` si des modifications ont été faites directement sur GitHub.)*

**Méthode manuelle (alternative)** :

1. Forker `https://github.com/raycast/extensions`.
2. Copier le dossier de l'extension dans `extensions/<name>/`.
3. Pusher et ouvrir une PR ciblant `main`.

### Étape 3 : Review et mise en ligne

- Les Community Managers reviewent les PR en **FIFO** (premier retour typiquement sous ~1 semaine selon la file).
- Les checks CI GitHub Actions doivent passer (build, lint, schéma manifeste, lockfile, format des assets).
- **Délais d'inactivité** : une PR sans réponse est marquée `stale` après **14 jours** et fermée après **21 jours**.
- Dès que la PR est mergée, l'extension est publiée automatiquement sur le Raycast Store et `{PR_MERGE_DATE}` est résolu dans `CHANGELOG.md`.

---

## 6. État actuel de `orca-raycast-extension` : fait vs à faire

### Ce qui est fait ✅

- ✅ **Manifeste `package.json` validé** : `$schema`, `name` (`"orca"`), `title` (`"Orca"`), `author` (`"eromleduk"`), `license` (`"MIT"`), `platforms` (`["macOS"]`), `categories` (`["Developer Tools", "Productivity"]`), commandes et préférences conformes au Title Case.
- ✅ **Extension 100 % en US English** : `package.json`, vues et actions dans `src/`, messages d'erreur/durées dans `src/lib/`, `README.md` et tests associés (`bun test` : 90 pass).
- ✅ **`CHANGELOG.md` initial créé** : placé à la racine avec `## [Initial Version] - {PR_MERGE_DATE}`.
- ✅ **Screenshots Store prêts (`metadata/`)** : `orca-1.png`, `orca-2.png` et `orca-3.png` au format `2000 x 1250 px` PNG en anglais, validés par `ray lint`.
- ✅ **Icône & outillage conformes** : `assets/extension-icon.png` (`512 x 512 px` PNG), `eslint.config.js` (`@raycast/eslint-config`), `.prettierrc`, `tsconfig.json`.
- ✅ **Hygiène Git vérifiée** : `.gitignore` exclut `node_modules/`, `dist/` et `raycast-env.d.ts` (confirmé non suivi par Git).
- ✅ **Validation locale verte** : `ray lint` (manifeste, icônes, metadata, ESLint, Prettier) et `ray build` passent sans erreur.
- ✅ **Gestion d'erreurs Orca** : `OrcaGuard` gère `binary_not_found`, `Orca Is Not Responding` et `Orca Is Not Running` en US English avec actions directes (`Open Preferences`, `Launch Orca`).

### Ce qu'il reste à faire avant soumission ⬜

1. **Commiter tes modifications locales en cours** :
   - `package.json` (`"author": "eromleduk"`) et `metadata/orca-2.png` sont actuellement modifiés dans le working tree.
2. **Préparer le workflow `npm` pour `raycast/extensions`** :
   - Générer `package-lock.json` via `npm install` (la CI du Store utilise `npm` et ignore `bun.lock`).
   - Ajouter `"publish": "npx @raycast/api@latest publish"` dans `package.json` -> `scripts` (ou exécuter directement `npx @raycast/api@latest publish`).
   - Re-vérifier `npm run lint && npm run build`.
3. **Vérifier le prérequis Orca en conditions réelles** :
   - Tester dans Raycast le scénario réel « Orca fermé » et « Orca CLI introuvable » sur le build de production.
   - Optionnel mais utile pour les reviewers : ajouter dans `README.md` (section `Requirements`) le lien public officiel pour télécharger/installer Orca.
4. **Ouvrir la Pull Request sur `raycast/extensions`** :
   - Lancer `npm run publish` (ou `npx @raycast/api@latest publish`), s'authentifier sur GitHub et suivre les retours des Community Managers.
