# Research — Story s49-correctif-proxy-nginx

Recherche du 4 novembre 2026, faite pendant la recette de s12b sur le VPS de recette. Les faits
« VPS » viennent de commandes lancées par l'utilisatrice et collées dans la conversation ; les faits
« Next » viennent du code installé (`next@16.3.0`, `node_modules/next/dist/`) ; les faits « dépôt »
viennent des fichiers cités, ouverts le même jour. Rien ici n'est un plan.

## Target story

**s49-correctif-proxy-nginx — Servir le site derrière nginx sans erreur** (complexité 2, dépend de
s12b, hors du tableau de périmètre du PRD). Ajoutée à `docs/stories.md` le 4 novembre 2026 après
arbitrage de l'utilisatrice : s12b est livrée (PR #44, `Ship allowed: yes`), son premier critère est
faux en conditions réelles, et le correctif prend son propre id plutôt que d'écraser la recherche
livrée de s12b.

Critères d'acceptation (résumé, texte complet dans `docs/stories.md`) :

1. L'accueil du domaine d'une association, en HTTPS, répond 200 et sert son site, sur deux
   associations ; un domaine inconnu répond 404.
2. Le contrôle de fin de déploiement et de retour arrière échoue quand l'application répond comme
   avant le correctif (erreur serveur, accueil redirigé vers lui-même) — prouvé par un test.
3. L'application n'écoute toujours que sur la machine elle-même.
4. Un test automatisé garde le contrat service systemd / nginx / Next.
5. Un nouvel ADR (le 036 est immuable) et le README d'exploitation sont à jour.
6. `ops:bootstrap` et la purge quotidienne aboutissent sur Node 22.22.2 sans contournement, ou la
   version minimale de Node est écrite et contrôlée.

`docs/reviews/stories.md` se termine par `Stories ready: yes`. s49 a été ajoutée **après** cette
revue, hors du découpage relu : même statut que s48, dont l'en-tête le dit.

## Current state of the code

### Le défaut, de bout en bout

Observé sur le VPS (Debian 13, Node 22.22.2, release `b5b6204ef70c`) :

| Requête                                                                       | Résultat                                                 |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| `curl -I https://asl1…/` (via nginx)                                          | `500`, `x-middleware-rewrite: https://localhost:3100/fr` |
| `curl -H "Host: asl1…" http://127.0.0.1:3100/` (direct, sans `X-Forwarded-*`) | `308`                                                    |
| idem avec `X-Forwarded-Proto: https` et `X-Forwarded-Host`                    | `500`                                                    |
| copie temporaire `next start -H localhost -p 3101`, mêmes en-têtes            | `200`                                                    |

Journal du service, à chaque requête sur `/` :
`Failed to proxy https://localhost:3100/fr Error: write EPROTO … packet length too long`.

### Le mécanisme (code de Next 16.3.0, ouvert)

1. **Le middleware voit toujours `localhost`.** `server/web/next-url.js:15-19` : `parseURL` remplace
   tout nom de machine bouclage (`127.x.x.x`, `[::1]`, `localhost`) par `localhost`. L'URL de réécriture
   que produit next-intl (`/` → `/fr`, `src/i18n/routing.ts` : `locales: ['fr']`, `localePrefix:
'never'`, appelé par `src/proxy.ts` ligne `intlMiddleware(request)`) a donc l'hôte `localhost`.
2. **Next se désigne par le `-H` reçu.** `server/base-server.js:349-353` : `fetchHostname =
formatHostname(hostname)` seulement si un hostname est donné. `server/next-server.js:1280` et
   `server/lib/router-utils/resolve-routes.js:115-117` bâtissent `initUrl = <protocole>://<hôte>:<port>…`
   avec ce `fetchHostname` (ou `opts.hostname`), et un **protocole `https` dès que
   `X-Forwarded-Proto` contient `https`**.
3. **Origines différentes = réécriture « externe ».** `resolve-routes.js:468` passe l'URL de réécriture
   par `getRelativeURL(value, initUrl)` (`shared/lib/router/utils/relativize-url.js`) : elle n'est relative
   que si `origin` est identique. Avec `-H 127.0.0.1`, `initUrl` vaut `https://127.0.0.1:3100`, la
   réécriture `https://localhost:3100/fr` : origines différentes → Next la **proxyfie** par le réseau
   (`server/lib/router-utils/proxy-request.js:80`, le message « Failed to proxy »).
