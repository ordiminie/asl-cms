---
validated: yes
---

# Plan — Story s30-stats-campagnes

Branch: `feature/s30-stats-campagnes`

Sources : `docs/research/s30-stats-campagnes.md`, `docs/designs/s30-stats-campagnes.md` (+ `.html`),
ADR 068 (décision de cette story), ADR 005, 017, 051, 052, 053.

Arbitrages du 21/11/2026 : **relevé conservé** (une campagne de plus de 90 jours garde ses chiffres) ;
ouvertures et clics en **personnes uniques**, taux sur les **emails envoyés** ; **phrase d'interprétation
affichée**.

## Target story

**En tant que** membre du bureau **je veux** consulter les taux d'ouverture et de clic de mes campagnes **afin
de** savoir si l'information passe.

1. La fiche d'une campagne envoyée affiche le nombre d'envois, d'ouvertures et de clics, avec les taux.
2. Une campagne étalée en plusieurs parts présente des statistiques consolidées sur l'ensemble de la campagne.
3. Des statistiques indisponibles ou pas encore consolidées s'affichent comme telles, sans chiffre inventé ni
   zéro trompeur.
4. Les statistiques d'une association ne sont jamais visibles d'une autre.

## Tasks (ordered)

1. [x] **Modèle et migration** — `campaign` gagne `stats_tracked boolean not null default false`,
       `stats_unique_opens integer`, `stats_unique_clicks integer`, `stats_read_at timestamptz`
       (`src/db/models/campaign-model.ts`, doc du modèle citant ADR 068) ; migration par `pnpm db:generate`
       (jamais à la main). DAO `saveCampaignStatisticsTxnDao(campaignId, {uniqueOpens, uniqueClicks, readAt})`
       à la fin de `campaign-repository.ts`, par `getDb()`. Vérif : `pnpm db:generate` propre, typecheck.
       Commit séparé possible (migration, AGENTS.md).
2. [x] **Contrat `EmailTransport`** (`email-transport.ts`) — `EmailMessage.tags?: string[]` ;
       `readTagStatistics(query: {tag; startDate; endDate}): Promise<TagStatisticsResult>` avec
       `TagStatisticsResult = {status: 'found'; requests; delivered; uniqueOpens; uniqueClicks} |
    {status: 'unsupported'}`. `file`, `resend` → `unsupported` ; `memory` → `unsupported` par défaut,
       amorçable (`setTagStatistics`) et traçant ses requêtes. Tests : chaque transport répond comme dit ;
       `index.ts` réexporte les types.
3. [x] **Brevo** (`brevo-transport.ts`) — `tags` dans `toBrevoBody` quand présents ;
       `readTagStatistics` = `GET https://api.brevo.com/v3/smtp/statistics/aggregatedReport?tag=…&startDate=…&endDate=…`,
       en-tête `api-key`, `AbortSignal.timeout` borné, champ absent lu `0`. Injoignable → `EmailTransportError`
       ; HTTP non-ok → `EmailTransportError` (`refused: true`) ; la clé n'apparaît dans aucune erreur. Tests par
       `fetch` bouchonné (motif de `brevo-transport.test.ts`) : URL et paramètres exacts, tag encodé, champs
       absents, erreurs, `tags` absent du corps sans tag.
4. [x] **Point d'envoi** (`email-service.ts`) — `SendEmailPayload.tags` → `ComposedEmail.tags` →
       `transmitComposedEmail` les passe au transport ; `readEmailTagStatisticsService(query)` délègue à
       `getEmailTransport().readTagStatistics`. Tests : un envoi tagué arrive tagué au transport mémoire ; un
       envoi sans tag n'a pas de `tags`.
5. [x] **Campagnes taguées** (`campaign-service.ts`) — `campaignStatisticsTagOf(campaignId)` →
       `campaign-<id>` ; `composeRecipientEmail` pose `tags: [tag]` sur chaque email (toutes parts) ;
       `sendCampaignService` crée la campagne avec `statsTracked: true`. Tests : deux parts livrées → tous les
       messages portent le même tag ; la campagne créée est suivie.
