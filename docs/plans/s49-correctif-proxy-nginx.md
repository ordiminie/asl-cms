---
validated: yes
---

# Plan — Story s49-correctif-proxy-nginx

Branch: `feature/s49-correctif-proxy-nginx`

**Prérequis avant `/ks-execute`** : `docs/stories.md` (ajout de s49) est un document de cadrage ; il se
commite sur `main` avant de créer la branche (chemin par chemin, l'arbre contient des modifications
étrangères à cette story). Recherche : `docs/research/s49-correctif-proxy-nginx.md`.

## Target story

**Servir le site derrière nginx sans erreur** (complexité 2, dépend de s12b). Le site d'une
association répond 500 derrière nginx sur le serveur de recette ; la purge quotidienne et l'amorçage
échouent sur ce même serveur. Critères d'acceptation (texte complet dans `docs/stories.md`) :

1. L'accueil du domaine d'une association répond 200 en HTTPS et sert son site, sur deux associations ;
   un domaine inconnu répond 404.
2. Le contrôle de fin de déploiement et de retour arrière échoue quand l'application répond comme avant
   le correctif — prouvé par un test.
3. L'application n'écoute toujours que sur la machine elle-même.
4. Le contrat service systemd / nginx / Next est gardé par un test automatisé.
5. Un nouvel ADR et le README d'exploitation sont à jour.
6. `ops:bootstrap` et la purge quotidienne aboutissent sur le Node du serveur (22.22.2) sans
   contournement.

### Ce que la planification a établi (et qui change la recherche)

- **Cause du défaut `server-only` : trouvée.** Reproduite en installant Node 22.22.2 à côté : le crochet
  `registerHooks` échoue sur 22.22.2 et fonctionne sur 22.23.3. Un remplacement par `Module._load`
  fonctionne sur les deux (essayé sur `tsx` 4.23.11, import indirect, `NODE_ENV=production`). La question
  ouverte 3 de la recherche est réglée ; le critère 6 se traite dans le dépôt, pas par une version
  minimale de Node.
- **Piste du correctif de proxy : `-H localhost` + `NODE_OPTIONS=--dns-result-order=ipv4first`.**
  Vérifié : `listen('localhost')` écoute en `127.0.0.1` avec cette option, sur Node 22.22.2 et 22.23.3,
  via `NODE_OPTIONS`. **Pas vérifié de bout en bout** avec `next start` (pas de build local, règle du
  dépôt) : la preuve est le redéploiement sur le VPS. Voir « Risques ».
- **Décisions écrites** : ADR 043 (adresse de Next) et ADR 044 (`server-only` dans les scripts), déjà
  rédigés avec les options écartées ; ils voyagent avec la branche.

## Tasks (ordered)

Chaque tâche : test d'abord (échec constaté), puis code, puis test vert. `pnpm test --run`, jamais
`pnpm test` seul.

