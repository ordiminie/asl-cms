# Research — Story s001-affiliate-system

> ⚠️ Hors pipeline killer-saas : `docs/stories.md` et `docs/prd.md` n'existent pas encore.
> Ce sujet n'a pas passé `/ks-stories-review` — il n'est rattaché à aucun périmètre PRD validé.
>
> Sources : exploration du code au commit `41c217e` (4 agents, ~500k tokens) + état de l'art
> externe daté d'août 2026. Les schémas de Dub, RefRef et `@better-auth/stripe` ont été lus
> dans les sources, pas cités de mémoire.
>
> **Ancres revérifiées au commit `0039ee6`** (après la migration Cache Components, 156 fichiers
> modifiés depuis la baseline). Seul `src/proxy.ts` a bougé parmi les fichiers cités ; les
> références ci-dessous tiennent compte du décalage.

## Target story

Doter le boilerplate d'un **système d'affiliation simple mais fiable** : un utilisateur partage
`https://app.com?ref=son-code`, et touche une commission quand une organisation qu'il a amenée
devient cliente payante.

Origine : `ROADMAP.md:48` — « Admin - Affiliates : Affiliate program management / Commission
tracking / Affiliate dashboard ». Rien n'a été commencé.

Critères d'acceptation proposés (à valider au PRD) :

1. Un utilisateur peut créer un code de parrainage unique depuis son compte et obtenir son lien.
2. Un visiteur arrivant par ce lien, qui crée un compte puis une organisation, est attribué à cet
   affilié — l'attribution est **figée** et ne change plus.
3. Une commission est créée **une seule fois par facture Stripe réellement payée**, jamais sur un
   essai gratuit, jamais deux fois même en cas de rejeu du webhook.
4. Une commission n'est payable qu'après un **délai de carence** couvrant la politique de
   remboursement ; un remboursement avant paiement l'annule, après paiement crée une ligne négative.
5. L'auto-parrainage est détecté et ne produit pas de commission.
6. Un admin voit les commissions dues, déclenche le virement hors application, et l'enregistre —
   l'enregistrement est **immuable et idempotent**.

## Current state of the code

### Rien n'existe

`grep -ril "affiliat|referral|parrain" src/` → **0 résultat**. Les seules occurrences dans le repo
sont `ROADMAP.md:48` et deux mentions marketing dans `docs/stripe-better-auth-integration.md:406`
et `:582`.

### Le fait décisif : l'abonnement est rattaché à l'ORGANISATION

C'est la contrainte qui détermine tout le modèle de données.

| Preuve | Fichier:ligne |
| --- | --- |
| `NEXT_PUBLIC_BILLING_MODE` par défaut `organization` | `src/env-schemas.ts:166-168` |
| `.env` d'exemple confirme | `env.example:41` |
| `getReferenceIdByBillingMode(userId, organizationId)` | `src/lib/helper/subscription-helper.ts:6-15` |
| En mode ORG, `getBillingReferenceId()` prend l'org dont le rôle est `owner` | `src/services/subscription-service.ts:373-416` (`:401`) |
| Les crédits font déjà `getOrganizationByIdDao(subscription.referenceId)` | `src/services/credit-service.ts:628-634` |

`subscription.referenceId` (`src/db/models/subscription-model.ts:55`) est donc une colonne
**polymorphe** : organizationId par défaut, userId si le mode bascule. Le commentaire `// userId`
en face est obsolète et trompeur.

**Conséquence** : le sujet attribué doit être l'**organisation** (l'entité facturée), le
bénéficiaire de la commission étant un **user**. C'est exactement le découpage de la doc Lumail
fournie en entrée (« The ref belongs to the user », « the final attribution is stored on the created
organization »).

### Il n'y a aucun onboarding

Aucune route `onboarding`, `welcome` ou `setup` dans `src/app/[locale]/**`. L'organisation est créée
**silencieusement, côté serveur, à la création de l'utilisateur** :