4. **Selon le protocole, l'issue diffère.** En HTTPS (derrière nginx), la requête sortante parle TLS à
   un port qui parle HTTP : `EPROTO`, réponse 500. En HTTP (sans l'en-tête), la requête sortante
   `http://localhost:3100/fr` aboutit, puis tombe sur la redirection permanente `/fr` → `/` de
   `next.config.ts` (`legacyLocaleRedirects`, ADR 031) : **308 vers `/`**, que le client reçoit. Sur le
   VPS, même en HTTP, l'accueil ne se rend donc jamais : il boucle sur lui-même.

### Pourquoi rien ne l'a vu avant le serveur

- **e2e / CI** : `playwright.config.ts` lance `pnpm build && pnpm start --port ${PORT}` — **sans `-H`**.
  `hostname` est alors indéfini, `fetchHostname` aussi, et `resolve-routes.js:117` retombe sur
  `formatHostname(opts.hostname || 'localhost')` : `initUrl` vaut `http://localhost:PORT`, même origine
  que la réécriture. Le défaut n'existe que pour un `-H` qui n'est pas le mot `localhost`.
- **Contrôle de fin de déploiement** : `scripts/ops/deploy-release.ts:192-206` (`verifyLocally`) fait
  `fetch('http://127.0.0.1:3100/', {redirect: 'manual'})` sans `X-Forwarded-*` et **accepte tout statut
  `< 500`** : le 308 passe pour « en service ». `ops/rollback.sh:76-82` fait la même vérification avec
  `curl` et `LOCAL_URL=http://127.0.0.1:3100/`. C'est le mineur m8 de la revue de s12b, déjà noté.
- **Test de fumée** (`pnpm test:smoke`, README section 10, critères 1, 2, 5) : il vérifie le nom de
  l'association dans le titre de l'accueil. Il aurait attrapé le défaut, mais il se lance **à la main**,
  depuis le poste, une fois la recette installée. Il n'a pas encore été lancé.

## Anchor points

| Fichier                                     | Rôle aujourd'hui                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ops/systemd/asl-cms.service` l. 19         | `ExecStart=… next start -H 127.0.0.1 -p 3100` (ADR 036, décision 1)                                                                                   |
| `ops/nginx/asl-cms-site.conf.template`      | `proxy_pass http://127.0.0.1:3100;` ; écrase `Host`, `X-Forwarded-Host/-Proto/-For`                                                                   |
| `ops/ops-config.test.ts`                    | épingle `proxy_pass http://127.0.0.1:3100;`, les quatre `proxy_set_header`, et `next start -H 127\.0\.0\.1 -p 3100$`                                  |
| `ops/rollback.sh` l. 22                     | `LOCAL_URL=http://127.0.0.1:3100/` (test épingle cette valeur)                                                                                        |
| `scripts/ops/deploy-release.ts` l. 122, 192 | `LOCAL_URL`, `verifyLocally`                                                                                                                          |
| `scripts/ops/deploy-release.test.ts`        | tests de l'orchestrateur (à lire à la planification pour ce qu'ils figent sur `verify`)                                                               |
| `docs/exploitation/README.md`               | l. 48 (écoute 127.0.0.1:3100), l. 206, 258, 347 ; section 2.3 (Node) ; section 4 (`ops:bootstrap`)                                                    |
| `docs/decisions/036-…md`                    | décision 1 (`-H 127.0.0.1`), décision 4 (en-têtes écrasés). Immuable : un correctif = nouvel ADR (le prochain numéro est **043**, le dernier est 042) |
| `src/proxy.ts`, `src/i18n/routing.ts`       | la réécriture est le comportement normal de next-intl en locale unique sans préfixe (ADR 008)                                                         |
| `next.config.ts`                            | `redirects()` : `/fr` → `/` en 308 (ADR 031). Aucun réglage `trustHostHeader`                                                                         |

## Verified APIs / functions

Vérifié en ouvrant le code, ou par exécution :

- `getRelativeURL(url, base)` — `next/dist/shared/lib/router/utils/relativize-url.js` : relatif ⇔
  `new URL(url, base).origin === new URL(base).origin`.
