---
validated: yes
---

# Plan — Story s12b-mise-en-ligne

Branch: `feature/s12b-mise-en-ligne`

## Target story

**En tant que** prestataire (SuperAdmin) **je veux** déployer l'application sur un VPS **afin que**
chaque association soit servie en HTTPS sur son propre domaine. Complexité 3. Dépendances (s01,
s01b, s03, s03c, s08b, s12a, s44, s45, s46, s46b, s47) toutes livrées.

Critères d'acceptation :

1. Sur le serveur déployé, le domaine d'une association provisionnée répond en HTTPS avec un
   certificat valide et sert le site de cette association ; un domaine inconnu répond 404 — test de
   fumée contre l'URL déployée, sur deux domaines d'associations distinctes.
2. Une requête HTTP vers le domaine d'une association est redirigée vers HTTPS.
3. Déployer une nouvelle version applique les migrations en attente avant que la nouvelle version ne
   serve des requêtes ; une migration en échec interrompt le déploiement et laisse la version
   précédente en service.
4. Un redéploiement conserve les fichiers déjà téléversés (un logo envoyé avant est servi après).
5. Après l'ajout du domaine d'une nouvelle association dans la configuration du serveur, ce domaine
   répond en HTTPS avec un certificat valide et sert cette association — même test de fumée.
6. La purge des empreintes des formulaires publics (s08b) est appelée au moins une fois par jour sans
   intervention humaine : une empreinte de plus de 24 h ne survit pas à l'appel planifié suivant.

À vérifier en revue, pas en test : ajouter un domaine ne modifie pas le code ; la procédure d'ajout
d'un domaine et de déploiement est écrite ; aucun workflow ne prétend déployer ce qu'il ne déploie
pas.

### Choix arrêtés (ADR 036)

Service systemd sans conteneur, build sur le serveur dans un répertoire par version, lien
`current`, nginx + certbot (un certificat par domaine), planifications en minuteries systemd,
déploiement lancé à la main. L'utilisatrice exécute les commandes sur le serveur en suivant la
procédure ; l'agent n'a pas d'accès SSH.

### Serveur de recette (relevé du 2026-10-19)

Debian 13 x86_64, 4 cœurs, 7,8 Go, pas de swap, Node 22.22.2, git ; ni pnpm ni PostgreSQL. **Serveur
partagé** : nginx tient 80/443 et sert un autre site (certbot déjà installé), apache2 écoute sur
8080, un autre Next sur le port 3000, aucune règle de pare-feu ; un agent automatisé y tourne sous
son propre utilisateur. Domaines de recette : deux sous-domaines d'associations et un sous-domaine
« inconnu », sous un domaine du prestataire, DNS chez Gandi. **Dans le dépôt (public), ces domaines
ne sont jamais écrits en dur** : ils sont passés en paramètres.

### Écarts à la recherche (2026-10-02, antérieure à s43–s47)

Dépassés depuis : la locale (s43 : `fr` seule, sans préfixe), le blog, les docs et la vitrine (retirés
par s45, le build ne les prérend plus), l'inscription libre (fermée, `disableSignUp: true`, s46b), les
rôles (`user` / `super_admin`, s47). Un `super_admin` peut ouvrir une session et recevoir un lien
magique sur **tout** domaine provisionné (`canOpenSessionOn`, ADR 034) : c'est ce qui rend l'amorçage
ci-dessous possible sans mot de passe. Le prochain ADR libre est le 036.

### Décisions de plan (questions 10 à 20 de la recherche)

- **Amorçage (T1)** : un script dédié crée la première association et le premier SuperAdmin.
  La seconde association passe par l'écran `/admin/organizations/new`, ce qui exerce le vrai chemin
  de provisionnement et le critère 5.
- **Le « 404 » du critère 1 (T11)** : un sous-domaine **routé par nginx, avec certificat, mais non
  provisionné**. `GET /api/identity/favicon` y rend un vrai `404` ; la page d'accueil y rend l'écran
  introuvable avec un statut 200 (ADR 013), et c'est ce que le test vérifie, sans attendre de 404.
- **Le test de fumée** est une spec Playwright à part (`playwright.smoke.config.ts`, sans
  `webServer`, sans seed), paramétrée par des variables d'environnement, lancée depuis le poste.
- **Les en-têtes de proxy (T6, T7, question 15)** : nginx écrase `X-Forwarded-For` par
  `$remote_addr`, une valeur unique que lisent à la fois `readVisitorIp` et `getIP` de Better Auth.
  **Aucune option Better Auth n'est ajoutée** ; la connexion sur les deux domaines est vérifiée sur le
  serveur réel (tâche 10).
