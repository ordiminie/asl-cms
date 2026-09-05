# Amorçage du code — intégration du boilerplate ShipSaaS

**Situation de départ** : le dépôt asl-cms ne contient aucun code (docs, templates killer-saas, setup Docker). Le boilerplate ShipSaaS ne s'intègre donc pas à une base existante — **il devient la base de code**. C'est un amorçage, pas une fusion de deux applications.

**Stratégie retenue** : le boilerplate est branché en **remote `upstream`**, pas copié. On garde ainsi la possibilité de récupérer ses correctifs de sécurité et ses évolutions par un `git merge`, ce qui compte pour un produit dont le contrat promet 5 ans d'évolutions du socle mutualisé.

⚠️ **Le dépôt asl-cms doit rester privé.** Il contiendra le code d'un boilerplate payant, dont la licence interdit la redistribution.

---

## Phase 0 — Reconstruire le conteneur (PowerShell, sur Windows)

L'environnement de dev a été complété : pnpm, un service PostgreSQL, le port 3000 publié.

```powershell
cd S:\VSCode\asl-cms
docker compose build
```

---

## Phase 1 — Brancher le boilerplate en upstream (PowerShell)

> ✅ **Fait le 5 septembre 2026** (commit `27d78f6`). Cette phase reste la référence pour les récupérations upstream ultérieures.

Cette phase est la seule à nécessiter **tes identifiants Git** : elle se fait donc côté Windows, où ton accès au dépôt privé est déjà configuré. Le dossier étant monté dans le conteneur, tout ce qui est récupéré ici sera immédiatement visible côté Claude Code.

```powershell
cd S:\VSCode\asl-cms

# 1. Filet de sécurité : on amorce sur une branche, pas directement sur main
git switch -c chore/bootstrap-ship-saas

# 2. Brancher le dépôt du boilerplate (URL fournie à l'achat)
git remote add upstream <URL-DU-DEPOT-SHIPSAAS>
git fetch upstream

# 3. Vérifier le nom de sa branche principale (main ? master ?)
git branch -r

# 4. Fusionner les deux histoires (elles n'ont aucun ancêtre commun)
git merge --allow-unrelated-histories upstream/main
```

La dernière commande **va s'arrêter sur des conflits** : c'est attendu et normal. Ne les résous pas à la main — passe à la phase 2.

---

## Phase 2 — Résoudre les conflits (Claude Code, dans le conteneur)

> ✅ **Fait** : 48 conflits résolus dans `27d78f6`. Le tableau ci-dessous documente la politique appliquée, à réutiliser aux prochains merges upstream.

Fichiers en conflit attendus, tous à la racine :

| Fichier | Nature du conflit | Résolution |
|---|---|---|
| `AGENTS.md` | Le tien porte les règles **de processus** (pipeline killer-saas, gates, TDD). Celui de ShipSaaS porte les **conventions de code** (couches, DAL, facades, repositories). | Fusionner : garder la structure killer-saas et injecter les conventions ShipSaaS dans la section `## Technical conventions`, aujourd'hui vide (`<< IP Mike: ... >>`). |
| `CLAUDE.md` | Le tien fait une ligne (`@AGENTS.md`). Celui de ShipSaaS détaille commandes et conventions. | Garder le renvoi `@AGENTS.md` — puisque AGENTS.md absorbe les deux. |
| `.gitignore` | Deux listes à concaténer. | Union des deux, sans doublons. |
| `README.md` | Celui du boilerplate décrit le boilerplate. | Réécrire pour asl-cms. |
| `.claude/` | Tes subagents (`implementer`, `reviewer`, `stories-reviewer`) vs d'éventuels fichiers ShipSaaS. | Conserver les tiens, ajouter les siens s'il y en a. |

Le dossier `.claude/rules/` du boilerplate **est la source de vérité** des conventions de code : c'est là que les subagents `implementer` et `reviewer` doivent chercher, en partant de `.claude/rules/RULES-INDEX.md`. Le dossier `.cursor/rules/` n'en contient que des copies générées pour Cursor — à conserver, mais **jamais à éditer directement**.

Dis-moi simplement « les conflits sont là » et je les traite.

---

## Phase 3 — Installer et démarrer (conteneur)

```bash
docker compose run --rm --service-ports dev     # depuis PowerShell
# puis, dans le shell du conteneur :
pnpm install
pnpm init:env          # assistant interactif ; sinon : cp env.example .env.local
```

Dans `.env.local`, la base est déjà servie par le conteneur `db` :

```
DATABASE_URL=postgres://asl:asl@db:5432/asl_cms
```

Les autres variables (Stripe en clés de test, Better Auth, Brevo) se remplissent au fil des besoins — rien n'est requis pour un premier démarrage hors base de données.

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

Le site est alors sur **http://localhost:3000** depuis le navigateur Windows (le port est publié, à condition de lancer avec `--service-ports`).

> Si la page ne répond pas depuis Windows alors qu'elle répond dans le conteneur, forcer l'écoute sur toutes les interfaces : `pnpm dev -- -H 0.0.0.0`.

---

## Phase 4 — Vérifier avant de merger sur main

```bash
pnpm test          # Vitest : la suite du boilerplate doit passer
pnpm build         # le build de prod doit passer
```

Ces deux commandes vertes = l'amorçage est sain. On peut alors basculer sur `main` :

```powershell
git switch main
git merge chore/bootstrap-ship-saas
```

---

## Phase 5 — Enchaîner sur le pipeline

L'amorçage est du scaffolding, pas une feature : il ne passe pas par le cycle story. En revanche, la suite reprend le pipeline normal, et `/ks-architect` a désormais du **code réel** à analyser (skill `codebase-analysis`) plutôt qu'un boilerplate théorique.

Ordre : `/ks-prd` → `/ks-stories` → `/ks-stories-review` → `/ks-architect` → `/ks-design-system`.

---

## Récupérer plus tard les mises à jour du boilerplate

```powershell
git fetch upstream
git switch -c chore/upstream-<date>
git merge upstream/main
```

Puis vérifier (`pnpm test`, `pnpm build`) avant de merger sur `main`. À faire sur une branche dédiée, jamais directement sur `main` : une mise à jour de socle peut casser du code métier.
