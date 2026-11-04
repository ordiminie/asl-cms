# Revue s49-correctif-proxy-nginx

Relecteur : sous-agent `reviewer`, contexte neuf, diff `git diff main...feature/s49-correctif-proxy-nginx`
(commit `080bd85d`). Rapport enregistré tel que rendu par le relecteur.

## 1. Tests, lancés par le relecteur

- Ciblés (`pnpm test --run` sur `ops/ops-config.test.ts`, `scripts/ops/deploy-release.test.ts`,
  `src/db/scripts/allow-server-only.test.ts`, `src/db/scripts/server-only-guard.test.ts`) : 4 fichiers,
  96 tests passés.
- Suite complète (`pnpm test --run`) : 281 fichiers passés, 3394 tests passés, 1 ignoré, sortie 0.
  Aucun timeout de worker.
- Pas de build, pas d'e2e.
- Prettier : les fichiers `.ts` et `.md` du diff passent. `.sh` et `.service` n'ont pas de parseur
  Prettier, ce qui est normal.

## 2. Ce qui est vérifié par le code et les tests, et ce qui ne l'est que par la recette VPS

**Vérifié ici, par le code et les tests :**

- L'unité `ops/systemd/asl-cms.service` contient `-H localhost`,
  `NODE_OPTIONS=--dns-result-order=ipv4first`, et ni `0.0.0.0` ni `::`.
- Le contrat unité / `proxy_pass` de nginx est testé.
- `verifyLocally` et `ops/rollback.sh` n'acceptent qu'un 2xx et envoient les en-têtes de nginx
  (critère 2).
- `allowServerOnly` neutralise `server-only` sous Vitest, et les quatre scripts l'utilisent avant leur
  import dynamique.
- Les deux ADR (043, 044) et le README sont écrits.