1. [x] **Module `allowServerOnly`** — `src/db/scripts/allow-server-only.ts` +
       `allow-server-only.test.ts`. Écrire d'abord le test : sans l'appel, `createRequire(import.meta.url)`
       chargeant `server-only` lève l'erreur de Next ; après `allowServerOnly()`, le même chargement renvoie
       un objet vide et un autre module (par exemple `node:path`) se charge normalement ; la fonction
       renvoyée rétablit l'état d'origine (l'erreur revient). Puis le module : remplace `Module._load` pour
       le fichier dont le chemin finit par `server-only/index.js`, renvoie la fonction de restauration.
       Style fonctionnel, pas de classe. Piège : ce fichier de test tourne dans le projet Vitest `client`
       (jsdom, `setup-test.ts`) ; `createRequire` contourne les alias de Vite, ce qui est voulu.
2. [x] **Les quatre scripts utilisent le module** — `bootstrap-platform.ts`, `transfer-presidency.ts`,
       `purge-rate-limit-fingerprints.ts`, `seed.ts`. Test de garde d'abord
       (`src/db/scripts/server-only-guard.test.ts`) : chaque fichier importe `./allow-server-only`, appelle
       `allowServerOnly()` **avant** son import dynamique des services, et ne contient plus `registerHooks`.
       Puis remplacer les quatre blocs. Vérification hors test, **sous Node 22.22.2** (installé en scratchpad,
       `npm install node@22.22.2`) : `ops:bootstrap` avec des arguments invalides doit arriver à l'erreur de
       validation du service (« L'adresse de contact… »), pas à l'erreur `server-only` ; idem
       `transfer-presidency` ; le résultat est collé dans la revue. Corriger le README (section 2.3) : la
       version de Node n'est plus un prérequis caché, dire que 22.22.2 et 22.23.3 sont essayées.
3. [x] **Le contrôle de fin de déploiement détecte le défaut** — `scripts/ops/deploy-release.ts` :
       extraire `verifyLocally` pour qu'on puisse lui passer l'appel réseau (`fetch` injecté, délai et
       nombre d'essais paramétrables pour les tests). Test d'abord dans `deploy-release.test.ts` : une
       réponse 500 → échec ; une réponse 308 (accueil redirigé vers lui-même) → échec ; une réponse 200 →
       succès ; injoignable puis 200 → succès ; les en-têtes envoyés sont ceux de nginx
       (`X-Forwarded-Proto: https`, `X-Forwarded-Host`, `Host`). Puis le code : exiger un statut 2xx au lieu
       de « < 500 », avec ces en-têtes. Aucun nom de domaine dans le fichier (test `ops/` existant).
4. [x] **Le retour arrière fait la même vérification** — `ops/rollback.sh` : mêmes en-têtes, statut `2xx`
       seulement (le commentaire « tout statut < 500 » est corrigé). Tests d'abord, dans
       `ops/ops-config.test.ts` : le script contient les en-têtes de nginx, ne contient plus l'expression
       `^[1-4][0-9][0-9]$`, et la vérification reste après le redémarrage (test existant conservé). Garder
       `LOCAL_URL=http://127.0.0.1:3100/` (test existant).
5. [x] **Le service et le contrat avec nginx** — `ops/systemd/asl-cms.service` et
       `ops/ops-config.test.ts`. Tests d'abord (rouges avec l'unité actuelle) : (a) l'`ExecStart` finit par
       `next start -H localhost -p 3100` ; (b) l'unité pose `Environment=NODE_OPTIONS=--dns-result-order=ipv4first` ;
       (c) **le contrat** : le `-H` du service est le mot `localhost` (jamais une adresse numérique, que Next
       ne reconnaît pas comme lui-même) **et** l'ordre IPv4 est posé **et** `proxy_pass` de nginx vise
       `127.0.0.1:3100` — les trois ensemble, avec un message d'échec qui nomme la cause (ADR 043) ;
       (d) toujours aucun `0.0.0.0` ni `::` dans l'unité. Puis l'unité (commentaire d'en-tête mis à jour).
       Mêmes fichiers : README d'exploitation — ligne 48 (écoute), section 2.6 (installation de l'unité),
       **nouvelle sous-section « Appliquer ce correctif sur un serveur déjà installé »** (recopier l'unité,
       `daemon-reload`, `restart`, `ss -ltn | grep 3100` attendu `127.0.0.1:3100`, `curl` avec les en-têtes
       de nginx attendu 200, purge relancée à la main et lue dans `journalctl -u asl-cms-purge`), section
       « Points de vigilance » (la leçon : tester avec les en-têtes de nginx, pas sans).
6. [ ] **Revue de cohérence de la documentation** — `docs/architecture.md` (ligne 36 « lié à
       `127.0.0.1` » reste vraie : le dire explicitement avec l'ADR 043), `docs/exploitation/README.md`
       (lignes 206, 258, 347 : ce qu'elles attendent est inchangé, le vérifier), `docs/research/s12b-…`
       n'est **pas** modifiée (livrée). Tâche vérifiable par `pnpm check:rules` et `pnpm lint`
       (formatage Prettier des fichiers Markdown et TypeScript touchés).

Six tâches : la story reste petite (complexité 2), pas de découpage à proposer.

## Files touched

Code et configuration :

- `src/db/scripts/allow-server-only.ts` (+ `.test.ts`) — nouveau
- `src/db/scripts/server-only-guard.test.ts` — nouveau
- `src/db/scripts/bootstrap-platform.ts`, `transfer-presidency.ts`, `purge-rate-limit-fingerprints.ts`,
  `seed.ts` — remplacement du bloc `registerHooks`
- `scripts/ops/deploy-release.ts`, `scripts/ops/deploy-release.test.ts`
- `ops/rollback.sh`, `ops/systemd/asl-cms.service`, `ops/ops-config.test.ts`

Documentation :

- `docs/exploitation/README.md`, `docs/architecture.md`
- `docs/decisions/043-…md`, `docs/decisions/044-…md` — déjà écrits
- `docs/research/s49-correctif-proxy-nginx.md`, ce plan, puis la revue `docs/reviews/s49-….md`

Non touchés, volontairement : `ops/nginx/asl-cms-site.conf.template` (aucune adresse de `ops/` ne
change ; les quatre en-têtes écrasés de l'ADR 036 restent), `next.config.ts`, `src/proxy.ts`,
`src/i18n/routing.ts`, `ops/deploy.sh`, `ops/add-domain.sh`, `docs/research/s12b-mise-en-ligne.md`.

## Test strategy

Deux niveaux, comme le dépôt (`rule-ci-cd-devops`) : unitaire (Vitest) et e2e. **Aucun nouveau niveau
d'intégration** — la question 5 de la recherche est tranchée ainsi : un test qui démarrerait Next avec
`-H` puis lui parlerait avec `X-Forwarded-Proto` exigerait un build, ce que le dépôt réserve à la CI et
que cette machine ne porte pas ; le garde est le **contrat** (tâche 5) plus la **recette** sur le serveur.

- Projet Vitest `client` : tâche 1 (module) et tâche 2 (garde sur les quatre scripts).
- Projet Vitest `ops` : tâches 3, 4, 5 (`deploy-release.test.ts`, `ops-config.test.ts`).
- Le test de la tâche 5 (c) est celui qui aurait empêché le défaut : il échoue si l'adresse de Next et
  celle de ses réécritures redeviennent incohérentes.
- Hors test, vérifié à l'exécution : les scripts sous Node 22.22.2 (tâche 2).
- Pas d'e2e nouveau : le défaut n'existe pas sans `-H` et sans proxy, donc l'e2e actuel ne peut ni le
  voir ni le garder. Le test de fumée (`pnpm test:smoke`) reste la vérification sur le serveur déployé.
- Commandes : `pnpm test --run` (ou un fichier ciblé), `pnpm lint`, `pnpm check:rules`. Pas de
  `pnpm build` automatique.

## Definition of Done

Repo (AGENTS.md) :

- Une PR, un commit, description structurée ; migrations : aucune ; `.env` : aucune variable ajoutée.
- Tests verts (`pnpm test --run`), lint et formatage propres, ADR 043 et 044 dans la PR.
- Revue passée (`/ks-review`), aucun critique ouvert.

Propre à s49 — **à faire par toi sur le VPS après le merge**, procédure de la nouvelle sous-section du
README, une instruction à la fois :

- Redéploiement (`deploy.sh main`), recopie de l'unité, `daemon-reload`, `restart`.
- `ss -ltn | grep 3100` : seulement `127.0.0.1:3100` (critère 3).
- `curl -I https://<domaine A>/` : **200** (critère 1) ; puis `pnpm test:smoke` depuis ton poste sur A, B
  et le domaine inconnu.
- `sudo systemctl start asl-cms-purge` puis `journalctl -u asl-cms-purge` : « Empreintes purgées » et
  aucune erreur (critère 6) ; `ops:bootstrap` n'est pas à rejouer (l'amorçage de A est fait), il est
  couvert par la tâche 2.
- Les étapes de recette déjà faites restent valables (serveur, base, certificat de A). Reprennent
  ensuite : `add-domain.sh` pour `asl3`, l'association B depuis `/admin`, la tâche 10, la recette.

## Risques et questions encore ouvertes

1. **Preuve de bout en bout manquante.** La combinaison `-H localhost` + `ipv4first` n'a pas tourné avec
   `next start`. Si, après redéploiement, l'accueil reste en 500 ou si nginx répond 502, **repli** : je
   n'applique pas une variante à l'aveugle ; l'ADR 043 est amendé par un nouvel ADR et on reprend la
   recherche sur les options b/c écartées. Les tâches 1 à 4 restent valables dans tous les cas.
2. **Statut de l'accueil pour un hôte inconnu.** Le contrôle de la tâche 3 envoie `Host: 127.0.0.1:3100`
   (aucun domaine d'association en dur dans `ops/`) : l'accueil doit rendre l'écran « introuvable » avec
   un **200** (ADR 013, README section 10). À confirmer par l'exécution ; si c'est autre chose qu'un 2xx,
   le contrôle exige le statut réellement observé et on ajuste le test, pas l'inverse.
3. **`seed.ts` n'a pas de test de lancement.** Il est couvert par la garde de la tâche 2 (importe le
   module, plus de `registerHooks`), pas par une exécution.
4. **La purge a échoué une fois (00:13).** Elle est rejouable à la main (tâche DoD) ; rien n'est perdu
   que la purge elle-même (les empreintes de plus de 24 h restent en base un jour de plus).
