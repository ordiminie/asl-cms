---
validated: yes
---

# Plan — Story s07-bandeau-alerte

Branch: `feature/s07-bandeau-alerte`, à créer depuis `main` (`03277fe`).

> **Sources** :
>
> - recherche : `docs/research/s07-bandeau-alerte.md` (non commitée, voyage avec la branche) ;
> - design : `docs/designs/s07-bandeau-alerte.md` + maquette `docs/designs/s07-bandeau-alerte.html`
>   (non commités, voyagent avec la branche) ;
> - design system : `docs/design-system.md` §2.3 (bandeau à un seul niveau), §1.9 (tokens corrigés),
>   §3.9 (filet 2 px, compteur de caractères), §6.2 (impression) ;
> - règles : `rule-react-cache-next-cache.md`, `rule-safe-server-action.md`, `rule-architecture.md`,
>   `rule-services-tests.md`, `rule-form-front-and-back.md`.
>
> **Décision structurelle** : **ADR 027**
> (`docs/decisions/027-bandeau-pleine-largeur-et-barre-laterale.md`), écrit avec ce plan et voyageant
> avec la branche — voir « Décision 6 » ci-dessous.

## Target story

**En tant que** membre du bureau **je veux** activer un bandeau d'alerte sur l'ensemble du site
**afin de** prévenir immédiatement d'une coupure d'eau ou de travaux. Complexité 1, dépend de s01 et
s03b (livrées).

1. Activer le bandeau avec un message l'affiche sur toutes les pages du site existantes, publiques
   comme authentifiées.
2. Modifier le message met à jour le bandeau immédiatement, sans redéploiement.
3. Désactiver le bandeau le retire de toutes les pages.
4. N'importe quel membre du bureau peut l'activer, le modifier et le retirer, sans restriction
   supplémentaire.

Volontairement sans workflow : pas de validation, pas de programmation horaire.

## Décisions tranchées pour ce plan

Les arbitrages déjà rendus ailleurs ne sont **pas rouverts** : un seul niveau de gravité, bandeau non
refermable par le visiteur (PRD, DS §2.3, note de story du 23/09/2026) ; message conservé à la
désactivation ; page dédiée « Bandeau d'alerte » dans le groupe « Le site », icône `AlertTriangle` ;
deux boutons explicites plutôt qu'un interrupteur ; retrait sans confirmation ; texte brut, 280
caractères, sans lien ; bandeau non collant qui pousse la page.

Ce plan tranche les quatre points que le design laissait ouverts, plus deux qui en découlent.

### 1. Rôle ARIA du bandeau — `role="region"` + `aria-label`, sans `aria-live`

`<section role="region" aria-label="…">`, l'étiquette venant de `messages/fr.json`. Pas de
`role="alert"`, pas d'`aria-live` : le bandeau est présent sur **toutes** les pages, une annonce
impérative le ferait relire à chaque chargement ; le DS §2.6 réserve `aria-live="assertive"` à
l'entrée et la sortie de simulation de rôle. Effet de bord évité au passage : `e2e/auth.spec.ts`
cherche `[role="alert"]` sur les écrans de connexion (l. 100, 155, 208, 242, 272) — un bandeau actif
pendant ces specs ne peut pas fausser leurs assertions.

Corollaire pour l'écran du bureau (écart n° 6 du design) : l'`alert` de **succès** porte
`role="status"`, celle d'**échec d'enregistrement** porte `role="alert"` — c'est une réponse à une
soumission, pas un contenu permanent.

### 2. Persistance — deux clés `organization_setting`, hors registre (précédent ADR 021)

- `site.alert_message` : le texte, écrit tel quel (vide accepté et conservé).
- `site.alert_active` : `'true'` / `'false'`.

Les deux lignes sont écrites **en une seule transaction** (`saveOrganizationSettingsTxnDao`, qui
existe déjà) : jamais un message enregistré sans son état, ni l'inverse. Le message n'est **jamais
supprimé** à la désactivation — seul `site.alert_active` passe à `'false'` (état `1g` du design).

Aucune table dédiée, donc **aucune migration**, aucune ligne au « Classement RLS des 24 tables » de
`docs/architecture.md` : l'isolation repose sur la policy `tenant_isolation` de `organization_setting`
(migration `0007`), déjà forcée. L'ADR 021 prévoit explicitement ce cas (« si une future story a
besoin d'un deuxième champ de contenu simple, ce patron est le précédent à suivre ») : **pas d'ADR
pour ce point**.