6. [x] **Règle d'affichage, fonction pure** (`src/lib/campaigns/campaign-statistics.ts` ou module du domaine,
       selon le motif existant des fonctions pures de campagne) — entrée : statut, `sentCount`, `statsTracked`,
       jour de création, aujourd'hui, relevé conservé, résultat de lecture (ou absence / erreur) ; sortie : un
       des états `available` (`sentCount`, `uniqueOpens`, `uniqueClicks`, taux arrondis, `readAt`,
       `fromSnapshot`), `pending_sending` (dernier jour d'envoi), `pending_provider`, `unavailable`
       (`unreachable` | `untracked` | `expired`), `nothing_sent` ; plus `shouldSave`. Fenêtre ADR 068 §6.
       Tests (critère 3, le cœur) : `requests < sentCount` → `pending_provider`, **jamais** de chiffre ;
       vrai zéro consolidé → `available` à 0 ; erreur avec relevé → relevé, sans → `unreachable` ; hors
       fenêtre 88/89 jours ; `interrupted` consolidé ; arrondi 51,5 → 52, 0 envoi.
7. [x] **Service + façade + types** — `getCampaignStatisticsService({organizationId, campaignId}, now)` dans
       `campaign-service.ts` (schéma Zod de `getCampaignService`, `requireCampaignManager`) : campagne lue
       sous `withTenant` **avant** tout appel ; introuvable → `not_found` sans appel au fournisseur ; lecture
       dans la fenêtre ; erreur transport attrapée (journalisée sans détail du message) ; `shouldSave` →
       `saveCampaignStatisticsTxnDao` sous `withTenant`. Façade dans `campaign-service-facade.ts` ; types
       `CampaignStatisticsDTO` / `CampaignStatisticsReadResult` dans `campaign-types.ts`. Tests par rôle :
       bureau lit ; `member` refusé ; campagne d'une autre association → `not_found`, transport jamais
       appelé ; relevé écrit à la consolidation seulement.
8. [x] **DAL + carte + libellés** — `getCampaignStatisticsDal` (`cache()`, pas de cache persistant) ; carte
       `CampaignStatisticsCard` (`campaign-statistics-card.tsx`) suivant le design : `CardHeading`
       « Ouvertures et clics », motif Compteur (`dl`, trois paires, `154 · 51 %`), phrases `meta` (portée si
       plus d'une part, interprétation, source + relevé), `alert` neutre pour « pas encore », phrase + raison
       pour « indisponible », fallback titre + « Lecture des statistiques… ». Rendue dans `CampaignDetail`
       après `ProgressCard`, **dans son propre `<Suspense>`** depuis la page (`[id]/page.tsx`), lecture en
       `.catch` → indisponible. Libellés dans `messages/fr.json` (`CampaignsBureau.detail.statistics`).
       Tests jsdom par état : aucun chiffre rendu hors `available` ; taux et `·` ; portée absente à une part.
9. [x] **e2e** (`e2e/campaigns.spec.ts`, bloc s26 ou nouveau bloc s30) — CI en `EMAIL_TRANSPORT=file` : la
       fiche d'une campagne envoyée montre « Ouvertures et clics » avec « Les statistiques de cette campagne
       ne sont pas disponibles. » et **aucun** pourcentage ; **critère 4** : depuis l'association B, l'URL
       forgée de la campagne de A est introuvable et ne rend ni la carte ni un chiffre ; les colonnes de
       relevé restent sous la RLS de `campaign` (lecture croisée en base vide). Vérif locale :
       `pnpm exec playwright test --list` (e2e exécutés en CI, jamais en local).

## Files touched

- `src/db/models/campaign-model.ts`, `drizzle/migrations/*` (générés), `src/db/repositories/campaign-repository.ts`
- `src/lib/emails/transport/{email-transport,brevo-transport,resend-transport,file-transport,memory-transport,index}.ts` (+ tests)
- `src/services/email-service.ts` (+ test)
- `src/services/campaign-service.ts`, `src/services/facades/campaign-service-facade.ts`,
  `src/services/types/domain/campaign-types.ts` (+ tests)
- module pur de la règle d'affichage (+ test)
- `src/app/dal/campaign-dal.ts`, `src/app/[locale]/(bureau)/bureau/campagnes/[id]/page.tsx`
- `src/components/features/campaigns/campaign-detail.tsx`, `campaign-statistics-card.tsx` (+ test)
- `messages/fr.json`
- `e2e/campaigns.spec.ts`
- docs : `docs/research/s30-stats-campagnes.md`, `docs/designs/s30-stats-campagnes.{md,html}`,
  `docs/decisions/068-…`, ce plan

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : transports (fetch bouchonné, aucune requête réelle — la clé
  Brevo est restreinte à l'IP du VPS), point d'envoi, campagnes taguées, règle d'affichage (table d'états
  exhaustive, critères 2 et 3), service par rôle et accès croisé avec DAO mockés (critère 4 côté service),
  carte par état (jsdom).
- **e2e (Playwright, en CI)** : rendu de la carte sous transport `file` et accès croisé entre deux tenants
  (critère 4, la RLS n'étant pas testable en unitaire).
- **Recette (VPS, hors CI)** : une campagne réelle taguée chez Brevo, suivi des ouvertures/clics actif dans le
  compte, chiffres affichés après consolidation.

## Definition of Done

- Les quatre critères couverts par un test nommé ; aucun chiffre rendu hors état consolidé.
- `pnpm lint`, typecheck, `pnpm test --run` verts ; e2e verts en CI.
- Migration générée par Drizzle ; aucune valeur en dur (libellés dans `messages/fr.json`).
- Aucun appel au fournisseur hors de `email-service` ; aucune nouvelle occurrence de `withRlsBypass()`.
- Une PR, revue passée (`Ship allowed: yes`), recette Brevo notée sur la carte Trello « Mise en PROD ».

## Correctifs de revue — tour 1 (arbitrage du 21/11/2026 : corriger avant la PR)

Source : `docs/reviews/s30-stats-campagnes.md` (tour 1, `Max severity: major`, `Ship allowed: yes`).

10. [x] **M1** — ADR 068 §5 : inverser les deux premiers cas (« campagne en cours → après le dernier envoi ;
        aucun email parti, campagne terminée → rien à mesurer ») et justifier l'ordre en une phrase (une
        campagne qui démarre n'a encore rien envoyé, sans que ce soit « rien à mesurer ») ; aligner la
        docstring de `campaignStatisticsOf` sur le code. Le comportement ne change pas (déjà testé).
11. [x] **m3** — la phrase de portée de la carte prend pour dernier jour le maximum de `day` et de
        `deferredUntil` des parts, comme le service. Test : une dernière part reportée annonce le jour du
        report.
12. [x] **m4** — le titre de la carte réutilise `CardHeading` (l'exporter ou l'extraire dans un module
        partagé des campagnes) au lieu d'un `h2` recopié. Tests existants verts.
13. [x] **m5** — corriger le commentaire de `[id]/page.tsx` (la carte des statistiques lit l'horloge et peut
        écrire le relevé) ; lignes ≤ 80 caractères.

Hors correctif (restent au rapport pour le tour final) : m1 (taux > 100 %), m2 (`endDate` et fuseau, à
vérifier en recette), m6 (libellé `untracked`).
