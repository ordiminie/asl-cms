---
validated: yes
---

# Plan — Story s01b-logo-association

Branch: `feature/s01b-logo-association`

Sources : `docs/stories.md` §s01b, `docs/research/s01b-logo-association.md`,
`docs/designs/s01b-logo-association.md` (+ `.html`), `docs/design-system.md`, ADR 003, 004, 010, 013, 014 et
**ADR 015** (`docs/decisions/015-fichiers-identite-association.md`, écrit pour ce plan).

## Target story

**En tant que** membre du bureau d'une association **je veux** téléverser son logo et son favicon **afin que** le
site public, le back-office et l'onglet du navigateur portent son identité, sans intervention du prestataire.
Complexité 3. Dépend de s01.

Critères d'acceptation :

1. Depuis la page de réglages de son association, un membre du bureau téléverse un logo ; il s'affiche sur le site public et dans le back-office, et le remplacer met à jour les deux sans redéploiement.
2. Un fichier refusé (type non autorisé ou taille dépassée) affiche une erreur explicite et laisse en place, inchangé, le fichier qu'il devait remplacer.
3. Le fichier est écrit sur le disque du serveur, sous un répertoire propre à l'association : deux associations qui téléversent un fichier de même nom obtiennent deux emplacements distincts, chacun sous le préfixe de son association.
4. Le logo et le favicon sont servis par une route de l'application, jamais depuis un dossier statique public : cette route ne sert que les fichiers d'identité de l'association du domaine appelé, et une demande portant sur le fichier d'une autre association ou sur un chemin forgé (remontée `../`, chemin absolu) ne rend aucun fichier.
5. Deux associations servent deux logos distincts — vérifié sur les deux domaines.
6. Le favicon est un fichier distinct du logo, téléversé séparément depuis la même page : le favicon servi est celui de l'association du domaine appelé, jamais un fichier unique du dépôt ni une dérivation du logo, et une association qui n'en a pas téléversé reçoit un favicon par défaut. Deux associations servent deux favicons distincts — vérifié sur les deux domaines.
7. Une association sans logo reste lisible : son nom remplace le logo, sur le site public comme dans le back-office. Aucun écran cassé faute de logo. _(Formulation à aligner sur le design : monogramme + nom, voir « Préalables ».)_
8. Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin accèdent à la page de réglages et téléversent un logo ou un favicon : tout autre utilisateur authentifié — simple membre, bureau ou présidente d'une autre association, administrateur global de la plateforme — reçoit un refus, côté interface et côté serveur.

### Décisions déjà prises (à respecter, pas à rediscuter)

- Seuls logo et favicon passent sur le disque ; blog, avatar et formulaire d'organisation du boilerplate gardent
  leur stockage (arbitrage 2026-09-17, ADR 015).
- Logo : **PNG ou WebP**, 1 Mo maximum ; SVG et JPEG refusés. Sans logo → **monogramme + nom**. Sans favicon →
  **monogramme** (arbitrages de design 2026-09-17).