```
databaseHooks.user.create.after            src/lib/better-auth/auth.ts:364-381
  └─ initializeRegisterUserDataService()   src/services/user-service.ts:211-271
       └─ createOrganizationForUserService()  src/services/user-service.ts:117-163   (si 0 org)
            └─ createUserRoleAndOrganizationTxnDao()  src/db/repositories/user-repository.ts:194-236
                 └─ INSERT organization + INSERT member(role='owner')   [transaction]
```

L'écran « How did you hear about us? » de la doc Lumail n'a donc **aucun endroit où se poser**.
C'est une décision de périmètre, pas un détail d'implémentation (voir Options, O3).

### L'infrastructure de fond existe déjà

- **Inngest** est branché : `src/lib/inngest/{inngest,events,functions}.ts`, route
  `src/app/api/inngest/route.ts`. Il y a déjà un **cron quotidien idempotent** —
  `reconcileNegativeCreditBalances`, `triggers: {cron: '0 4 * * *'}`, `retries: 2`
  (`src/lib/inngest/functions.ts:78-95`). C'est le modèle exact du job de maturation des commissions.
- **Le ledger de crédits** (`credit-ledger`) est le template du ledger de commissions : append-only,
  index unique partiel de déduplication, advisory locks, transactions.

## Anchor points

### A1 — Pose du cookie : `src/proxy.ts`

C'est le middleware (il n'y a pas de `src/middleware.ts`). `searchParams` est **déjà déstructuré**
ligne 37, et il existe un bloc d'écriture de cookie à copier tel quel (guardé par
`if (!request.cookies.get('theme'))` — le même garde donne le comportement first-touch) :

```ts
// src/proxy.ts:94-100 — le seul Set-Cookie du projet
response.cookies.set('theme', theme, {
  path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false,
  secure: request.nextUrl.protocol === 'https:', sameSite: 'lax',
})
```

Le `matcher` (`src/proxy.ts:106-118`) couvre `/`, `/fr`, `/pricing`, `/register`… donc un `?ref=`
sur n'importe quelle page publique est interceptable. **Mais `/api/*` est exclu** : le callback OAuth
Google (`/api/auth/callback/google`) ne traverse pas le proxy — le cookie doit être posé avant.

### A2 — Attribution : `databaseHooks.user.create.after`

`src/lib/better-auth/auth.ts:364-381`. Couvre credential, OAuth **et** magic link. La signature
réelle en Better Auth 1.6.23 est `toRun(created, context)` — le second argument `context`
(`GenericEndpointContext`, accès `ctx.request` / `ctx.headers` / `ctx.body`) **n'est pas déclaré
aujourd'hui** et est disponible gratuitement.

Alternative équivalente : `initializeRegisterUserDataService` (`src/services/user-service.ts:211`)
juste après `createOrganizationForUserService` (`:267`), qui retourne
`{user, organizationId, organizationSlug}` — et qui est déjà dans un contexte de requête puisqu'il
appelle `getLocale()`.

### A3 — Déclenchement des commissions : les hooks Better Auth Stripe

`src/lib/better-auth/auth.ts:206-323`. C'est là que `credit-service` se branche déjà, avec la même
forme de payload :

| Hook | Ligne | Usage pour l'affiliation |
| --- | --- | --- |
| `onSubscriptionComplete` | `:214-241` | première conversion |
| `onSubscriptionUpdate` | `:242-270` | renouvellement / upgrade |
| `onSubscriptionDeleted` | `:288-320` | arrêt de la récurrence |
| `onEvent: onStripeEvent` | `:322` → `src/lib/stripe/stripe-events.ts:25-150` | `invoice.paid`, remboursements, litiges |

**Le montant réellement encaissé n'existe que sur l'`invoice`**, pas dans les payloads des hooks
Better Auth. Une commission calculée sur le prix du plan ignorerait remises, proration et taxes :
il faut passer par `invoice.paid` dans `onEvent`.

### A4 — Persistance : nouveau modèle