Rejeté : une clé unique portant du JSON (deux valeurs scalaires indépendantes, aucune évolution de
schéma prévue, et le précédent du pied de page stocke du texte brut) ; une table dédiée (elle ne se
justifierait qu'avec `level`, `endsAt` ou un historique, tous hors périmètre).

⚠️ **s38 (export)** devra énumérer ces deux clés parmi les contenus publiés : elles sont nommées dans
`site-alert-types.ts` et citées dans la note de tâche 10.

### 3. Invalidation du cache — un tag par association, `updateTag` après succès

`siteAlertTag(organizationId) = 'site-alert:<id>'`. La lecture publique vit dans une fonction
**interne** du DAL qui prend l'identifiant en argument (`'use cache'` + `cacheLife('hours')` +
`cacheTag`), sur le patron exact de `getAssociationSettingsDal` et de `readPublicSiteNavigationCached`.
Chaque Server Action appelle `updateTag(siteAlertTag(tenant.id))` **après** le succès seulement —
`updateTag` est du read-your-writes, c'est ce que le critère 2 exige ; `revalidateTag` ne conviendrait
pas (les lecteurs verraient l'ancienne valeur pendant le rafraîchissement).

Interdits dans le scope caché, à vérifier en revue : `logger`, `new Date()`, `headers()`, `cookies()`,
`Math.random()`. `updateTag` n'est appelable que depuis une Server Action : aucun Route Handler dans
ce flux.

La lecture du bureau (l'écran d'édition) n'est **pas** cachée, comme `getSiteNavigationForBureauDal`.

La lecture publique rend `null` quand le bandeau est inactif : le message masqué ne sort pas du
serveur, et la valeur cachée ne le porte pas.

### 4. Placement — lu dans `LocaleLayout`, rendu en tête de `<body>` par `BaseLayout`

`LocaleLayout` lit le bandeau **à côté** de `getAssociationSettingsDal(tenant.id)` (un `Promise.all`),
et le passe en prop à `BaseLayout`, qui le rend en **premier enfant de `<body>`**, avant
`NextTopLoader`. C'est le seul point commun aux huit layouts : site public, connexion, `/bureau/**`,
espace membre `(app)`, `admin/**`, `docs/**`, blog hérité, `not-found` / `error` / `forbidden`.
`BaseLayout` reste un composant sans lecture de données (il reçoit une prop), comme pour la teinte.

Le critère 1 dit « toutes les pages du site existantes » : un rendu dans `BaseLayout` les couvre
toutes d'office, zones héritées comprises. `src/app/global-error.tsx` remplace le layout racine et
n'est donc pas couvert — hors critère, à noter en revue.

**Pas de `z-index` sur le bandeau** : il est dans le flux, il ne recouvre rien. L'échelle de `z-index`
reste un manque ouvert du DS §9, renvoyé à s41 ; `<ImpersonationBar />` (60) et `<PreviewBar />` (50)
ne sont pas touchées.

### 5. `print:hidden`

Le bandeau disparaît à l'impression (DS §6.2). Une classe utilitaire, vérifiée par le test de
composant.

### 6. Décision structurelle — la barre latérale passe de `fixed` à `sticky` (ADR 027)

**Problème.** `Sidebar` (`src/components/ui/sidebar.tsx:230`) ancre sa colonne desktop au viewport :
`fixed inset-y-0 z-10 h-svh`, doublée d'un `div` d'espacement en flux (l. 220) qui lui réserve sa
largeur. Un bandeau posé au-dessus du contenu est donc **recouvert à gauche** par la barre latérale
du bureau, de l'admin, de `(app)` et des docs — exactement la planche `3d` du design, barrée. La
hauteur du bandeau n'est pas connue à l'avance (message de 1 à 3 lignes en desktop, jusqu'à 7 ou 8 à
390 px), donc aucun décalage en CSS pur n'est possible.

**Décision.** La colonne desktop passe de `fixed inset-y-0 h-svh` à `sticky top-0 h-svh`, et le `div`
d'espacement disparaît (il n'existait que pour réserver la largeur d'un élément hors flux ; la
colonne, désormais en flux, la porte elle-même). Le repli `offcanvas` se fait par marge négative
animée plutôt que par `left` négatif, le repli `icon` par la même classe de largeur qu'aujourd'hui.
Sans bandeau, le rendu est identique à l'actuel. Avec bandeau, la barre commence sous le filet, puis
s'épingle en haut du viewport dès que le bandeau a défilé.

