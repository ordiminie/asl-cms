# Research — Story s28-publipostage-pdf

## Target story

**En tant que** membre du bureau **je veux** produire un PDF prêt à imprimer pour les membres sans
email **afin qu'**ils reçoivent la même information que les autres, sans double saisie.

Critères d'acceptation (docs/stories.md) :

1. Depuis une campagne, le bureau génère un PDF unique contenant un courrier par fiche sans adresse
   email de la cible.
2. Les fiches sans email de même nom et même adresse de domicile (propriétaire de plusieurs terrains,
   s55) sont signalées **avant** la génération ; le bureau choisit de les regrouper en un courrier ou
   d'en garder un par terrain. Rien n'est regroupé d'office.
3. Chaque courrier porte les variables du destinataire (nom, libellé d'entreprise le cas échéant,
   adresse de domicile, parcelle, date), issues du même contenu que l'email, sans ressaisie.
4. PDF imprimable : A4, un courrier par page, bloc adresse placé pour une enveloppe DL à fenêtre
   gauche (110 × 220 mm) — position vérifiée par un test sur les coordonnées du bloc dans le PDF.
5. Une cible sans aucun membre sans email dit qu'il n'y a pas de courrier, au lieu d'un PDF vide.
6. Complétude : email ∪ courrier = toute la cible, sans intersection ni oubli. **À écrire en premier**
   (notes agentiques).

Notes agentiques à retenir : brique PDF tierce assumée, **à vérifier sur le VPS LWS 2 vCore / 4 Go**
(un navigateur headless est un risque mémoire) ; s'appuyer sur le champ explicite « sans adresse
active », jamais sur une chaîne vide ; adresse = **domicile** (`home_*`), jamais le terrain ;
libellé = `company_name` ; la comparaison « même nom et même domicile » est celle de l'import.
Cimetière : pas un plan B de connexion.

## Current state of the code

### Campagnes (s25 → s27b)