`src/db/models/affiliate-model.ts`, enregistré dans `src/db/models/db.ts:29-42` (import + spread).
`drizzle.config.ts:9` pointe `./src/db/models/*`, un nouveau fichier est donc pris automatiquement.

### A5 — Pages

- Utilisateur : `src/app/[locale]/(app)/account/affiliate/` sur le modèle de
  `account/billing/credit/` (`page.tsx` + `actions.ts` + `*-content.tsx` + `*-skeleton.tsx`).
- Admin : `src/app/[locale]/admin/affiliates/` sur le modèle de `admin/organizations/`.
- Menus : `src/components/features/layouts/sidebar/nav-application.tsx:43-73` et `nav-admin.tsx:41-68`.

## Verified APIs / functions

### Better Auth Stripe — signatures réelles lues dans les sources

`packages/stripe/src/types.ts` (better-auth 1.6.23) :

```ts
getCheckoutSessionParams?: (
  data: {user; session; plan: StripePlan; subscription: Subscription},
  req: GenericEndpointContext['request'],
  ctx: GenericEndpointContext,
) => Promise<{params?: Stripe.Checkout.SessionCreateParams; options?: Stripe.RequestOptions}>

onSubscriptionComplete?: (
  data: {event: Stripe.Event; stripeSubscription: Stripe.Subscription; subscription: Subscription; plan: StripePlan},
  ctx: GenericEndpointContext,
) => Promise<void>
```

### ⚠️ `@better-auth/stripe` confisque `client_reference_id`

Dans `upgradeSubscription` (`packages/stripe/src/routes.ts`), le champ est **explicitement
déstructuré hors** des params fournis, puis réécrit :

```js
const {mode: _mode, customer: _customer, /* … */ client_reference_id: _client_reference_id,
       ...additionalParams} = params?.params ?? {}

await client.checkout.sessions.create({
  ...additionalParams,
  client_reference_id: referenceId,          // TOUJOURS le referenceId Better Auth
  subscription_data: {..., metadata: subscriptionMetadata.set({userId, subscriptionId, referenceId}, ctx.body.metadata, additionalParams.metadata)},
  metadata: subscriptionMetadata.set({userId, subscriptionId, referenceId}, ctx.body.metadata, additionalParams.metadata),
})
```

Deux conséquences :

1. **L'intégration canonique de Rewardful est incompatible** avec `subscription.upgrade()` — c'est
   précisément `client_reference_id` qu'elle utilise. Son seul point d'entrée restant serait la
   metadata `referral` sur le **Customer** Stripe, via `getCustomerCreateParams`.
2. **Les metadata, elles, sont fusionnées** (`additionalParams.metadata` et `ctx.body.metadata`) dans
   la session *et* dans `subscription_data.metadata`. C'est donc le canal à utiliser.

### Repository crédits — les patterns à copier littéralement

`src/db/repositories/credit-ledger-repository.ts` :

- **Index unique partiel** de déduplication : `src/db/models/credit-ledger-model.ts:47-58`.
- **Prédicat rejoué pour `ON CONFLICT`** (`:20-23`) — sans lui Postgres renvoie `42P10` :
  ```ts
  const sourceDedupIndexPredicate = sql`${creditLedger.sourceId} IS NOT NULL AND ${creditLedger.source} IN ('pack','system_adjustment','refund')`
  ```
