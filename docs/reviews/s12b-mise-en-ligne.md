# Revue — Story s12b-mise-en-ligne

> Revue n° 4, relecteur en contexte neuf. Diff jugé : `git diff main...feature/s12b-mise-en-ligne`
> (35 fichiers, commits `dccc23d7`, `9b32e419`, `5cfa8b27`, `8ccbe51b`). Le correctif `8ccbe51b` est relu
> comme du code neuf. Modifications non commitées (docs/designs/_, docs/research/s12d-_) ignorées. Aucun
> fichier modifié.
>
> Historique : revue 1 → 3 majeurs (M1–M3), 10 mineurs ; revue 2 → 1 majeur (N1, sécurité), 4 mineurs ;
> revue 3 → 5 mineurs (P1–P5). Tous corrigés, sauf m8 (assumé, coût moyen).

## Conformité au plan

- [x] Tâches 1 à 7 présentes. Tâches 8 à 10 (serveur) non faites, `docs/exploitation/recette-s12b.md`
      encore un squelette : pas un défaut du code, mais la Definition of Done n'est pas atteinte tant que
      la recette n'est pas remplie.
- [x] `git diff dccc23d7 -- docs/plans/s12b-mise-en-ligne.md` : un seul hunk (`@@ -230,3 +230,38 @@`),
      35 lignes ajoutées, aucune supprimée ; frontmatter `validated: yes` et tâches validées inchangés.
- [x] La note du plan sur les deux étapes ajoutées à la tâche 3 (`shareCache`, `markBuilt`) est justifiée :
      elle déclare un écart qui serait sinon une dérive silencieuse ; l'ordre annoncé est fixé par le test.

## Anti-hallucination

- [x] Tout ce qu'utilise `8ccbe51b` existe : `spawnSync` (node:child_process), export `BUILD_MARKER`
      (`scripts/ops/deploy-release.ts:119`) importé par `ops/ops-config.test.ts`, `serverSteps` exporté,
      `runuser -u … --` (util-linux), `ln -sT` (GNU coreutils, `--no-target-directory`).
- [x] Next 16.3 n'utilise `.next/cache` à l'exécution que pour les images (`server/image-optimizer.js:685`),
      le cache fetch (`file-system-cache.js:318`) et `server/cache-dir.js:23` : le remplacer après le build
      par un répertoire vide ne casse rien ; le cache fetch du build est recalculé à la demande.
- [x] Texte de P3 désormais exact (ISR sous `.next/server/`, avertissements EROFS attendus).

## Respect des règles

- [x] AGENTS.md : aucune valeur en dur liée à un tenant, aucun secret, aucune nouvelle occurrence de
      `withRlsBypass`.
- [x] ADR 036, Conséquences : modification minimale conforme à P4, acceptable (l'ADR voyage avec la
      branche non mergée).
- [x] Design system : sans objet.

## Tests (lancés par le relecteur)

- `/workspace`, `vitest --run --project ops` : **4 fichiers, 127/127**, dont les 3 tests `100755`.
- Copie disque local hors git, suite complète : **239 fichiers, 2865 passés, 4 ignorés, 0 échec, aucun
  timeout** (3 tests `100755` ignorés hors git + 1 déjà ignoré sur main). **Bilan net : 2868 passés,
  1 ignoré.**
- `bash -n` OK sur les trois scripts, tous en `100755` dans l'index ; `eslint ops scripts/ops smoke`
  propre ; `tsc --noEmit` propre sur la copie (dans `/workspace`, seul `.next/dev/types/validator.ts`,
  artefact de `next dev`) ; Prettier ne signale que le plan. shellcheck non installé.
- Non lancés : `pnpm build`, e2e, test de fumée.
- Tests plus solides qu'en revue 3 : `serverSteps` testé sur les commandes réellement lancées (spawn
  mocké : ordre et utilisateur de `rm`, `mkdir`, `rm`, `ln -sT`, `touch`) ; refus des versions invalides
  testé en exécutant `rollback.sh` ; constante du marqueur commune au TS et au bash ; ordre build →
  shareCache → markBuilt → migrate fixé ; aucun marqueur après un échec à `build` ou `shareCache`.

## Reprise de la revue 3

- **P1 — corrigé.** `deploy.sh` ne mentionne plus `next-cache`, `.next/cache` ni `cache_dir` ; son seul
  `rm -rf` porte sur `"$release"` (non inscriptible par le service) ; testé. `next build` part d'un clone
  neuf avec un `.next/cache` interne à la version. Root n'exécute que `pnpm` et `tsx` depuis le
  `node_modules` de la version ; les quatre commandes de `shareCache` tournent sous asl-cms via `runuser`.
  Root ne supprime plus rien à travers `shared/`.
  - Course entre étapes, analysée, risque acceptable : (a) recréer `shared/next-cache/<short>` en lien
    entre `rm` et `ln` n'apporte rien (le service peut déjà réécrire ce cache, ses écritures restent
    confinées à ses montages, aucune commande root ne suit ce lien) ; (b) remplacer `shared/next-cache`
    par un lien vers `releases/` fait échouer le déploiement avant la bascule, sans marqueur : échec sûr,
    déni de service négligeable venant d'une application déjà compromise.
  - Chemins d'échec vérifiés : un échec à `shareCache` ou `markBuilt` survient avant la bascule (lien
    inchangé, pas de marqueur, `rollback.sh` refuse) ; un nouveau déploiement du même commit la reconstruit.
- **P2 — corrigé.** `.next/ASL_BUILD_OK` écrit par `markBuilt` après `build` et `shareCache` ; non
  falsifiable par le service (`releases/` en lecture seule, `touch` hors du lien de cache) ;
  `rollback.sh:148` l'exige, `BUILD_ID` n'est plus testé ; `rm -rf "$release"` avant chaque reconstruction
  empêche un marqueur ancien de survivre.
- **P3, P4 — corrigés.** README (arborescence, §6, §7, §11), commentaire de `asl-cms.service`, docblock
  de l'orchestrateur, plan et ADR exacts.
- **P5 — corrigé.** Validation `^[0-9a-f]{12}$` alignée sur `${commit:0:12}` (comparaisons de `readlink`
  exactes, chaîne vide refusée, sortie 2) ; refus de reconstruire `previous` seulement s'il existe ;
  `previous` pendant documenté ; phrase du plan exacte.
- **Ajout README §6** (suppression du cache sous asl-cms) : justifié, cohérent avec P1.
- **m8** — vérification acceptant toute réponse < 500 : non corrigé, assumé, coût moyen, à garder pour un
  cycle ultérieur.

## Régressions

- [x] Aucun code applicatif touché par `8ccbe51b`. Aucune version n'existe encore sur le serveur : le
      passage de `BUILD_ID` au marqueur n'invalide rien.

## Problèmes

- Critique : aucun.
- Majeur : aucun.
- Mineur : aucun nouveau ; seul m8 repris (accepté, coût moyen).

## Verdict

Les cinq points de la revue 3 sont réellement corrigés (vérifié dans le code). Avant de merger : la
recette serveur (tâches 8 à 10, `recette-s12b.md`) reste à remplir. Ouvrir la PR, ne la merger qu'une fois
la recette faite.

Max severity: minor
Ship allowed: yes