- **La preuve du critère 6 sans écriture manuelle en base (T18)** : on envoie un message par le
  formulaire de contact au jour J, on compte les empreintes de plus de 24 h à J+1, puis à J+2 après
  le passage de la minuterie. Il s'agit seulement de lectures en base. La purge ne s'arrête plus à
  la première association en échec : c'est le mineur 5 de la revue de s08b, renvoyé à s12b.
- **`DATABASE_POOL_MAX` (T10)** : 10 en production (`docs/database-pool.md` § 6), PostgreSQL à
  `max_connections` 100 par défaut.
- **Restent hors story et inchangés** : les polices `next/font/google` (le serveur a accès au
  réseau), le durcissement des scripts destructifs (T2, signalé dans la procédure), Inngest et les
  dépendances orphelines (T13, question 19), le regroupement IPv6 en /64 (question 20).

## Tasks (ordered)

Les tâches 1 à 7 sont du code et de la configuration versionnés : l'implémenteur les fait en TDD.
Les tâches 8 à 10 se déroulent **sur le serveur**. L'utilisatrice les exécute en suivant la
procédure écrite à la tâche 7, puis colle les sorties dans la session. Leur résultat est consigné
dans `docs/exploitation/recette-s12b.md` avant `/ks-review`.

1. [x] **Purge robuste à l'échec d'une association.** `purgeExpiredRateLimitFingerprintsService`
       purge toutes les associations même si l'une échoue, renvoie `{organizations, deleted, failed}`,
       et le script `purge-rate-limit-fingerprints.ts` sort en `1` si `failed` n'est pas vide.
       Tests : `rate-limit-service.test.ts` (une association en échec au milieu de la liste → les
       suivantes sont purgées, l'échec est compté).
2. [x] **Amorçage de la plateforme.** `src/db/scripts/bootstrap-platform.ts` (`pnpm ops:bootstrap
-- --name --slug --domain --admin-email`) crée la première association et son paramétrage
       initial par les mêmes DAO que `provisionOrganizationService`. Il crée aussi le compte
       `super_admin`, sans mot de passe, et le rattache à cette association. La logique vit dans une
       fonction de service sans contrôle de session (chemin CLI, comme la purge), sous
       `withRlsBypass`. **Cette nouvelle occurrence est un point d'arrêt de revue, justifié par
       l'amorçage.** Le script refuse de tourner si un `super_admin` ou ce domaine existe déjà, valide
       ses arguments avec le schéma Zod du provisionnement et ne crée aucune donnée du seed. Tests :
       création nominale, refus si un `super_admin` existe, refus si le domaine existe, arguments
       invalides.
3. [x] **Orchestrateur de déploiement.** `scripts/ops/deploy-release.ts` enchaîne des étapes
       injectées : build, `db:migrate`, `db:check`, bascule du lien `current`, redémarrage,
       vérification HTTP locale. Il s'arrête à la première étape en échec. **Aucune étape en
       échec avant la bascule ne touche au lien.** Un échec de la vérification après la bascule remet
       le lien sur la version précédente. `ops/deploy.sh <ref>` prépare
       `/srv/asl-cms/releases/<commit>` : clone, `pnpm install --frozen-lockfile`, liens vers
       `shared/.env.production`. Puis il délègue à l'orchestrateur. `ops/rollback.sh` repointe sur la
       version précédente. Tests unitaires de l'orchestrateur : ordre des étapes ; migration en échec
       → pas de bascule, sortie `1` ; build en échec → migrations non lancées ; vérification en
       échec → lien restauré.
4. [x] **Configuration nginx et systemd versionnée.** `ops/nginx/asl-cms-site.conf.template`
       (80 → 301 HTTPS, sauf `/.well-known/acme-challenge/` ; 443 avec le certificat du domaine ;
       `proxy_set_header` `Host $host`, `X-Forwarded-Host $host`, `X-Forwarded-Proto $scheme`,
       `X-Forwarded-For $remote_addr` ; `proxy_buffering off` ; `client_max_body_size 17m`).
       `ops/add-domain.sh <domaine>` : bloc HTTP seul, `certbot certonly --webroot --cert-name
<domaine> --deploy-hook "systemctl reload nginx"`, puis bloc complet, `nginx -t` et
       rechargement. Il ne modifie aucun autre site. `ops/systemd/asl-cms.service` (`User=asl-cms`,
       `next start -H 127.0.0.1 -p 3100`, `NODE_ENV=production`, `Restart=on-failure`,
       `ProtectSystem=strict`, `ReadWritePaths=/srv/asl-cms/shared`, `NoNewPrivileges`), plus
       `asl-cms-purge.service` et `asl-cms-purge.timer` (`OnCalendar=daily`, `Persistent=true`).
       Tests : `ops/ops-config.test.ts` lit ces fichiers et fixe les pièges. Aucun
       `$proxy_add_x_forwarded_for`, les quatre en-têtes sont écrasés, le corps fait au moins 16 Mo,
       le tampon est coupé, le service écoute sur `127.0.0.1` et non sur `0.0.0.0`, la minuterie est
       quotidienne et persistante. Aucun nom de domaine n'est écrit en dur dans `ops/`.
5. [x] **Gabarit d'environnement de production.** `ops/env.production.example` reprend toutes
       les variables du schéma, avec les valeurs de production attendues et des secrets vides :
       `NEXT_PUBLIC_NODE_ENV=production`, `LOCAL_STORAGE_ROOT=/srv/asl-cms/shared/storage`,
       `DATABASE_POOL_MAX=10`, `BETTER_AUTH_URL=https://…`, `EMAIL_TRANSPORT=brevo`,
       `NEXT_PUBLIC_ENABLED_PAGES=admin`, plus `DATABASE_MIGRATION_URL` distincte. Test : chaque
       clé du schéma (`src/env-schemas.ts`) figure dans le gabarit, le gabarit ne porte aucune clé
       hors schéma (hors `NODE_ENV` et `SENTRY_*` lues ailleurs), `LOCAL_STORAGE_ROOT` est absolu et
       `NEXT_PUBLIC_NODE_ENV` vaut `production`.
6. [x] **Test de fumée paramétré.** `playwright.smoke.config.ts` (pas de `webServer`, certificats
       non ignorés) et `smoke/deployed.spec.ts`. Les cibles sont lues par
       `readSmokeTargets(process.env)` : `SMOKE_DOMAIN_A`, `SMOKE_DOMAIN_B`, `SMOKE_NAME_A`,
       `SMOKE_NAME_B`, `SMOKE_UNKNOWN_DOMAIN`, et une erreur explicite si l'une manque.
       Vérifications :
       - HTTPS valide sur A et B ;
       - le titre de la page d'accueil porte le nom de chaque association, et les deux diffèrent ;
       - `/api/identity/favicon` rend 200 sur A et B, et 404 sur le domaine inconnu ;
       - l'écran introuvable s'affiche sur le domaine inconnu ;
       - `http://` est redirigé en 301 ou 308 vers `https://` sur A et B.

       Script `test:smoke`. La suite e2e normale (`testDir: './e2e'`) ne le ramasse pas. Tests :
       `readSmokeTargets` en unitaire. La spec elle-même ne tourne que contre le serveur.
7. [x] **Documentation d'exploitation.** Créer `docs/exploitation/README.md` :
       - préparation du serveur : PostgreSQL 17 de Debian sur `localhost` ; `ops/postgres/bootstrap.sql`
         dérivé de `docker/db-init/` (extension, rôle propriétaire, `asl_app`, privilèges par défaut,
         mots de passe fournis à `psql` et non versionnés) ; utilisateur `asl-cms` ; arborescence
         `/srv/asl-cms` ; pnpm par corepack ; fichier de swap facultatif ;
       - DNS chez le registraire, ajout d'un domaine, déploiement, retour arrière ;
       - emplacement des minuteries, pour s12c et s26 ;
       - interdits en production : `db:seed`, `db:clear`, `db:reset-seed`, `db:push` (T2) ;
       - vérification des critères.

       Chaque commande est expliquée, et aucune n'est lancée sans être comprise. Mettre aussi à
       jour `docs/architecture.md` (ligne « Hébergement » et paragraphe sur les conteneurs, avec un
       renvoi à l'ADR 036). Vérification : `pnpm lint`, `pnpm check:rules`, `pnpm knip` (les
       nouveaux scripts sont référencés par `package.json`) et `pnpm test --run` passent.
8. [ ] **(Serveur) Préparation.** L'utilisatrice exécute la section « Préparation » :
       - PostgreSQL et rôles ;
       - utilisateur et répertoires ;
       - `.env.production` rempli hors dépôt (`600`) ;
       - enregistrements DNS des trois sous-domaines.

       Preuves à coller : `pnpm db:check` passe sous `asl_app` ; `ss -tlnp` montre PostgreSQL sur
       `127.0.0.1` seulement ; `dig` résout les trois sous-domaines vers le VPS.
9. [ ] **(Serveur) Premier déploiement et première association.** Enchaîner `ops/deploy.sh
<branche>`, `pnpm ops:bootstrap` (association A, SuperAdmin), puis `ops/add-domain.sh` pour A
       et pour le domaine inconnu. Le service écoute sur `127.0.0.1:3100`, la minuterie de purge
       apparaît dans `systemctl list-timers`. Connexion par lien magique du SuperAdmin sur A, cookie
       `__Secure-`. Provisionner B depuis `/admin`, **puis seulement** lancer `ops/add-domain.sh` B
       (critère 5). Preuve : `pnpm test:smoke` vert depuis le poste (critères 1, 2, 5).
10. [ ] **(Serveur) Preuves de durée et de reprise.**
        - Critère 4 : un logo téléversé sur A, un redéploiement, puis le logo toujours servi.
        - Critère 3 : un déploiement volontairement en échec à la migration
          (`DATABASE_MIGRATION_URL` invalide le temps d'un essai). Le lien `current` reste
          inchangé et le test de fumée reste vert.
        - Critère 6 : un message envoyé par le formulaire de contact de A au jour J, puis à J+2 le
          journal de `asl-cms-purge` et un comptage à zéro des empreintes de plus de 24 h.
        - Connexion par lien magique d'un membre de B sur le domaine B (s03c).

        Les sorties, sans secret ni domaine en clair, vont dans `docs/exploitation/recette-s12b.md`.

## Files touched

- `src/services/rate-limit-service.ts`, `src/services/__tests__/rate-limit-service.test.ts`,
  `src/db/scripts/purge-rate-limit-fingerprints.ts`
- `src/db/scripts/bootstrap-platform.ts` (+ test), une fonction de service d'amorçage dans
  `src/services/organization-service.ts` (+ test)
- `scripts/ops/deploy-release.ts` (+ test), `ops/deploy.sh`, `ops/rollback.sh`, `ops/add-domain.sh`
- `ops/nginx/asl-cms-site.conf.template`, `ops/systemd/asl-cms.service`,
  `ops/systemd/asl-cms-purge.{service,timer}`, `ops/postgres/bootstrap.sql`, `ops/ops-config.test.ts`
- `ops/env.production.example` (+ test)
- `playwright.smoke.config.ts`, `smoke/deployed.spec.ts`, `smoke/smoke-targets.ts` (+ test)
- `package.json` (scripts `ops:bootstrap`, `ops:deploy-release`, `test:smoke`), `knip.json` si
  besoin, `vitest.config.ts` si `ops/` et `smoke/` ne sont pas inclus
- `docs/exploitation/README.md`, `docs/exploitation/recette-s12b.md`, `docs/architecture.md`
- `docs/decisions/036-deploiement-systemd-nginx-certbot.md`, `docs/research/s12b-mise-en-ligne.md`,
  `docs/plans/s12b-mise-en-ligne.md`

Aucune migration, aucun modèle, aucun écran.

## Test strategy

- **Unitaire (Vitest)** : purge robuste (1), amorçage (2), ordre et arrêts de l'orchestrateur (3),
  pièges de proxy et de service fixés dans la configuration (4), couverture du gabarit
  d'environnement (5), lecture des cibles du test de fumée (6). Base et système de fichiers mockés,
  comme partout ailleurs.
- **e2e existants** : inchangés et verts en CI (`tenant-isolation`, `rate-limit`, `magic-link`,
  `association-identity`). Ils tournent sur GitHub, pas en local.
- **Test de fumée** : contre le serveur réel uniquement, lancé depuis le poste avec les domaines
  passés en variables. C'est la preuve des critères 1, 2 et 5.
- **Preuves d'exploitation** : critères 3, 4 et 6 sur le serveur, sorties consignées dans
  `recette-s12b.md`. La revue juge ce document en même temps que le diff.

## Definition of Done

- Une PR, une description structurée. Le diff ne contient aucun domaine ni secret en clair.
- Tests unitaires verts (`pnpm test --run`), CI verte (qualité + e2e).
- Test de fumée vert contre le serveur de recette sur deux associations et un domaine inconnu.
  Critères 3, 4 et 6 prouvés et consignés.
- Aucune régression sur le site déjà servi par le VPS. Il reste joignable avant et après, ce que
  vérifie `nginx -t` puis une requête sur ce site.
- La procédure d'exploitation et l'emplacement des minuteries sont écrits pour s12c et s26.
- La revue est passée, sans critique ouvert. Le point d'arrêt `withRlsBypass` de l'amorçage est
  examiné explicitement.
- Mise en production sur LWS : hors de cette story. Le serveur de recette sert l'environnement
  temporaire prévu par la story.