- `parseURL` de `NextURL` — `next/dist/server/web/next-url.js:15-19` : normalisation bouclage → `localhost`.
- `experimental.trustHostHeader` — existe dans `config-shared` de Next 16.3.0. Dans `resolve-routes.js:117`
  il est testé **avant** la branche `opts.port`, et construit `https://<Host>…` en dur. Dans
  `next-server.js:1280` il n'est lu **qu'en second**, après `fetchHostname && port`. Les deux chemins
  n'ont donc pas la même priorité. Aucune exécution : ce n'est pas vérifié en conditions réelles.
- **`listen('localhost')` en Node** (exécuté ici, Node 22.23.3, où `localhost` donne `127.0.0.1` puis
  `::1` pour `getent`, mais où l'ordre par défaut de Node est `verbatim`) : écoute en `::1` ; avec
  `--dns-result-order=ipv4first`, écoute en `127.0.0.1`. Sur le VPS, `getent ahosts localhost` donne
  `::1` **avant** `127.0.0.1` et la copie `-H localhost` a écouté en `[::1]:3101` (sortie de `ss`).
- `NODE_OPTIONS` du service : vide sur le VPS (`NODE_OPTIONS=[]`) ; `Environment=NODE_ENV=production` est
  la seule variable posée par l'unité.
- Test d'une copie `-H localhost` avec les en-têtes de nginx : `200`. Le service de production n'a jamais
  été modifié ; la copie s'est arrêtée seule (`timeout 60`) et ses fichiers temporaires ont été retirés.

## Traps & constraints

- **`localhost` n'est pas `127.0.0.1` sur ce serveur.** `-H localhost` seul ferait écouter Next en IPv6
  uniquement ; nginx (`127.0.0.1:3100`), `deploy-release.ts`, `rollback.sh` et la section 4 du README
  vivraient alors d'une adresse qui ne répond plus. Observé, pas supposé.
- **Quatre tests épinglent aujourd'hui la forme actuelle** : `proxy_pass http://127.0.0.1:3100;`,
  `next start -H 127\.0\.0\.1 -p 3100$` (`ops-config.test.ts`), `LOCAL_URL=http://127.0.0.1:3100/`
  (rollback), plus la liste des quatre `proxy_set_header`. Tout correctif qui change l'adresse
  d'écoute ou de transmission doit les faire évoluer **dans la même PR**, avec une raison écrite.
- **Le test `ops/` interdit tout nom de domaine en dur** dans les fichiers d'exploitation
  (`DOMAIN_PATTERN`). Le contrôle de déploiement ne peut donc pas embarquer le domaine d'une association.
- **Une vérification de déploiement qui parle avec `X-Forwarded-Proto: https` à `127.0.0.1:3100` sans
  `Host` d'association** tombe sur un domaine inconnu (404 attendu, ADR 013 : écran introuvable avec
  statut 200 selon le README) — ce que « répond 200 » ne distingue pas d'un accueil sain. Ce que le
  contrôle doit exiger est à trancher à la planification.