- `src/db/models/campaign-model.ts` — tables `campaign`, `campaign_part`, `campaign_recipient`,
  `campaign_recipient_profile` (ADR 051, 052, 057, 061). `campaign` porte `subject`, `preheader`,
  `body_markdown` (**tel qu'écrit**, variables non remplacées), `template_id`, `nature`
  (`facultative`/`statutaire`, ADR 064), `target_kind`, `target_group_id` (**`SET NULL`**),
  `target_group_name`, `recipient_count`, **`without_email_count`** (un simple entier),
  `unsubscribed_count`, `send_date` (jour de Paris, `date` en chaîne).
- `campaign_recipient.email` est **`notNull`** : une ligne d'envoi = une **adresse**. Les fiches sans
  adresse active **ne sont persistées nulle part** pour une campagne : seul leur nombre est figé
  (`withoutEmailCount: target.withoutEmail`, `src/services/campaign-service.ts:608`).
- `campaign_recipient_profile` (ADR 061) fige, par destinataire email, les fiches **ciblées** que
  représente l'adresse. L'ADR 061 a explicitement **rejeté « réévaluer la cible à la livraison »**
  (groupe supprimé ou modifié, statut d'impayé qui change) : « ce qui part doit être ce que le bureau a
  validé à la création ».
- `src/services/campaign-service.ts` (1158 lignes) — `readTarget()` (l.330, non exportée) est le
  **point de passage unique** du calcul de cible : `getCampaignTargetRowsDao(orgId)` puis prédicat
  selon `choice.kind` (`all` / `unpaid_members` via le fournisseur de facturation / `group`), puis
  `computeCampaignTarget(rows, isTargeted, nature)`. `sendCampaignService` (l.548) refuse
  `{status: 'no_recipient'}` quand **aucune adresse email** n'est destinataire (l.585), et
  `{status: 'delivery_disabled'}` si l'envoi client est coupé (l.561).
- `src/services/rules/campaign-rules.ts` — `computeCampaignTarget` (l.147) : une ligne sans `email`
  dont la fiche est ciblée entre dans `withoutEmailIds` ; une fiche avec au moins une adresse active
  entre dans `withEmailIds` (**désinscrites comprises**). Une adresse désinscrite en `facultative`
  est **exclue** des destinataires (`unsubscribed += 1`) ; en `statutaire` elle est réintégrée.
  `sameAddressRowsOf` (l.210), `addressValuesOf` (l.230 : nom du compte si plusieurs fiches sur
  l'adresse), `joinParcelNumbers` (l.78), `formatCampaignDate` (l.446), `substituteVariables` (l.63),
  `escapeHtml` (l.54), `findUnknownVariables` (l.38).
- `src/db/repositories/campaign-repository.ts:154` — `getCampaignTargetRowsDao(organizationId)` :
  `member_profile` **left join** `member_profile_email` **actives** ; une ligne par (fiche, adresse
  active), une ligne `email: null` par fiche sans adresse active. Sélectionne `memberProfileId`,
  `name`, `email`, `unsubscribed`, `accountName`, puis `currentParcelNumbers` (via
  `getCurrentParcelNumbersForMembersDao`, l.194). **Ne sélectionne ni `home_*` ni `company_name`.**
- Écran détail : `src/app/[locale]/(bureau)/bureau/campagnes/[id]/page.tsx` → `CampaignDetail`
  (`src/components/features/campaigns/campaign-detail.tsx`, affiche déjà
  `detail.fields.withoutEmail` = `campaign.withoutEmailCount`, l.613). DAL :
  `src/app/dal/campaign-dal.ts` (`getCampaignDal`, `getCampaignRecipientsDal`,
  `canManageCurrentCampaignsDal`). Actions : `src/app/[locale]/(bureau)/bureau/campagnes/actions.ts`.

### Rendu du contenu

- `src/lib/emails/render-campaign-body.ts` — `renderCampaignBodyHtml(markdown, values)` : remark +
  `remark-html` avec `RESTRICTED_SANITIZE_SCHEMA` (CMS), substitution **après** rendu avec valeurs
  échappées, styles en ligne d'email. Balises produites : `p`, `h2`, `h3`, `ul`, `ol`, `li`,
  `blockquote`, `a`, `strong`/`em`.
- `src/lib/emails/campaign-text.ts` — `renderCampaignText(...)` et `plainTextOf` (privée) : Markdown
  aplati par regex, variables sans échappement. Pied email (désinscription, mentions) : **sans objet
  sur papier** sauf mentions légales.
- Variables : `CAMPAIGN_VARIABLES = ['nom', 'parcelle', 'date']`
  (`src/services/types/domain/campaign-types.ts:30`). Aucune variable d'adresse ni d'entreprise : le
  bloc adresse est de la **mise en page**, pas une variable du corps.

### Fiche membre (s12, s54, s55)

- `src/db/models/member-profile-model.ts` — `name` (tel qu'il s'écrit sur un courrier),
  `homeAddressLine`, `homeAddressComplement`, `homePostalCode`, `homeCity` (domicile = adresse du
  courrier), `land*` (terrain, **à ne pas utiliser**), `companyName`. Toutes facultatives.
- « Courrier uniquement » = aucune adresse **active** dans `member_profile_email` (calculé à la
  lecture, `docs/architecture.md:326`) ; « fiche incomplète » = courrier uniquement **et** aucune
  adresse postale (`docs/architecture.md:328`).

### Comparaison « même nom et même domicile » (s13, s55)

- `src/lib/import/pennylane-clients-mapper.ts:287` — `nameAndAddressKey(line: ParsedLine)` **privée,
  non exportée**, sur un `ParsedLine` d'import : clé = `name | homeAddressLine | homePostalCode`, en
  minuscules, espaces compactés, `trim`. `sameNameAndAddressRemarks` (l.301) ignore une ligne sans
  `homeAddressLine`. Le commentaire l.299 annonce que **s28 s'appuie sur la même comparaison** : elle
  devra être extraite (fonction pure partagée) pour être réutilisée sans duplication.

### PDF, téléchargement, polices

- **Aucune génération de PDF dans le dépôt.** Aucune dépendance PDF installée (`package.json` :
  ni `pdfkit`, `pdf-lib`, `@react-pdf/renderer`, `pdfjs-dist`, ni `puppeteer`). `@playwright/test`
  est une dépendance de dev pour l'e2e, pas un moteur de production.
- Les PDF existants sont **déposés** (analyses d'eau, blocs PDF du CMS) ou **redirigés** (facture
  Pennylane : `openMyInvoicePdfAction` rend une URL, `src/app/[locale]/(app)/dashboard/actions.ts:86`).
- Réponse binaire existante : `src/app/api/identity/[kind]/route.ts` (`new Response(body, {headers})`,
  tenant résolu par `getCurrentTenantDal`, `X-Content-Type-Options: nosniff`). Aucune route ne sert
  aujourd'hui un fichier **généré pour le bureau** avec `Content-Disposition`.
- Polices : `src/assets/fonts/SourceSerif4-SemiBold.ttf` (TTF, utilisée par
  `src/app/api/identity/share-image/route.tsx:46`) ; les autres (`public-sans-latin.woff2`,
  `source-serif-4-latin.woff2`) sont en woff2 sous-ensemble latin dans `src/app/[locale]/fonts/`.
- Logo : `organization.identityLogoKey` + `pngLogoUrlOf` (email). Disque du VPS (ADR 004).

### Seed (données de test)

`src/db/scripts/tenant-member-profiles-seed.ts` — TechCorp, fiches **sans adresse** :
`Jean et Odile Dubois` (domicile renseigné + terrain), `Hélène Roy` (**terrain seul, aucun
domicile** → fiche incomplète), `Marcel Laurent` (domicile). Marketing Pro : `Sophie Ferreira`
(domicile). `SCI Les Chênes` porte `companyName` mais **a une adresse email**. Les doublons
« même nom même domicile » du seed (`Bernard Lefèvre` ×2) **ont un email** : aucun cas de
regroupement de courrier n'existe dans le seed — il faudra l'ajouter (règle : seed déterministe mis à
jour quand un test en dépend).

## Anchor points

- **Lecture de la cible sans email** : `readTarget()` / `computeCampaignTarget` (cible ciblée) et
  `getCampaignTargetRowsDao` (à enrichir de `home_*` + `company_name`, ou DAO dédiée aux fiches sans
  email).
- **Création de campagne** : `sendCampaignService` + `createCampaignWithRecipientsTxnDao` — point où
  figer l'ensemble des fiches sans email, si le plan retient ce choix (cf. questions ouvertes).
- **Écran** : `CampaignDetail` (campagne existante) — bouton de génération + signalement des
  doublons avant génération ; éventuellement le récapitulatif avant envoi du composeur
  (`campaign-preview-step.tsx`) qui affiche déjà `profilesWithoutEmail`.
- **Livraison du fichier** : route handler sous `src/app/api/campaigns/...` (modèle
  `api/identity/[kind]/route.ts`) ou Server Action — à trancher au plan (une Server Action
  sérialise mal un binaire volumineux).
- **Comparaison des doublons** : extraire `nameAndAddressKey` du mapper d'import en règle pure
  partagée (`src/services/rules/...`).
- **Messages** : `messages/fr.json`, namespace `CampaignsBureau`.

## Verified APIs / functions

| Nom | Emplacement | Signature / rôle |
| --- | --- | --- |
| `getCampaignTargetRowsDao` | `src/db/repositories/campaign-repository.ts:154` | `(organizationId: string) => Promise<CampaignTargetRowModel[]>` |
| `getCurrentParcelNumbersForMembersDao` | idem `:194` | `(memberProfileIds: string[]) => Promise<Record<string, string[]>>` |
| `getCampaignByIdDao` | idem (appelé `campaign-service.ts:733`) | `(organizationId, campaignId)` |
| `computeCampaignTarget` | `src/services/rules/campaign-rules.ts:147` | `(rows, isTargeted?, nature?) => {recipients, withoutEmail, unsubscribed, reinstated, profilesWithEmail}` |
| `readTarget` (privée) | `src/services/campaign-service.ts:330` | `(orgId, choice, settings, templateId) => {rows, target, isTargeted, group, nature}` — sous `withTenant` |
| `requireCampaignManager` (privée) | `campaign-service.ts:191` | `campaign.manage` via `canPerformAction` |
| `sendCampaignService` | `campaign-service.ts:548` | refuse `no_recipient` si 0 adresse destinataire |
| `getCampaignService` | `campaign-service.ts:726` | `{status: 'found', campaign}` / `not_found` |
| `renderCampaignBodyHtml` | `src/lib/emails/render-campaign-body.ts` | `(markdown, values) => string` (HTML d'email, styles en ligne) |
| `substituteVariables`, `joinParcelNumbers`, `formatCampaignDate`, `findUnknownVariables` | `campaign-rules.ts:63/78/446/38` | réutilisables pour le courrier |
| `nameAndAddressKey` (privée) | `src/lib/import/pennylane-clients-mapper.ts:287` | `(line: ParsedLine) => string` — à extraire |
| `withTenant` | `src/db/tenant-scope` | scope RLS (ADR 002) |
| `CAMPAIGN_VARIABLES` | `src/services/types/domain/campaign-types.ts:30` | `['nom', 'parcelle', 'date']` |
| `getCurrentTenantDal` / `requireCurrentTenantDal` | `src/app/dal/tenant-dal.ts` | tenant du domaine appelé |

## Traps & constraints

1. **Les fiches sans email ne sont pas figées.** Générer « depuis une campagne » oblige soit à
   **figer** l'ensemble à la création (nouvelle table ou colonne → migration, RLS forcée, test
   d'isolation e2e, ADR), soit à **recalculer** la cible — option que l'ADR 061 a rejetée pour
   l'email (groupe `SET NULL`, impayés qui changent). Recalculer casserait aussi le critère 6
   (complétude) pour une campagne ancienne : un membre qui a ajouté un email depuis ne serait dans
   aucun canal. C'est la décision structurante de la story (**ADR attendu**).
2. **Une campagne exige au moins une adresse email** (`no_recipient`, l.585) et l'envoi client
   activé (`delivery_disabled`, l.561) : une cible **entièrement** sans email ne peut pas créer de
   campagne aujourd'hui, donc pas de courrier « depuis une campagne ». Le critère 5 ne dit que le cas
   inverse (aucun sans-email). À trancher.
3. **Définition de « sans email » vs désinscription.** `withoutEmail` = aucune adresse **active**. Une
   fiche dont toutes les adresses actives sont désinscrites, en `facultative`, est **hors** email et
   **hors** courrier ; en `statutaire`, elle est réintégrée côté email. Le critère 6 (« aucun membre
   oublié des deux canaux ») doit dire si un désinscrit facultatif est « oublié » ou « a refusé ».
4. **Adresse partagée par plusieurs fiches** : côté email, une adresse porte plusieurs fiches (une
   seule ligne, ADR 055). Côté courrier, l'unité est la **fiche** (critère 1), avec regroupement
   **optionnel** par nom + domicile (critère 2). Le critère 6 se raisonne donc en **fiches** :
   fiches ciblées = fiches couvertes par un destinataire email (`campaign_recipient_profile` pour les
   campagnes postérieures à ADR 061) ∪ fiches du courrier.
5. **Fiche sans domicile** (seed : `Hélène Roy`, terrain seul) : impossible de poster. Ne **pas** se
   replier sur le terrain (notes agentiques, ADR 058). Comportement à décider (signaler et exclure ?
   imprimer sans adresse ?), sous peine de violer le critère 6 ou la règle domicile.
6. **Regroupement** : la clé de l'import exige `homeAddressLine` ; nom du courrier regroupé (nom de la
   fiche, identique par construction) et `{parcelle}` = parcelles actuelles de toutes les fiches
   regroupées (cohérent avec `addressValuesOf` côté email). Le choix du bureau (regrouper / un par
   terrain) n'est pas persisté : il est passé à la génération — à confirmer.
7. **Brique PDF et VPS 4 Go** : exclure tout navigateur headless (Chromium ≈ 300–500 Mo par
   instance) ; candidates pur JS : `pdfkit` (bas niveau, coordonnées explicites, polices TTF/WOFF via
   fontkit), `@react-pdf/renderer` (mise en page React/flexbox, dépend de yoga-layout wasm),
   `pdf-lib` (pas de mise en page de texte, retour à la ligne manuel). Pour ~100 courriers d'une
   page, un générateur pur JS tient en quelques dizaines de Mo. **Non mesuré** ici.
   Sous Next, `pdfkit` lit ses polices AFM depuis le disque : il faut en général le déclarer dans
   `serverExternalPackages` (`next.config`) — à vérifier au plan dans
   `node_modules/next/dist/docs/` (AGENTS.md : « This is NOT the Next.js you know »).
8. **Test des coordonnées** (critère 4) : il faut **relire** le PDF produit en test unitaire pour
   extraire la position du texte du bloc adresse (ex. `pdfjs-dist` `getTextContent()` → `transform`)
   — dépendance de dev supplémentaire, ou exposer la géométrie du gabarit comme constantes et tester
   celles-ci **et** le PDF. Fenêtre DL gauche normalisée (NF EN ISO 269 / La Poste) : fenêtre
   ≈ 45 × 100 mm, à 20 mm du bord gauche et ≈ 15 mm du bas de l'enveloppe ; sur une A4 pliée en 3,
   le bloc adresse se place usuellement à ~20 mm de la gauche et ~45–50 mm du haut. **Valeurs à
   sourcer précisément au plan**, et à rendre paramétrables si l'ADR 010 l'exige (« rien en dur ») —
   la géométrie d'une enveloppe normalisée est une constante physique, pas un paramètre
   d'association : à arbitrer.
9. **Rendu du Markdown en PDF** : `renderCampaignBodyHtml` produit du **HTML d'email** à styles en
   ligne, inutilisable tel quel par un moteur sans navigateur. Il faudra un rendu Markdown → blocs
   (mdast de `remark`, déjà installé) avec le même schéma restreint, et la substitution **après**
   rendu (même garantie qu'en email : une valeur n'est jamais lue comme du Markdown). Les liens
   s'impriment en clair (comme `plainTextOf`).
10. **Données personnelles** : le service campagne n'écrit jamais contenu ni destinataires dans les
    journaux (intercepteur sans détails) ; le PDF porte noms et adresses de domicile → aucun cache
    partagé, `Cache-Control: no-store`, pas de stockage disque persistant (sauf choix contraire
    explicite), nom de fichier sans donnée nominative.
11. **Autorisation et tenant** : `campaign.manage` sur l'association du domaine appelé ; une campagne
    d'une autre association = `not_found` sans lecture (modèle `getCampaignRecipientsService`). Test
    d'accès croisé **e2e** obligatoire (AGENTS.md), même sans nouvelle table.
12. **Budget email** : le courrier n'est pas un email sortant, il ne décompte rien du plafond Brevo.
13. **Fichiers volumineux** : `campaign-service.ts` (1158 l.) et `campaign-repository.ts` (1165 l.)
    sont déjà longs ; un service `campaign-letter-service.ts` séparé (avec façade et intercepteur)
    respecterait mieux top-down-design. Règle : un service n'importe jamais une façade ; `readTarget`
    est privée et devra être exportée ou déplacée pour être partagée.
14. **Tests existants à ne pas casser** : `campaign-repository.test.ts`, `campaign-dal.test.ts`,
    `campagnes/actions.test.ts`, `[id]/page.test.tsx`, `campaign-detail.test.tsx`,
    `e2e/campaigns.spec.ts`, et `pennylane-clients-mapper` (si `nameAndAddressKey` est extraite).
    Montage 9p lent : valider `pnpm test --run` sur une copie en disque local si timeouts.
15. **Design** : story UI (bouton, signalement des doublons, état « pas de courrier »). Le design
    system mentionne déjà que les groupes « serviront au courrier (s28) » (`docs/design-system.md:900`)
    et le bouton `outline` « PDF » + icône `Download` des factures (l.930) ; la page imprimée
    elle-même (gabarit du courrier) n'a **aucun** composant au design system → gap à déclarer en
    `/ks-design`.

## Open questions

1. **Figer ou recalculer les fiches sans email ?** Recommandation de la research : figer à la création
   (cohérent avec ADR 061 et nécessaire au critère 6), via une table d'appartenance
   `campaign_letter_profile` (`organization_id`, `campaign_id`, `member_profile_id`) sous RLS forcée.
   Conséquence : les campagnes **antérieures** à s28 n'ont pas d'ensemble figé — les exclure du
   courrier, ou recalculer pour elles seules ?
2. **Cible 100 % sans email** : autoriser la création d'une campagne « courrier seul » (lever
   `no_recipient` quand des sans-email existent, et ne pas exiger l'envoi client activé), ou rester
   strictement « depuis une campagne email » ?
3. **Fiche sans domicile** : exclue et signalée (« fiche incomplète, à compléter avant impression »)
   ou courrier imprimé sans bloc adresse ?
4. **Désinscrits d'un envoi facultatif** (toutes adresses désinscrites) : hors des deux canaux par
   choix du membre (refus respecté) — à confirmer comme non-« oubli » au sens du critère 6.
5. **Contenu imprimé** : objet en titre, en-tête association (nom, logo, mentions légales) ? Le pied
   email (désinscription) disparaît ; mention statutaire (s27b) conservée ou non sur papier ?
6. **Géométrie du bloc adresse** : valeurs exactes de la fenêtre DL gauche à sourcer ; constantes de
   code (norme physique) ou paramètres d'association (ADR 010) ?
7. **Brique PDF** : `pdfkit` vs `@react-pdf/renderer` — choix et mesure mémoire à faire au plan
   (ADR), avec vérification de la compatibilité bundler Next 16 (`serverExternalPackages`).
8. **Livraison du fichier** : route handler GET (avec choix de regroupement en paramètre) ou POST ;
   régénérable à volonté, rien n'est stocké — à confirmer.