- Accès : **Bureau (`admin` d'association) et Président(e) (`owner`) du domaine appelé, et `super_admin`** —
  pas l'`admin` **global** (revue du découpage I-02).

### Décisions prises à ce plan (à confirmer à la validation)

- **Formats du favicon** (manque n° 1 du design) : **PNG ou ICO**, **200 Ko** maximum ; carré conseillé,
  48 px minimum conseillé. Dimensions **annoncées, non vérifiées** (ADR 015, pas de dépendance de décodage
  d'image), comme les 512 px du logo.
- **Détection du format par signature binaire** (PNG `89 50 4E 47 0D 0A 1A 0A`, WebP `RIFF….WEBP`,
  ICO `00 00 01 00`), jamais par l'extension ni par le type déclaré par le navigateur.
- **Règle du monogramme** (manque n° 2) : initiales des **deux premiers mots** du nom, en ignorant un préfixe
  « ASL » en tête ; un seul mot → ses deux premières lettres ; en capitales. « La Fourche » → LF,
  « ASL Les Pins » → LP.
- **Adresses** : page `/{locale}/bureau/identite` (route group `(bureau)`, hors `/admin`) ; fichiers
  `GET /api/identity/logo` et `GET /api/identity/favicon` (ADR 015).
- **Teinte du monogramme** : la teinte courante du tenant n'existe qu'en s02 ; d'ici là, le monogramme en CSS
  utilise le token `--accent-solid`, et le favicon SVG généré (hors CSS) la valeur hexadécimale de la teinte
  par défaut 195 donnée par le design system §1.2 (`#17849B`), dans **un seul module**, que s02 remplacera par
  le paramètre.

### Préalables hors branche (documents de cadrage, sur la branche par défaut)

- **`docs/stories.md`, critère 7 de s01b** : « son nom remplace le logo » → « le monogramme de l'association
  remplace le logo, son nom restant écrit à côté ». À faire **avant `/ks-review`**, sinon la revue jugera l'écart.
- **`docs/design-system.md`** (manques du design, non bloquants pour l'Execute) : §1.8 SVG → PNG/WebP ; §9 favicon
  (fichier distinct, monogramme par défaut) ; monogramme et sa règle au catalogue ; zone de dépôt au tactile ;
  formats du favicon ci-dessus.

## Tasks (ordered)

1. [x] **Stockage local derrière le contrat existant.** Découpler `StorageOperations.list` du type Supabase
       (`src/lib/files/storage/types.ts` : un type neutre, mappé dans `supabase-storage.ts` et ses appelants
       `files-repository.ts`, `file-service.ts`, `file-dal.ts`) ; ajouter `'local'` à `StorageType` et
       `createLocalStorage` (`src/lib/files/storage/local-storage.ts`) sous un répertoire racine lu dans `@/env`
       (nouvelle variable serveur dans `env-schemas.ts` et `env.ts`, documentée dans `env.example`, répertoire de
       développement ajouté au `.gitignore`, valeur jetable dans `.github/workflows/ci.yml`). L'adaptateur refuse tout
       chemin qui sortirait de la racine (`..`, absolu, octet nul) et écrit par fichier temporaire + renommage.
       **Tests unitaires** (système de fichiers temporaire) : aller-retour upload/download/delete/list ; deux
       préfixes d'organisation ne se voient pas ; chemin forgé refusé ; écriture interrompue ne laisse pas de fichier
       partiel sous la clé finale ; `file-service.test.ts` toujours vert.
2. [x] **Références d'identité sur `organization`.** Colonnes nullables `identity_logo_key` et
       `identity_favicon_key` dans `src/db/models/auth-model.ts`, migration **générée** par `pnpm db:generate`
       (jamais écrite à la main ; commit séparé autorisé par AGENTS.md). DAO `updateOrganizationIdentityKeyDao`
       (patron `updateOrganizationModulesDao`, `getDb()`), et `TenantDTO` étendu (`logoKey`, `faviconKey`) dans
       `getTenantByDomainDal`. **Tests** : `tenant-dal.test.ts` étendu (clés présentes, absentes).
       `docs/architecture.md` : la table `organization` reste exemptée, colonnes mentionnées.
3. [x] **Règles d'identité, pures et testées.** Dans `src/services/` et `src/services/types/domain/` :
       détection du format par signature, poids maximal par type (logo 1 Mo, favicon 200 Ko), génération de clé
       ADR 015 (aucun nom d'utilisateur), règle du monogramme, et **contrôle d'accès**
       `canManageAssociationIdentity(user, organizationId)` : `super_admin` global, ou rôle d'association `owner`
       ou `admin` **dans cette organisation** ; refus pour l'`admin` global sans ce rôle, un `member`, un membre d'une
       autre organisation, un anonyme. **Tests unitaires** : chaque format accepté et refusé (dont JPEG, SVG, un PNG
       renommé `.webp`, un faux PNG), limites de poids, monogrammes (« La Fourche », « ASL Les Pins », mot unique),
       matrice d'accès complète.
4. [x] **Service de remplacement.** `replaceAssociationIdentityFileService(organizationId, kind, file)` +
       façade : ordre `safeParse` → contrôle d'accès → validation du fichier → écriture sous nouvelle clé → mise à
       jour de la référence → suppression de l'ancien fichier (ADR 015). **Tests unitaires** (DAO et stockage mockés) :
       succès ; refus d'accès sans aucune écriture ; format/poids refusés sans écriture ni mise à jour ; échec de mise à
       jour de la référence → nouveau fichier supprimé, ancienne référence intacte ; échec de suppression de l'ancien
       → succès quand même, référence à jour.
5. [x] **Server Action et invalidation.** Action du segment `(bureau)` : tenant du domaine appelé
       (`requireCurrentTenantDal`), session, appel de la façade, `updateTag(TENANT_CACHE_TAG)` après succès, messages
       traduits (`getTranslations`). Erreurs rendues sous forme de résultat, jamais levées vers l'interface. **Tests
       unitaires** de l'action (patron `admin/organizations/actions.test.ts`) : refus pour un non-bureau côté serveur,
       `updateTag` appelé seulement en cas de succès, messages d'erreur format/poids.
6. [x] **Route de lecture `/api/identity/[kind]`.** `kind` validé contre `logo | favicon` (sinon 404) ; tenant par
       domaine ; clé lue dans `TenantDTO` ; flux du fichier avec `Content-Type` du format validé,
       `X-Content-Type-Options: nosniff`, cache long quand la requête porte `?v=` ; logo absent → 404 ; favicon absent
       → **monogramme SVG généré**. Domaine inconnu → 404. **Tests unitaires** du handler (tenant et stockage mockés) :
       deux tenants → deux fichiers ; `kind` inconnu ou chemin forgé (`logo/../..`, encodages) → 404 sans lecture
       disque ; favicon par défaut pour un tenant sans favicon ; en-têtes.
7. [x] **Identité affichée.** Composant `AssociationMark` (logo via la route versionnée, ou monogramme
       §1.8 : carré 44 px en public, 34 px au back-office, jamais de changement de mise en page) dans l'en-tête du
       site public (`(public)/layout.tsx`) ; `icons` de `generateMetadata` (`[locale]/layout.tsx`) vers
       `/api/identity/favicon?v=…` ; **suppression de `src/app/favicon.ico`**. **Tests de composant** : logo présent,
       monogramme sans logo, taille ; test des métadonnées (icône propre au tenant).
8. [x] **Espace bureau et page « Identité ».** Route group `(bureau)` : layout suivant le patron `(app)` (session
       derrière `<Suspense>`, jamais `await` en tête), `sidebar` du design system (groupe « L'association » › Identité,
       `sheet` sous `lg`, logo 34 px + nom) affichée **seulement** pour un utilisateur autorisé ; sinon **écran B**
       (« Cette page est réservée au bureau de l'association »). Page `bureau/identite` conforme au design :
       cartes Logo et Favicon, `file-upload` + bouton « Choisir un fichier » (bouton seul au tactile), `progress`,
       `alert` ancrée pour erreur et succès, consignes annoncées avant l'échec, aperçu dans l'onglet stylisé. Segment
       `/bureau` ajouté à `AUTHENTICATED_SEGMENTS` (`src/proxy.ts`). Libellés dans `messages/{fr,en,es}.json`.
       **Tests de composant** : quatre états par carte (vide, chargement, erreur, succès) ; écran B pour un
       non-bureau ; aucun bouton `default`.
9. [x] **Preuve de bout en bout et documentation.** Spec `e2e/association-identity.spec.ts` (fichiers de test
       générés en mémoire, aucun binaire commité) : sur `localhost`, `user-owner@gmail.com` téléverse un logo PNG →
       visible dans l'en-tête public ; un JPEG est refusé avec message et l'aperçu garde l'ancien logo ; sur
       `127.0.0.1`, `user-admin@gmail.com` (Bureau) téléverse un autre logo et un favicon → deux domaines, deux logos,
       deux favicons ; `user@gmail.com` et `admin@gmail.com` voient l'écran B sur `localhost` et l'action serveur
       directe est refusée ; `superadmin@gmail.com` accède ; `/api/identity/logo` d'un domaine ne sert jamais le fichier
       de l'autre ; la réponse porte `nosniff`. Documentation : `docs/architecture.md` (adaptateur `local` pour
       l'identité, route), `.claude/rules/01-presentation/rule-upload-file.md` (Supabase n'est plus la seule voie).
       **Vérification finale** : `pnpm lint`, `pnpm check:rules`, `pnpm test --run` verts ; e2e vert en CI sur la PR
       (pas de Chromium dans le conteneur de développement).

## Files touched

**Créés**

- `src/lib/files/storage/local-storage.ts` (+ test)
- `src/services/association-identity-service.ts` (+ façade `src/services/facades/…`, + tests)
- `src/services/types/domain/association-identity-types.ts`
- `src/services/authorization/association-identity-authorization.ts` (+ test)
- `src/app/api/identity/[kind]/route.ts` (+ test)
- `src/app/[locale]/(bureau)/layout.tsx`, `src/app/[locale]/(bureau)/bureau/identite/page.tsx`, `…/actions.ts`
  (+ test)
- `src/components/features/association/association-mark.tsx`, composants des cartes d'identité et de l'écran B
  sous `src/components/features/association/` (+ tests)
- `drizzle/migrations/0005_*.sql` et snapshot (générés)
- `e2e/association-identity.spec.ts`
- `docs/decisions/015-fichiers-identite-association.md` (déjà écrit)

**Modifiés**

- `src/lib/files/storage/types.ts`, `storage-factory.ts`, `supabase-storage.ts`, `env.ts` (stockage)
- `src/db/repositories/files-repository.ts`, `src/services/file-service.ts`, `src/app/dal/file-dal.ts` (type neutre de
  `list`)
- `src/env-schemas.ts`, `src/env.ts`, `env.example`, `.gitignore`, `.github/workflows/ci.yml`
- `src/db/models/auth-model.ts`, `src/db/repositories/organization-repository.ts`, `src/app/dal/tenant-dal.ts`
  (+ test)
- `src/app/[locale]/layout.tsx` (métadonnées `icons`), `src/app/[locale]/(public)/layout.tsx` (en-tête)
- `src/proxy.ts` (`AUTHENTICATED_SEGMENTS`)
- `messages/fr.json`, `messages/en.json`, `messages/es.json`
- `docs/architecture.md`, `.claude/rules/01-presentation/rule-upload-file.md`

**Supprimé** : `src/app/favicon.ico`

**Non touchés, volontairement** : `organization.logo` et `edit-organization-form.tsx`, flux blog et avatar,
`/admin`, dépendances Supabase.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** — le cœur de la story : adaptateur `local` sur système de fichiers
  temporaire (préfixe par organisation, chemins forgés, écriture atomique) ; règles pures (signatures binaires,
  poids, clés, monogramme) ; matrice d'accès complète ; service de remplacement et ses échecs partiels ; handler de
  la route (deux tenants, `kind` inconnu, favicon par défaut, en-têtes) ; action serveur ; composants (états,
  écran B, monogramme). Base et authentification **mockées** (rule-services-tests).
- **E2E (Playwright, en CI)** — ce que seul un navigateur et deux domaines prouvent : affichage sur le site public,
  isolation par domaine (`localhost` / `127.0.0.1`), refus d'accès en interface **et** sur l'appel direct, erreur
  qui conserve l'ancien logo, `nosniff`. Fichiers générés en mémoire.
- **Non-régression** : `file-service.test.ts`, `tenant-dal.test.ts`, `organization-*.test.ts`,
  `e2e/tenant-isolation.spec.ts`, `e2e/smoke-authenticated.spec.ts` inchangés et verts.
- **Accessibilité** (design §3.8) : focus visible, cibles ≥ 44 px (56 px mobile), un seul `h1`, aucun état porté par la
  seule couleur — vérifié sur les composants ; contraste du monogramme pour les six teintes noté pour s02.

## Definition of Done

- Les 8 critères d'acceptation sont couverts par au moins un test (unitaire ou e2e), critère 7 selon sa formulation
  réalignée.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` verts ; **CI de la PR verte, e2e compris**, sans test instable
  nouveau.
- Aucune valeur d'un client en dur ; aucun nom de fichier utilisateur dans un chemin ; aucun `withRlsBypass`
  ajouté ; `organization.logo` et les flux Supabase existants intacts.
- Migration générée, jamais éditée à la main ; `pnpm db:check` vert.
- Écran conforme à `docs/designs/s01b-logo-association.md` : composants du design system uniquement, états et
  version mobile.
- Un commit de story (plus, au besoin, un commit séparé pour la migration), qui embarque recherche, brief, design,
  plan et ADR 015 ; revue `/ks-review` passée (`Ship allowed: yes`) ; PR ouverte par `/ks-ship`.