**Vérifié seulement par la recette VPS à venir (rien n'est inventé ici) :**

- Critère 1 : l'accueil répond 200 en HTTPS sur deux domaines, et un domaine inconnu répond 404.
- Critère 3 : `ss` montre `127.0.0.1:3100`. `-H localhost` avec l'ordre IPv4 écoute bien sur
  `127.0.0.1`.
- Le comportement réel de `next start -H localhost` avec `NODE_OPTIONS`.
- Critère 6 : `ops:bootstrap` et la purge quotidienne aboutissent sous Node 22.22.2. Le test unitaire
  tourne sous le Node de la machine de revue, pas sous 22.22.2 ; l'ADR 044 affirme l'essai sur 22.22.2 et
  22.23.3, que le relecteur n'a pas pu reproduire ici (l'implémenteur l'a fait, sorties dans son rapport).

## 3. Les six points signalés par l'auteur

**1. Helper `allow-server-only.ts` contre l'ADR 044 : cohérent, deux réserves mineures.**
Le code remplace bien `Module._load` pour `server-only/index.js` et renvoie une fonction de
restauration. Il résout aussi le nom de paquet par `_resolveFilename` (sous Vitest, `createRequire`
transmet `'server-only'`, pas un chemin) : détail non décrit par l'ADR, expliqué par le commentaire du
fichier. La garde commence par `request.includes('server-only')`, puis exige un chemin finissant par
`server-only[\\/]index.js`. La regex n'est pas ancrée devant `server-only` : `x/foo-server-only/index.js`
serait avalé (improbable). Aucun test ne pose le cas négatif d'un module au nom voisin.

**2. `verifyLocally` : honnête.** Il envoie `Host`, `X-Forwarded-Host` et `X-Forwarded-Proto: https`.
`fetch` de Node remplace `Host` par l'hôte de l'URL (`127.0.0.1:3100`, même valeur) ; le commentaire le
dit et ne prétend rien d'autre. Les en-têtes décisifs sont `X-Forwarded-Host` et `X-Forwarded-Proto`, et
le test pin les trois (appel exact de `fetch`, `redirect: 'manual'`). Seuil 2xx dans `isSuccess` et, dans
`rollback.sh`, `^2[0-9][0-9]$` ; tests : 500, 308, 404 en échec, 200 en succès. Le test de `rollback.sh`
est textuel (regex sur la source), acceptable pour un script shell.

**3. Phrase de `docs/architecture.md` non faite (tâche 6 du plan) : défaut du plan, minor.** La tâche 6
reste décochée alors qu'elle figure dans « Files touched ». `architecture.md` est un document de cadrage
commité sur `main`, hors de la branche de la story ; la ligne 36 (« lié à `127.0.0.1` ») reste vraie. Le
plan demandait une chose que ses propres règles interdisent : ce n'est pas une faute de l'implémentation.
Le reste de la tâche 6 est fait (Prettier, relecture du README).

**4. Commit de 17 fichiers : propre.** `git show --stat` ne montre que les deux ADR, le README
d'exploitation, le plan, la recherche, trois fichiers `ops/`, les tests de déploiement et d'exploitation,
le helper et son test, les quatre scripts et le test de garde. Pas de `docs/designs`, `docs/logs`,
`docs/research/s42-*`, zip ; `docs/stories.md` non modifié. La reformatation Prettier du plan et de la
recherche n'a pas été comparée mot à mot ; les tâches 1 à 5 et leurs libellés restent cohérents avec le
diff.

**5. Le test de contrat aurait échoué avant le correctif : oui.** Il extrait `-H` d'`ExecStart`, vérifie
`ipv4first` et lit la cible de `proxy_pass`. Avec `-H 127.0.0.1` et sans `NODE_OPTIONS`, `host` vaut
`127.0.0.1` et `ipv4First` vaut `false` : le `toEqual` échoue, avec un message qui nomme la cause. Il
garde la cohérence de configuration, pas le comportement réel de Next, qui relève de la recette.

**6. Motif laissé derrière : rien trouvé.** Un seul `-H` dans le dépôt (l'unité `asl-cms.service`).
`asl-cms-purge.service` n'a pas de `-H` et utilise `tsx` avec le script de purge migré. `registerHooks`
n'apparaît plus que dans des commentaires et dans le test de garde qui vérifie son absence.
`skip-server-only.cjs` n'apparaît dans aucune documentation. Section 2.3 du README : cohérente avec
l'ADR 044. Les lignes 255, 307 et 396 attendent toujours `127.0.0.1:3100`, ce qui reste vrai.

## 4. Checklist (templates/review-checklist.md)

- Imports et références vérifiés dans le code : `Module._load` et `_resolveFilename` (interfaces internes
  de Node, typées par cast, documentées comme internes dans l'ADR 044), `LOCAL_URL`, `VERIFY_ATTEMPTS`,
  `VERIFY_DELAY_MS`, `./allow-server-only`.
- Diff contre le plan : tâches 1 à 5 faites, tâche 6 partielle (point 3). Rien dans le diff que le plan
  n'ait demandé, hors les ADR 043 et 044, annoncés.
- Tests lus comme du code de production : ils pinnent les critères 2 et 4 et le comportement du helper ;
  le cas négatif du helper manque.
- ADR : 036 (amendée par la 043, qui le dit), 008, 013 non contredits. Les en-têtes écrasés par nginx
  (ADR 036) ne sont pas relâchés : le gabarit nginx n'est pas touché.
- Aucune valeur codée en dur contraire à l'ADR 010 : `LOCAL_HOST` est dérivé de `LOCAL_URL`.
- `withRlsBypass`, RLS, tables métier : sans objet.

## 5. Constats

- **minor** : regex d'`allow-server-only.ts` non ancrée devant `server-only`, et pas de test négatif
  (point 1). Correction possible : ancrer `(^|[\\/])server-only[\\/]index\.js$` et ajouter le cas négatif.
- **minor** : tâche 6 du plan décochée, `architecture.md` non modifié. Incohérence interne du plan
  (point 3) : à consigner, ou à faire à part sur `main`.
- **minor** : la vérification sous Node 22.22.2 (ADR 044) et le comportement réel de
  `next start -H localhost` ne sont pas prouvables ici ; ils restent portés par la recette (section 2).

Aucun critique ni majeur.

Max severity: minor
Ship allowed: yes