- **Ne pas relâcher l'ADR 036** : les en-têtes `X-Forwarded-*` sont écrasés par nginx parce que Next ne
  remplace pas ceux qui existent déjà (le tenant se résout d'après `x-forwarded-host`). Supprimer
  `X-Forwarded-Proto` côté nginx contournerait l'erreur en cachant le protocole réel à l'application
  (liens, cookies `__Secure-`, lien magique) : à écarter sans l'avoir mesuré.
- **`ops:bootstrap`** (`src/db/scripts/bootstrap-platform.ts`) enregistre `registerHooks` pour donner la
  condition `react-server` à `server-only`, **mais** son import statique de `./env` précède le crochet
  seulement pour `dotenv` (pas de `server-only` dedans). Le même motif est recopié dans
  `seed.ts`, `transfer-presidency.ts` et `purge-rate-limit-fingerprints.ts`. Sur le VPS (Node 22.22.2)
  l'import des services a levé « This module cannot be imported from a Client Component module » : le
  crochet n'a pas agi. En local (Node 22.23.3) le même mécanisme fonctionne, reproduit avec `tsx` en
  `NODE_ENV=production` et par un import indirect. **La cause n'est pas établie.**
  Conséquence constatée : la purge quotidienne de s08b (`ops/systemd/asl-cms-purge.service`, ExecStart
  `tsx src/db/scripts/purge-rate-limit-fingerprints.ts`) échoue sur le serveur, le 4 novembre à 00:13
  (voir question ouverte 4).
- **Contournements essayés sur le VPS** : `NODE_OPTIONS=--conditions=react-server` casse `react`
  (`use-intl` : « does not provide an export named 'useEffect' ») ; un préchargement CommonJS qui remplace
  la réponse de `Module._load` pour `server-only/index.js` a fonctionné (association `asl-test-1`
  amorcée). Ce préchargement n'est pas dans le dépôt.
- **Conventions du dépôt** : une correction passe par le pipeline (`/ks-plan` validé avant tout code) ;
  pas de Quick Fix ici (contrat de déploiement, plusieurs fichiers, ADR). `pnpm test --run` en non
  interactif. Les fichiers `ops/` sont aussi lus par les tests `ops/ops-config.test.ts`.
- **Arbre de travail partagé** : `git status` montre des modifications étrangères à cette story
  (`docs/designs/`, `docs/logs/`, `docs/research/s42-…`). Stager chemin par chemin.

## Open questions

1. **Quel correctif ?** Candidats, aucun éprouvé de bout en bout :
   a. `-H localhost` **avec** `Environment=NODE_OPTIONS=--dns-result-order=ipv4first` dans l'unité :
   l'adresse de Next devient `localhost` (cohérente avec la réécriture) et l'écoute reste en
   `127.0.0.1`. Mécanisme vérifié en local (`listen('localhost')`), **pas** sur le VPS ni avec
   `next start`. Laisse nginx, `LOCAL_URL` et le test de `proxy_pass` intacts ; change le test d'`ExecStart`.
   b. `-H localhost` + nginx qui vise `localhost`/`[::1]` : touche le gabarit, les deux `LOCAL_URL`, le
   test de `proxy_pass` et la section 4 du README.
   c. `experimental.trustHostHeader` : changerait `initUrl` en `https://<Host>` ; priorité différente
   selon le fichier de Next, et hôte de la réécriture à vérifier. Option « experimental ».
   d. Éviter la réécriture interne en locale unique (autre approche de routage) : touche l'ADR 008 et
   tout `src/app/[locale]/…` ; hors de ce qu'on peut juger ici.
2. **Que doit exiger le contrôle de fin de déploiement ?** Un statut précis sur quel chemin, avec quel
   `Host`, sans nom de domaine en dur dans `ops/` ? (Voir piège ci-dessus.)
3. **Cause du défaut `server-only` sur Node 22.22.2.** Version de Node, ordre d'enregistrement de
   `tsx`, ou chemin de chargement ? Le critère 6 de la story demande de la lever ou de documenter la
   version minimale : la recherche ne peut pas choisir.
4. ~~La purge quotidienne tourne-t-elle sur le VPS ?~~ **Réglée le 4 novembre : non.**
   `journalctl -u asl-cms-purge --since "2 days ago"` montre le passage de 00:13 : `Echec de la purge…`,
   trace identique à celle de `ops:bootstrap` (`Module._compile`, `tsx … transformer`, `cjsLoader`), puis
   `asl-cms-purge.service: Failed`. Le défaut `server-only` touche donc la minuterie de s08b, pas seulement
   l'amorçage : le critère 6 de s12b (la purge passe chaque jour) est faux sur le serveur, comme le
   critère 1. Seule la première ligne de la trace est lisible (le journal était tronqué par le pager) ;
   le message exact n'a pas été relu, la ressemblance avec l'amorçage est celle de la pile.
5. **Le correctif doit-il recevoir un test d'intégration avec Next réel** (démarrage avec `-H 127.0.0.1`
   puis requête avec `X-Forwarded-Proto: https`) ? La stratégie de tests du dépôt n'a que deux niveaux
   (unitaire, e2e sur build de production) ; un troisième, même minimal, serait une exception à
   écrire en ADR.
6. **La recette de s12b se termine-t-elle sur la version corrigée ou refait-on les étapes déjà
   passées ?** Le serveur est en 500 tant que s49 n'est pas déployée ; `asl3`, l'association B, la
   tâche 10 et `recette-s12b.md` sont en attente.