- **Advisory lock transactionnel** (`consumeCreditsTxnDao:194-239`) :
  ```ts
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('credit_consume:' || ${organizationId}))`)
  ```
- **Idempotence webhook** (`addPackCreditsTxnDao:330-378`) : `onConflictDoNothing({target, where})`
  puis, si `returning()` est vide, relecture de la ligne existante **dans la même transaction**.

### Squelette de service imposé

`src/services/credit-service.ts:404-435` — ordre invariant **Zod → CASL → logger → DAO** :

```ts
const parsed = grantCreditsServiceSchema.safeParse({...})
if (!parsed.success) throw new ValidationError(parsed.error.message)
const canGrant = await canGrantCredits()
if (!canGrant) throw new AuthorizationError('…')
logger.info('…', {...})
return grantCreditsTxnDao({...})
```

### Autorisation — la variante à copier

`src/services/authorization/credit-authorization.ts:13-36` (scoping organisation + court-circuit
admin global). Il faudra ajouter `'Affiliate'` dans `Subjects` **et** `SubjectsConst`
(`src/services/authorization/casl-abilities.ts:16-30` et `:40-55`), puis les `can()` dans
`buildAdminAbilities:87` et `buildOrganizationalAbilities:218`.

## Traps & constraints

### T1 — `trialing` est traité comme « actif » partout

`status IN ('active','trialing')` est en dur dans tout `subscription-repository.ts`
(`:106-109`, `:126-130`, `:153-157`, `:528-532`). Or **un essai ne doit jamais produire de
commission**. Pire, côté Stripe, `checkout.session.payment_status` vaut `'paid'` pour une facture
d'essai à 0 €.

→ Règle non négociable : commission **uniquement** sur `invoice.paid` **ET** `amount_paid > 0`.

### T2 — Quatre chemins morts à ne pas brancher

| Chemin | État |
| --- | --- |
| `src/app/api/webhooks/stripe/route.ts` | `const disableWebhook = true` (`:76`) → HTTP **410** (`:79-88`), tout le fichier est inatteignable |
| `handleFullCheckoutSessionCompleted` | `src/lib/stripe/stripe-events.ts:428`, appel commenté `:90` |
| `handleInvoicePaidCreditAllocation` | `src/lib/stripe/stripe-events.ts:805`, `@deprecated` `:803` |
| `createSubscriptionFromStripeService` | `src/services/subscription-service.ts:143` — écrit `referenceId: user.id` en dur (`:200-209`), incohérent avec le reste |

Le vrai point d'entrée webhook est **`POST /api/auth/stripe/webhook`**, servi par le catch-all
Better Auth (`src/app/api/auth/[...all]/route.ts:1-4`, cf. `package.json:34`).

### T3 — `organizationHooks.afterCreateOrganization` ne se déclenche jamais

`src/lib/better-auth/auth.ts:177` : `allowUserToCreateOrganization: false`. Le projet n'appelle
jamais `POST /organization/create`. Les organisations d'inscription sont insérées en **Drizzle brut**
hors adapter Better Auth (`user-repository.ts:194`). Ce hook — qui serait le point d'accroche
« naturel » — est donc inerte ici.

### T4 — Divergence existante entre metadata Stripe et DB

`createCheckoutMetadata` (`src/components/features/checkout-stripe/checkout-stripe-util.ts:157-167`)
pose `metadata.referenceId = user.id`, alors que la ligne DB est créée avec le referenceId issu de
`getBillingContext()` (= organizationId). **Ne pas s'appuyer sur cette metadata pour l'attribution.**
Résoudre depuis la DB.

### T5 — Aucune contrainte d'unicité sur `subscription`

L'index unique `(stripeCustomerId, plan)` est **commenté** (`src/db/models/subscription-model.ts:70-75`).
Le code s'en plaint déjà : `logger.warn('Multiple subscriptions found for referenceId')`
(`src/services/authorization/subscription-authorization.ts:117-119`). Plusieurs lignes `active` pour
un même `referenceId` sont donc possibles → l'idempotence doit venir de **l'invoice**, jamais de la
subscription.

### T6 — Cache Components : le `?ref=` ne doit jamais remonter dans une page

`next.config.ts:36` : `cacheComponents: true`. La home (`src/app/[locale]/page.tsx:37-44`)
**n'accepte pas `searchParams`** et se prerende (`generateStaticParams` `:18-20`). Un `?ref=` ne
casse donc rien — **à condition de ne jamais lire le ref dans un composant de page**. La lecture doit
rester confinée au proxy et aux Server Actions. Ajouter `searchParams` à `Home()` basculerait la page
en dynamique.

De même, `cookies()` n'est lisible que hors scope `'use cache'` — cf. le commentaire normatif
`src/app/dal/user-dal.ts:127-144`.

### T7 — Les montants du repo sont des `decimal`, pas des entiers

`credit_ledger.amount` et `subscription_plan.price` sont en `decimal(10,2)`, donc lus/écrits en
`string` (`String(-Math.abs(amount))` puis `Number(row.amount)`). **Ne pas suivre ce précédent pour
le ledger de commissions** : des cents en `integer` suppriment une classe entière de litiges
d'arrondi. C'est une divergence assumée à documenter.

### T8 — Interdiction d'écrire du SQL de migration à la main

`CLAUDE.md:113-119`. L'index unique **partiel** de déduplication ne peut pas être exprimé par
`db:generate` seul : il faut `drizzle-kit generate --custom`, exactement comme
`drizzle/migrations/0002_credit_ledger_dedup_index.sql`.

### T9 — Bugs connus de `databaseHooks.user.create.after`

Issues ouvertes sur better-auth, à vérifier avant de s'y fier :
[#4614](https://github.com/better-auth/better-auth/issues/4614) (user absent en base dans le hook),
[#7260](https://github.com/better-auth/better-auth/issues/7260) (violation de FK en social login avec
transaction), [#4718](https://github.com/better-auth/better-auth/issues/4718).
Le hook est exécuté via `queueAfterTransactionHook`, donc après commit.

### T10 — La façade n'exporte pas tout

`src/services/facades/subscription-service-facade.ts` n'expose pas
`checkSubscriptionLimitService`, `getActiveSubscriptionsByUserIdService`, `getBillingReferenceId`…
Or une règle ESLint `no-restricted-imports` interdit d'importer `@/services/*-service` directement
depuis la présentation. Il faudra compléter les ré-exports.

## Options

### O1 — Modèle de commission

| | Bounty forfaitaire | % récurrent |
| --- | --- | --- |
| Exemple | 50 € une fois par org Creator | 20 % de chaque facture, 12 mois |
| Prévisibilité coût | totale | variable |
| Complexité ledger | 1 ligne par org | N lignes par org, sur des années |
| C'est ce que fait ta doc Lumail | **oui** | non |

**Recommandation : bounty forfaitaire par plan en v1**, avec le champ `max_months` déjà présent en
base pour ouvrir le récurrent plus tard sans migration. C'est le modèle de ta doc d'exemple, et c'est
celui dont le ledger est le plus facile à prouver juste.

### O2 — Délai de carence

La règle du métier est : **`hold_days >= durée de ta politique de remboursement`**. Rewardful
recommande explicitement d'aligner les deux ; Dub propose 0/14/30/60/90 avec 30 comme défaut ;
Fathom fait 30 jours après paiement.

Ta doc Lumail utilise **2 mois pour Creator/Pro et 0 pour Business**. C'est cohérent (un panier plus
gros justifie moins d'attente… ce qui est en réalité l'inverse du risque). À trancher au PRD ; le
champ est par affilié/programme de toute façon.

### O3 — L'écran « qui vous a parlé de nous ? »

- **O3a — On s'en passe (v1)** : l'attribution vient du cookie seul. Zéro écran à construire, mais
  aucun rattrapage possible quand le cookie a été perdu (cross-device, bloqueur, lien partagé).
- **O3b — On ajoute un onboarding** : c'est un chantier à part entière (aucune route n'existe), mais
  c'est le seul mécanisme qui corrige une attribution périmée et qui capte l'acquisition déclarée.

**Recommandation : O3a en v1**, en notant que O3b est le complément naturel et qu'il faudra de toute
façon un onboarding un jour.

### O4 — Canal d'attribution secondaire (codes promo Stripe)

Un code promo par affilié (`promotion_code` Stripe) est le **seul** canal qui survit aux bloqueurs de
pub, à Safari, au cross-device, au podcast et à la vidéo YouTube. Dub le modélise avec un
`DiscountCode` 1:1 avec le lien de tracking, et **synthétise un faux clic** pour que le reste du
pipeline reste uniforme.

Limites Stripe à connaître : un seul coupon par client (donc pas de cumul avec une promo
commerciale), un seul `discounts[]` par session, et sur le webhook on reçoit un id `promo_xxx`, pas
le code lisible — il faut un `promotionCodes.retrieve()`.

**Recommandation : hors v1**, mais le modèle de données doit prévoir `source` sur l'attribution
(`cookie | promo_code | manual`) pour ne pas avoir à migrer.

### O5 — Payouts

| | Manuel + enregistrement | Stripe Connect |
| --- | --- | --- |
| KYC | aucun | onboarding complet par affilié |
| Coût | 0 | 0,25 % cross-border, Express **déprécié** au profit d'Accounts v2 |
| Suffit jusqu'à | Fathom a payé 100 k$+ comme ça | au-delà |

**Recommandation : manuel en v1**, exactement comme ta doc Lumail (« The dashboard records the amount
due, but it does not automatically send money »). Ce qui compte n'est pas d'automatiser le virement,
c'est que **l'enregistrement du paiement soit immuable et idempotent**.

### O6 — Récompense en cash ou en crédit produit ? (la décision la plus sous-estimée)

C'est le point qui évite le plus gros risque juridique, et il tombe particulièrement bien ici parce
que **le ledger de crédits existe déjà**.

| | Referral client → client | Affiliation professionnelle |
| --- | --- | --- |
| Récompense | **crédit produit** (`grantCreditsTxnDao`) | **cash** |
| Facture | aucune | obligatoire (SIRET) |
| TVA / DAS2 / KYC | hors sujet | à traiter |
| Friction d'entrée | nulle | inscription au programme |
| Coût réel | marge, pas trésorerie | trésorerie |

Un particulier qui perçoit des commissions de façon habituelle exerce une activité commerciale et
devrait être immatriculé — il ne peut donc pas vous fournir de facture conforme. Payer un client
satisfait **en crédit d'abonnement** supprime d'un coup facture, TVA, DAS2 et vérification
d'identité. C'est le pattern dominant des programmes B2B (« deux mois offerts », « $500 account
credit »).

**Recommandation : porter les deux dans le même modèle** via `affiliate.type` (`customer` |
`professional`) et `payout_method` (`credit` | `cash`), et n'implémenter que la branche `credit` en
v1 — elle réutilise `credit-service` intégralement et ne demande aucune paperasse. La branche `cash`
arrive quand un vrai partenaire professionnel se présente.

## Recommandation

### Le modèle minimal

Quatre tables, sur le modèle de `credit-ledger-model.ts`, montants en **cents entiers** :

```
affiliate            user_id UNIQUE, status(pending|approved|suspended|banned),
                     -- snapshot des conditions à l'approbation :
                     commission_type, commission_flat_cents, commission_rate,
                     max_months, hold_days,
                     payout_method, payout_details(jsonb chiffré), legal_name, country, vat_id

affiliate_link       affiliate_id, code UNIQUE, label, revoked_at
                     -- N codes par affilié, jamais supprimés : révoqués

referral             affiliate_id, affiliate_link_id,
                     organization_id UNIQUE,        -- une attribution par entité facturée, à jamais
                     user_id, source(cookie|promo_code|manual),
                     status(active|self_referral|voided),
                     locked_at NOT NULL,            -- l'attribution est figée ici
                     expires_at                     -- null = à vie

affiliate_commission  -- APPEND-ONLY
                     affiliate_id, referral_id,
                     type(sale|bounty|clawback|adjustment),
                     source_type, source_id,        -- = stripe invoice id
                     base_amount_cents, currency, rate_applied, earnings_cents (SIGNÉ),
                     status(pending|approved|paid|refunded|voided),
                     matures_at NOT NULL,           -- matérialisé à l'insertion
                     parent_commission_id, payout_id,
                     UNIQUE(affiliate_id, source_type, source_id) WHERE type='sale'

affiliate_payout      -- immuable une fois payé
                     affiliate_id, period, currency, gross/adjustments/net_amount_cents,
                     method, external_reference, status, initiated_by_user_id,
                     affiliate_snapshot(jsonb)      -- identité légale AU MOMENT du paiement
```

### Les huit invariants qui font la fiabilité

1. **L'attribution vit sur une ligne en base, pas dans un cookie.** Le cookie n'est qu'un transport,
   supprimé dès l'attribution figée.
2. **Cookie `__Host-` préfixé, HttpOnly, posé par le serveur** sur l'apex. Un cookie posé en JS peut
   être ramené à 24 h par Safari sur un lien avec query param venant d'un domaine classé tracker.
3. **Une commission par facture Stripe**, garantie par l'index unique partiel — pas par la logique
   applicative.
4. **Commission créée uniquement sur `invoice.paid` avec `amount_paid > 0`** (T1).
5. **Base = `total_excluding_tax`** (net de remises, hors taxes), snapshotée avec le taux appliqué.
6. **`matures_at` matérialisé à l'insertion** : changer le programme demain ne réécrit pas l'histoire.
7. **Append-only après paiement.** Une correction est une ligne négative (`clawback`), jamais un
   `UPDATE`.
8. **Idempotence à deux niveaux** : `stripe_event_id` global + clé métier `invoice.id`, et aucune
   décision ne dépend de l'ordre d'arrivée des événements (Stripe ne le garantit pas).

### Le flux

```
1. GET /r/:code                      → valide, logge le clic (ip hashée), pose le cookie signé
   (route handler, pas le proxy       si absent [FIRST-TOUCH], redirige en strippant le param
    si on veut logger le clic)

2. user.create.after                 → lit le cookie, rejette l'auto-parrainage,
   (auth.ts:364, 2e arg `context`)     INSERT referral {organization_id, locked_at}, efface le cookie

3. getCheckoutSessionParams          → metadata.affiliate_ref  (PAS client_reference_id — confisqué)

4. onEvent / invoice.paid            → dédup event → amount_paid>0 → résout referral via org
                                       → INSERT commission {pending, matures_at}
   charge.refunded                   → pending: refunded | paid: ligne clawback négative
   charge.dispute.created/closed     → gel puis résolution

5. Cron Inngest nocturne             → pending & matures_at <= now  →  approved
   (modèle: functions.ts:78-95)

6. Admin → marque payé               → payout immuable + snapshot identité (le SEUL geste manuel)
```

### Le plan de fichiers

Strictement l'architecture en couches du projet (`CLAUDE.md:50-77`) :

```
src/db/models/affiliate-model.ts                          ← cf. credit-ledger-model.ts
src/db/models/db.ts                                       ← import + spread
src/db/repositories/affiliate-repository.ts               ← ...Dao / ...TxnDao
src/services/types/domain/affiliate-types.ts
src/services/validation/affiliate-validation.ts
src/services/authorization/affiliate-authorization.ts     ← cf. credit-authorization.ts
src/services/authorization/casl-abilities.ts              ← + 'Affiliate'
src/services/affiliate-service.ts                         ← Zod → CASL → logger → DAO
src/services/facades/interceptors/affiliate-service-logger-interceptor.ts
src/services/facades/affiliate-service-facade.ts
src/app/dal/affiliate-dal.ts                              ← cache() React, PAS 'use cache'
src/app/r/[code]/route.ts                                 ← capture du clic + Set-Cookie + 302
src/lib/better-auth/auth.ts                               ← attribution dans user.create.after
src/lib/stripe/stripe-events.ts                           ← invoice.paid / refunds / disputes
src/lib/inngest/functions.ts                              ← cron de maturation
src/app/[locale]/(app)/account/affiliate/**
src/app/[locale]/admin/affiliates/**
src/components/features/affiliate/**  +  .../admin/affiliates/**
messages/{en,fr,es}.json                                  ← namespace "Affiliate", cf. "Credits"
src/services/__tests__/affiliate-service.test.ts          ← 6 describes par rôle
src/db/scripts/seed.ts                                    ← bloc numéroté + récap
pnpm db:generate  +  drizzle-kit generate --custom        ← index partiel (T8)
```

### Ce qu'il ne faut PAS construire en v1

Payouts automatisés, multi-niveaux (sous-affiliés), fingerprinting d'appareil, scoring GeoIP,
récompenses au clic et au lead, règlement multi-devises, marketplace d'affiliés.

## Open questions

1. **Montant et structure des commissions** — bounty par plan ? quels montants ? C'est une décision
   business, pas technique. Le schéma proposé encaisse les deux modèles.
2. **Durée de carence** — dépend de la politique de remboursement du produit, qui n'est écrite nulle
   part dans le repo. À fixer avant l'implémentation, c'est le seul chiffre qui protège la trésorerie.
3. **Onboarding** (O3) — construit-on l'écran de confirmation, ou v1 sans rattrapage ?
4. **Consentement cookie — tranché par la CNIL, et défavorable.** Ce n'est pas une zone grise en
   France : la [FAQ CNIL sur les cookies, question 13](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ)
   énonce que *« les traceurs utilisés pour la facturation des opérations d'affiliation n'entrent pas
   dans les exemptions prévues par l'article 82 de la loi Informatique et Libertés »*. Le cookie
   d'attribution **exige donc un consentement préalable**, et le fait qu'il soit first-party,
   HttpOnly et posé par le serveur **n'y change rien** — c'est la finalité qui est jugée, pas la
   technique. (Au niveau UE, aucune jurisprudence CJUE ni ligne directrice EDPB spécifique n'existe ;
   la position CNIL est ce qu'on a de plus ferme.)

   → Conséquence de conception : prévoir un **mode de tracking configurable**
   (`cookie | url-only | code-only`). Le mode `code-only` — un champ « code de parrainage » au
   signup — est le seul 100 % sans traceur, au prix de l'attribution multi-session. Pour un
   boilerplate vendu en Europe, c'est un argument commercial autant qu'une contrainte.
5. **Statut de l'affilié et facturation** — un affilié est un fournisseur, pas un client. Il doit
   émettre une facture conforme (SIRET, mentions obligatoires), ou bien c'est vous qui la générez
   pour lui (auto-facturation sous mandat, à acter dans les CGU du programme — c'est ce que fait
   Rewardful). Repères France : franchise en base de TVA à **37 500 €** de CA N-1 au 1er janvier 2026
   (le seuil unique à 25 000 € de la LF 2025 a été abandonné par la loi du 4 novembre 2025) ;
   **DAS2** à partir de 2 400 € de commissions versées par an à un même bénéficiaire — *applicabilité
   exacte à l'affiliation SaaS à confirmer par un expert-comptable*. **DAC7** vise limitativement
   location immobilière, services personnels, vente de biens et location de moyens de transport : un
   programme d'affiliation interne ne semble pas dans le périmètre, mais le point est incertain si le
   programme devenait une véritable marketplace de partenaires. À faire valider, pas à deviner.
6. **`user_id` UNIQUE sur `affiliate` ?** — un utilisateur = un affilié, ou faut-il découpler comme
   Dub (entité `Partner` séparée, jointure `PartnerUser`) pour permettre une société avec plusieurs
   collaborateurs ? Le découplage coûte peu maintenant, très cher plus tard.
7. **Que faire d'une organisation créée hors parcours d'inscription** (invitation dans une org
   existante, seconde org créée par un user déjà client) ? La règle « une attribution par
   organisation, à jamais » suppose de trancher si un client existant peut être « re-parrainé ».