**Alternatives écartées** :

- _Coquille en colonne flex de `100svh` avec défilement interne du contenu_ (la proposition littérale
  du design, manque n° 5) — elle impose un conteneur de défilement interne à **tous** les gabarits,
  public, blog et docs hérités compris, alors que `rule-mdx-rendering.md` documente déjà la fragilité
  de l'ancrage dans les docs. Disproportionné pour une story de complexité 1.
- _Rendre le bandeau dans chaque layout de groupe_ (5 à 6 fichiers) — contraire à la lettre de la note
  de story (« le bandeau se pose dans le gabarit commun »), et tout layout ajouté plus tard l'oublie.
- _Garder `fixed` et décaler par une variable CSS_ — la hauteur du bandeau est variable ; il faudrait
  la mesurer côté client, donc un saut de mise en page à chaque chargement.
- _Bandeau `sticky` ou fixe au-dessus de la barre latérale_ — il recouvrirait la tête de la barre, ce
  que le DS §2.2 interdit explicitement (« pousse la page, ne la recouvre pas »).

**Conséquence à surveiller** : `position: sticky` est neutralisé par un ancêtre en `overflow-x: hidden`
(qui calcule `overflow-y: auto`). Le seul cas du dépôt est `src/app/[locale]/docs/layout.tsx` (l. 24 et 26) : les deux `overflow-x-hidden` passent en `overflow-x-clip`, qui ne crée pas de conteneur de
défilement. Tâche 5.

**Écart assumé au design** : le design écrit « la barre occupe la hauteur restante, pas celle de la
fenêtre ». Ici elle garde `100svh` et commence sous le bandeau : le document gagne la hauteur du
bandeau en défilement, et la barre devient entièrement visible exactement quand le bandeau sort de
l'écran. C'est le prix de ne pas convertir tout le produit au défilement interne.

## Tasks (ordered)

1. [x] **Types de domaine et validation.** `src/services/types/domain/site-alert-types.ts` :
       `SITE_ALERT_MESSAGE_SETTING_KEY`, `SITE_ALERT_ACTIVE_SETTING_KEY`, `SITE_ALERT_MAX_LENGTH = 280`,
       `SiteAlertDTO = {message: string; active: boolean}`, `PublicSiteAlertDTO = {message: string}`.
       `src/services/validation/site-alert-validation.ts` : `saveSiteAlertServiceSchema`
       (`organizationId` uuid, `message` `.trim()` ≤ 280, `active` booléen) + refus d'`active: true`
       avec un message vide (`superRefine`). Tests unitaires : 280 accepté, 281 refusé, vide + actif
       refusé, vide + inactif accepté, message conservé tel quel (espaces internes, retours à la ligne).
2. [x] **Service, façade, intercepteur, registre d'actions.** `ActionIdConst.SITE_ALERT_MANAGE =
 'site.alert.manage'` avec `defaultRoles: ['owner', 'board']` dans `ACTION_REGISTRY`.
       `src/services/site-alert-service.ts` : `getPublicSiteAlertService(organizationId)` **sans
       autorisation** (délibéré, comme `getPublicSiteNavigationService`) qui rend `null` si inactif ou
       message vide ; `getSiteAlertService(organizationId)` (autorisé) ; `saveSiteAlertService({…})`
       (`safeParse` → `canPerformAction` → écriture sous `withTenant` par
       `saveOrganizationSettingsTxnDao`, `updatedBy` = utilisateur courant) ;
       `canManageSiteAlertService(organizationId)`. Façade `site-alert-service-facade.ts` +
       `interceptors/site-alert-service-logger-interceptor.ts` (`shouldLogDetails: () => false` : le
       message est du contenu). Tests `src/services/__tests__/site-alert-service.test.ts` par rôle :
       `owner` et `board` écrivent, `member` et non-membre refusés (`AuthorizationError`, DAO **non
       appelé**), non connecté refusé, SuperAdmin passe ; lecture publique servie sans session.
3. [x] **DAL.** `src/app/dal/site-alert-dal.ts` : `siteAlertTag(organizationId)` ; lecture publique
       interne `cache()` + `'use cache'` + `cacheLife('hours')` + `cacheTag(siteAlertTag(id))`,
       exposée par `getPublicSiteAlertDal(organizationId)` ; `getSiteAlertForBureauDal(organizationId)`
       **non cachée** ; `canManageCurrentSiteAlertDal()`. Tests : forme du tag, délégation à la façade,
       absence de `logger`/horloge dans le scope caché (revue de code + test de délégation).
4. [x] **Composant `<AlertBanner />` et token `--warning-border`.**
       `src/components/ui/alert-banner.tsx` (convention shadcn du DS §2.2) : `<section role="region"
 aria-label={…}>`, pleine largeur, contenu centré `max-w-[1200px]`, gouttière du gabarit, fond
       `warning`, texte `warning-foreground`, **filet bas 2 px `warning-border`**, icône
       `AlertTriangle` 20 px, « Alerte&nbsp;: » en `body-strong` puis le message, `text-wrap: pretty`,
       jamais tronqué, `print:hidden`, aucun rayon ni ombre, **aucun élément interactif**. Le message
       est rendu en **nœud texte React** — jamais `dangerouslySetInnerHTML`. Dans le même geste :
       corriger `--warning-border` clair dans `src/app/globals.css`
       (`oklch(0.72 0.12 70)` → `oklch(0.6 0.13 65)`, DS §1.9), laisser le trio sombre **inchangé**, et
       regarder l'encart ambré de
       `src/components/features/admin/organizations/provision-organization-form.tsx`, seul autre
       consommateur du token. Tests de composant : rôle et étiquette, texte rendu à l'identique (y
       compris `<script>` inoffensif), classes de tokens, `print:hidden`, absence de `role="alert"` et
       d'`aria-live` ; test de garde sur la valeur du token dans `globals.css`.
5. [x] **Place du bandeau dans les gabarits à barre latérale.** `src/components/ui/sidebar.tsx` :
       colonne desktop `fixed inset-y-0 h-svh` → `sticky top-0 h-svh`, suppression du `div`
       d'espacement, repli `offcanvas` par marge négative animée, repli `icon` inchangé ; mobile
       (`Sheet`) non touché. `src/app/[locale]/docs/layout.tsx` : `overflow-x-hidden` →
       `overflow-x-clip` (l. 24 et 26), sans quoi `sticky` est neutralisé. Vérifications : les tests
       unitaires existants des quatre gabarits passent, `pnpm test --run` vert, et la spec e2e
       `mobile.spec.ts` (tiroir) ainsi que les parcours bureau/admin restent verts.
6. [x] **Lecture et rendu dans le gabarit commun.** `LocaleLayout` : `Promise.all` de
       `getAssociationSettingsDal(tenant.id)` et `getPublicSiteAlertDal(tenant.id)`, prop `alert`
       passée à `BaseLayout` ; `BaseLayout` rend `<AlertBanner />` en premier enfant de `<body>` quand
       la prop est fournie. **Ajouter le mock de `@/app/dal/site-alert-dal` dans
       `src/app/[locale]/layout-accent-hue.test.ts`** (ces tests mockent chaque DAL explicitement, tout
       nouvel import les casse) et vérifier `base-layout.test.tsx` et `layout-metadata.test.ts`.
       Nouveaux tests : la prop est passée quand le bandeau est actif, absente sinon ; `BaseLayout`
       rend le bandeau avant `NextTopLoader` et ne le rend pas sans prop.
7. [x] **Server Actions du bureau.** `src/app/[locale]/(bureau)/bureau/alerte/actions.ts` :
       `saveSiteAlertAction(message, active)` et `removeSiteAlertAction()` — chacune
       `requireCurrentTenantDal()` → `requireActionAuth()` → façade → `updateTag(siteAlertTag(tenant.id))`
       **après succès**, refus et échec rendus comme un résultat traduit (`BureauAlertPage.errors`),
       jamais levés. Tests `actions.test.ts` sur le patron de
       `bureau/navigation/actions.test.ts` : succès invalide le tag, refus d'autorisation n'invalide
       rien et rend le message traduit, erreur de validation rendue au champ.
8. [x] **Écran du bureau.** `src/app/[locale]/(bureau)/bureau/alerte/page.tsx` (RSC : `Suspense`,
       contrôle d'accès rejoué par `canManageCurrentSiteAlertDal`, `BureauAccessDenied` sinon,
       `generateMetadata`) et `src/components/features/association/site-alert-form.tsx` (client) :
       carte « Message » (`label` visible, `textarea` 4 lignes / 6 en mobile, consigne écrite avant
       tout échec, compteur `n / 280` en `tabular-nums`, `muted-foreground` jusqu'à 280 inclus puis
       `--destructive-text` en 600 + bordure 2 px + **message écrit** « N caractères de trop. »),
       ligne d'état sous la carte, carte « Aperçu » rendant le vrai `<AlertBanner />`, un seul bouton
       `default` dont le libellé suit l'état, « Retirer le bandeau » en `outline` seulement quand le
       bandeau est affiché, `alert` ancrées (succès `role="status"`, échec `role="alert"`), jamais de
       toast. Entrée « Bandeau d'alerte » (`AlertTriangle`) **en dernière position du groupe
       « Le site »** de `bureau-sidebar.tsx` ; libellés dans `messages/fr.json`, `en.json`, `es.json`
       (aucune chaîne en dur : titre, consigne, libellés des boutons, étiquette ARIA du bandeau,
       « Alerte&nbsp;: », messages d'erreur). Tests de composant sur les sept états du design
       (`1a` à `1g`) + test de la barre latérale (entrée présente, ordre, item actif).
9. [x] **e2e `e2e/site-alert.spec.ts`** sur le patron de `site-navigation.spec.ts` : un membre
       **`board`** de Marketing Pro (`user-admin@gmail.com`, tenant B `127.0.0.1`) active le bandeau
       avec un message unique (critère 4) ; il apparaît sur une page publique **et** sur une page
       authentifiée du même tenant, chargées par `goto` (critère 1) ; modifier le message le met à
       jour sans redémarrage (critère 2, la preuve du `updateTag` — invisible en `pnpm dev`, cache
       froid) ; « Retirer le bandeau » le fait disparaître partout et le message reste dans le champ
       (critère 3) ; il n'apparaît **jamais** sur TechCorp (`localhost`, isolation croisée) ; un membre
       simple (`user@gmail.com` sur TechCorp) ne voit pas l'écran. **Nettoyage obligatoire** : le
       bandeau est global au tenant et `fullyParallel` est actif en local — désactivation dans un
       `finally` / `afterEach`, jamais de dépendance à l'ordre d'exécution.
10. [x] **Documentation.** Enregistrer dans `docs/design-system.md` §2.3 l'écart assumé du manque
        n° 3 (« trois lignes maximum en mobile » incompatible avec 280 caractères non refermables : le
        message est affiché en entier) et, au même endroit, le rôle ARIA retenu (manque n° 4) ainsi
        que la règle de placement retenue (manque n° 5, dans sa forme réellement implémentée). Citer
        les deux clés `organization_setting` dans la note de s38 (`docs/stories.md`) ou dans
        `site-alert-types.ts` pour que l'export sache les énumérer. L'ADR 027 est déjà écrit et
        voyage avec la branche.

## Files touched

**Créés**

- `src/services/types/domain/site-alert-types.ts`
- `src/services/validation/site-alert-validation.ts` (+ `.test.ts`)
- `src/services/site-alert-service.ts`
- `src/services/facades/site-alert-service-facade.ts`
- `src/services/facades/interceptors/site-alert-service-logger-interceptor.ts`
- `src/services/__tests__/site-alert-service.test.ts`
- `src/app/dal/site-alert-dal.ts` (+ `.test.ts`)
- `src/components/ui/alert-banner.tsx` (+ `.test.tsx`)
- `src/components/features/association/site-alert-form.tsx` (+ `.test.tsx`)
- `src/app/[locale]/(bureau)/bureau/alerte/page.tsx`, `actions.ts` (+ tests)
- `e2e/site-alert.spec.ts`
- `docs/decisions/027-bandeau-pleine-largeur-et-barre-laterale.md` (déjà écrit)

**Modifiés**

- `src/services/types/domain/action-registry-types.ts` (une entrée)
- `src/app/[locale]/layout.tsx`, `src/app/[locale]/base-layout.tsx`
- `src/app/[locale]/layout-accent-hue.test.ts` (mock du nouveau DAL), `base-layout.test.tsx`
- `src/components/ui/sidebar.tsx`, `src/app/[locale]/docs/layout.tsx`
- `src/app/globals.css` (token `--warning-border` clair)
- `src/components/features/association/bureau-sidebar.tsx` (+ son test)
- `messages/fr.json`, `messages/en.json`, `messages/es.json`
- `docs/design-system.md` (§2.3), `docs/stories.md` (note s38) — tâche 10

**Non touchés, délibérément** : `drizzle/` (aucune migration), `docs/architecture.md` §« Classement
RLS » (aucune table nouvelle), `src/components/ui/alert.tsx` (l'`alert` ancrée dans la page reste ce
qu'elle est), `src/proxy.ts`.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** — validation (bornes, message requis si actif) ; service
  par rôle sur le patron `rule-services-tests.md` (ADMIN/USER/PUBLIC + `owner`, `board`, `member`,
  non-membre, SuperAdmin), avec vérification que le DAO **n'est pas appelé** en cas de refus ; DAL
  (tag, délégation) ; composant `<AlertBanner />` (rôle, étiquette, texte brut, tokens, impression) ;
  formulaire du bureau (sept états, compteur, libellés des boutons) ; gabarits (prop passée, bandeau
  rendu / absent) ; Server Actions (invalidation après succès uniquement, refus traduit).
  La RLS n'est pas testable en unitaire (`db.ts` refuse toute connexion en test) : les repositories
  sont mockés.
- **e2e (Playwright, build de production)** — critères 1 à 4 de bout en bout et isolation croisée
  entre deux tenants ; c'est le seul endroit où l'oubli de `updateTag` se voit.
- **Non-régression** — `mobile.spec.ts`, `smoke-authenticated.spec.ts`, `authorization.spec.ts`,
  `site-navigation.spec.ts`, `news.spec.ts` et `auth.spec.ts` doivent rester verts après la tâche 5
  (barre latérale) : c'est la tâche la plus risquée du lot.
- Pas de `pnpm build` en vérification finale (règle du dépôt).

## Pièges à garder sous les yeux

1. Les tests unitaires des gabarits **mockent chaque DAL explicitement** : tout nouvel import y casse
   la suite tant que le mock n'est pas ajouté (tâche 6).
2. Le bandeau est **global au tenant** ; les specs e2e tournent en parallèle en local. Désactiver en
   `finally`.
3. `e2e/auth.spec.ts` cherche `[role="alert"]` — raison de plus pour `role="region"`.
4. Le rôle `board` avec un domaine n'existe **que sur Marketing Pro** (`127.0.0.1`) : TechCorp n'a
   qu'un `owner`. Le critère 4 se prouve sur le tenant B.
5. `updateTag` ne s'appelle que depuis une Server Action.
6. Le bandeau vit dans le layout racine : une navigation cliente (`<Link>`) ne re-rend pas les layouts
   partagés et `staleTimes.dynamic = 30` — l'e2e charge les pages par `goto`.
7. Voisinage : s06, s08 et s09 touchent aussi `action-registry-types.ts`, `bureau-sidebar.tsx` et
   `messages/*.json`. Fusions attendues, sans recouvrement fonctionnel ; l'ordre final des entrées de
   la barre latérale se règle au merge.
8. Une valeur en dur (adresse, texte, seuil) est un échec de revue : tout libellé va dans
   `messages/*.json`, le plafond de 280 est une constante nommée du domaine.

## Definition of Done

- Une seule PR depuis `feature/s07-bandeau-alerte`, un seul commit de story portant la recherche, le
  design et ce plan, cases du plan cochées.
- Les quatre critères sont prouvés : trois par l'e2e, le quatrième par l'e2e (rôle `board`) **et** les
  tests de service par rôle.
- Isolation multi-tenant prouvée par un accès croisé entre deux tenants.
- Action déclarée au registre d'actions.
- `pnpm test --run` et `pnpm lint` verts ; `pnpm test:e2e --project=chromium` vert, suite existante
  comprise.
- Aucune valeur en dur, aucun `withRlsBypass`, aucune migration.
- Revue passée (`docs/reviews/s07-bandeau-alerte.md`, `Ship allowed: yes`) avant `/ks-ship`.

## Arbitrages rendus le 25/09/2026

Tranchés par la propriétaire avant validation ; tous conformes aux propositions du plan.

1. **`src/components/ui/sidebar.tsx` est modifié** (`fixed` → `sticky`, ADR 027) : le bandeau passe
   au-dessus de toute la page, barre latérale comprise, conformément à l'écran 3 du design.
2. **La barre latérale garde `100svh`** et commence sous le bandeau — écart au design assumé.
3. **`docs/design-system.md` §2.3 est complété dans la branche s07** (tâche 10 maintenue).
4. **Route : `/bureau/alerte`.**
