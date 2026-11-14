---
validated: yes
---

# Plan — Story s52-budget-envoi-adaptateur

Branch: `feature/s52-budget-envoi-adaptateur` (depuis `main`, `d3182fad`)

Contexte : `docs/research/s52-budget-envoi-adaptateur.md` · design `docs/designs/s52-budget-envoi-adaptateur.md`
(+ `.html`) · décision **ADR 053** (portée obligatoire, compteur conditionnel, table des reportés, marge de
02:00, réglages réservés au SuperAdmin).

## Target story

Le total des emails d'une association ne dépasse jamais le quota du jour ; ce qui ne part pas aujourd'hui
part demain, seul et une seule fois. Complexité 4, dépend de s26 (livrée).

1. Budget quotidien par association (300 par défaut, réglage), décompté **dans l'adaptateur** par tout email
   sortant ; prouvé avec un émetteur de test distinct des campagnes.
2. Décompte atomique et transverse, en base.
3. Emails de connexion jamais reportés ni refusés, décomptés ; réserve (100 par défaut) : les reportables
   consomment au plus `budget − réserve`.
4. Un reportable en excès est reporté au lendemain, ni refusé ni perdu ; le bureau voit nature et date.
5. Un reporté part le jour suivant, sans action, une seule fois (double déclenchement, redémarrage).
6. Les campagnes passent par ce budget ; le plafond de 100 de s26 reste propre aux campagnes.
7. Le contenu conservé n'apparaît dans aucun journal ni chez une autre association ; purgé une fois parti.
8. Les emails de plateforme ne consomment le budget d'aucune association.
9. Budgets isolés par tenant (test d'accès croisé).
10. Jour de `Europe/Paris`, frontière 23:59 / 00:00 testée.

**Arbitrages du 2026-11-14 (Marie-Ève)** : jour de Paris avec une marge (rien de reportable n'est rejoué
avant 02:00 Paris) ; limite et réserve modifiables par le **SuperAdmin seul** ; une seule story.
**Brevo** : remise à zéro à minuit UTC selon une source secondaire, page officielle inaccessible (403) —
consigné dans la story à la tâche 1.

## Tasks (ordered)

1. [x] **Réglages : limite et réserve, réservées au SuperAdmin.** Deux clés au registre
       (`association-settings-types.ts`) : `email.daily_send_limit` (300, min 1) et `email.login_reserve` (100,
       min 0), page `settings`, section `sending`, en tête ; accesseurs `getEmailDailySendLimit`,
       `getEmailLoginReserve` ; libellés et aides du design dans `messages/fr.json`. Drapeau de registre
       `editableBy: 'super_admin'` : `updateAssociationSettingsService` refuse ces clés sauf si
       `getActingContext()` (`auth-service.ts:86`) montre un `super_admin` ou un imitateur SuperAdmin ; contrôle
       croisé « réserve < limite » dans `validateSettingsChanges`, erreur sur le champ de la réserve. La page
       Réglages rend ces champs en lecture seule pour le bureau. Aide du plafond de campagne raccourcie
       (design, écran 2). Consigner dans `docs/stories.md` (notes de s52) l'état de la vérification Brevo.
       _Tests_ : rules (défauts, bornes, croisé), service (bureau refusé, SuperAdmin et imitation acceptés),
       rendu lecture seule.
2. [x] **Règles pures du budget** (`src/services/rules/email-budget-rules.ts`) : `reportableAllowance(limit,
reserve)`, `isNeverDeferred(nature)` (`login` seul), `budgetDayOf(now)` (= `calendarDayOf`),
       `deferredRunAfter(day)` = **02:00 Paris** du jour suivant, `remainingReportable(...)` jamais négatif.
       _Tests_ : 23:59:59 / 00:00:00 Paris en hiver et en été (critère 10), 01:59 / 02:00, limite = réserve.
3. [x] **Persistance du compteur** : modèle `email_send_budget` (`organization_id`, `day` date,
       `reportable_count`, `login_count`, unique `(organization_id, day)`), `pnpm db:generate`, RLS forcée par
       `drizzle-kit generate --custom` (calque de `0046`), ligne au classement de `docs/architecture.md`
       (remplace `daily_send_budget`, compteurs à jour). Repository : `claimReportableSendTxnDao` (incrément
       **conditionnel** en une instruction, rend `false` au plafond), `countLoginSendTxnDao` (incrément sans
       plafond), `refundReportableSendTxnDao`, `getSendBudgetDao`. _Tests_ : repository (SQL émis, plafond dans
       le `WHERE`), `rls-inventory`.
4. [x] **Persistance des reportés** : modèle `deferred_email` (ADR 053 §4), migration + RLS forcée,
       classement. Repository : `createDeferredEmailTxnDao`, `claimDeferredEmailForSendTxnDao` (`pending →
sending` atomique), `deleteDeferredEmailTxnDao`, `markDeferredEmailToVerifyTxnDao`,
       `releaseDeferredEmailTxnDao`, `listPendingDeferredEmailsDao` (sans colonne de contenu : nature, référence,
       destinataires, `send_on`). _Tests_ : repository ; la liste ne sélectionne jamais objet/texte/HTML/adresse.
5. [x] **L'adaptateur décompte et reporte** (`email-service.ts`) : `sendEmailService(payload, context)`,
       `context` **obligatoire** (`EmailSendContext` dans `src/services/types/domain/`), résultat
       `sent | deferred | skipped`. Ordre : interrupteurs → plateforme : envoi direct → `login` : compteur sans
       plafond puis envoi → reportable : `claimReportableSendTxnDao` sous `withTenant` ; accordé → envoi (refus
       certain → remboursement) ; refusé → le message **rendu** est écrit dans `deferred_email` et une tâche
       `email.deliver_deferred` (`run_after` = `deferredRunAfter`) est créée **dans la même transaction**, rend
       `deferred`. Mise à jour de **tous** les appelants avec leur portée et leur nature (magic link →
       `login` ; contact, signalement → `board_notification` ; boilerplate → `platform`). Rien du contenu dans
       un journal. _Tests_ : `email-service.test.tsx` étendu — un **émetteur de test** non-campagne consomme le
       budget (critère 1) ; épuisé → `deferred` et rien envoyé ; `login` part budget épuisé ; plateforme ne
       touche aucun compteur (critère 8) ; refus certain rembourse ; `tsc` refuse un appel sans contexte.
6. [x] **Rejeu des reportés** : gestionnaire `deliverDeferredEmailService` (`email-service.ts` ou service
       dédié), enregistré dans `scheduled-job-service-facade.ts` (`kinds` du planificateur). Il prend la ligne
       (`pending → sending`), repasse par le budget du jour (de nouveau épuisé → ligne rendue, tâche
       reprogrammée au lendemain 02:00, **sans** tentative comptée), envoie, **supprime** la ligne. Verrou
       périmé / reprise : une ligne `sending` passe `to_verify`, jamais renvoyée (patron de
       `sweepAbandonedRecipients`). Ligne absente → `completed`. _Tests_ : double exécution = un seul envoi
       (critère 5), reprise après verrou périmé, purge après envoi (critère 7), report en chaîne.
7. [x] **Campagnes sous budget** (`campaign-service.ts`) : `deliverToRecipient` lit le résultat ;
       `deferred` → `releaseRecipientClaimTxnDao`, la part s'arrête et sa tâche est reprogrammée à
       `deferredRunAfter` sans tentative comptée (nouvelle issue, ou `retry` + `attempts − 1` : à choisir au
       plus simple dans `scheduled-job-service`) ; `skipped` n'est plus confondu avec `sent`. `partRunAfter`
       passe à 02:00 Paris pour une part d'un jour suivant (ADR 053 §6). Écran de campagne : bandeau `warning`
       et sous-ligne de part « 60 reçues · 40 reportées au 15/11 » (design, écran 3), badge existant
       « Programmée pour le … ». _Tests_ : livraison d'une part avec budget épuisé au milieu (reste `pending`,
       reprogrammée, rien en échec), `partRunAfter`, rendu du bandeau.
8. [x] **Lecture « Envois d'emails »** : service `getEmailSendingOverviewService(organizationId, now)`
       (autorisation : action existante du registre lue par le bureau — `CAMPAIGN_MANAGE` si elle couvre le
       bureau, sinon une action `email.sending.read` ajoutée au registre), façade, DAL **sans** `'use cache'`
       (donnée vivante), DTO liste blanche : compteurs du jour, limite, réserve, et les envois en attente
       **regroupés** (une part de campagne = une ligne, une notification = une ligne, nature + libellé de
       référence + nombre + `send_on`). _Tests_ : service (DTO sans adresse ni contenu, refus hors bureau),
       regroupement.
9. [x] **Page `/bureau/envois`** (design, écran 1) : route sous `(bureau)/bureau/envois`, entrée « Envois »
       après « Campagnes » dans `bureau-sidebar.tsx`, cartes « Aujourd'hui » (`progress`, paires `dl`) et « En
       attente » (`table` / cartes empilées, `pagination`), bandeaux `warning` (limite atteinte, réserve
       épuisée), vide, `skeleton`, erreur `destructive`. Composants du socle seulement ; libellés dans
       `messages/fr.json`. _Tests_ : composants (les cinq états), entrée de barre latérale active.
10. [x] **e2e et documents** : `e2e/` — (a) isolation croisée : l'association B ne lit ni ne consomme le
        budget de A, ne voit pas ses envois en attente (critère 9) ; (b) budget réduit par réglage (SuperAdmin)
        → un envoi reportable passe en attente et apparaît sur `/bureau/envois`, un lien de connexion part quand
        même (outbox du transport `file`). Docs : `docs/architecture.md` (tables, adaptateur), ADR 053 déjà
        écrit, `docs/design-system.md` §3.13 (gaps 1, 2, 4, 5 du design versés), `docs/exploitation/` si
        l'heure de 02:00 change la lecture des minuteries. _Vérification_ : `pnpm lint`, `tsc`, `pnpm test --run`
        (copie sur disque local si le montage 9p fait expirer les workers), e2e **en CI**.

## Files touched

- **Réglages** : `src/services/types/domain/association-settings-types.ts`, `association-settings-service.ts`
  (+ règles de validation), page et composants de `(bureau)/bureau/reglages`, `messages/fr.json`,
  `docs/stories.md` (note Brevo).
- **Règles** : `src/services/rules/email-budget-rules.ts` (+ test), `campaign-schedule-rules.ts`
  (`partRunAfter`).
- **Persistance** : `src/db/models/email-send-budget-model.ts`, `deferred-email-model.ts`, index des
  modèles ; `drizzle/migrations/00xx_*.sql` + journal (générés) ; `src/db/repositories/email-send-budget-repository.ts`,
  `deferred-email-repository.ts` (+ tests).
- **Adaptateur et appelants** : `src/services/email-service.ts`, `src/services/types/domain/email-send-types.ts`,
  `facades/email-service-facade.ts`, `magic-link-integration.ts`, `contact-message-service.ts`,
  `incident-report-service.ts`, `notification-service.ts`, `auth.ts`, `user-submission-service.ts`,
  `admin/emails/actions.ts`, `src/lib/inngest/functions.ts`, `organization/action.ts`.
- **Planificateur et campagnes** : `scheduled-job-types.ts`, `scheduled-job-service.ts` (si une issue
  « reportée » est ajoutée), `facades/scheduled-job-service-facade.ts`, `campaign-service.ts`,
  `campaign-detail.tsx`.
- **Écran** : `(bureau)/bureau/envois/page.tsx`, `src/app/dal/email-sending-dal.ts`, service + façade +
  intercepteur, `src/components/features/email-sending/*`, `bureau-sidebar.tsx`, registre des actions si
  besoin.
- **Tests et docs** : `src/services/__tests__/email-service.test.tsx`, tests de campagne,
  `src/db/rls-inventory.test.ts` (via le classement), `e2e/email-budget.spec.ts`, `docs/architecture.md`,
  `docs/design-system.md`, `docs/decisions/053-*.md`.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : règles pures (jour, frontière 23:59/00:00 et 01:59/02:00,
  hiver/été) ; repositories (SQL du compteur conditionnel, liste sans contenu) ; adaptateur avec transport
  et DAO mockés (émetteur de test non-campagne, `login` budget épuisé, plateforme, remboursement) ; rejeu
  (double exécution, reprise, purge) ; campagnes (report en milieu de part) ; réglages (droits SuperAdmin,
  croisé) ; composants de la page (cinq états).
- **Atomicité réelle et RLS** : non testables en unitaire (`db.ts` refuse la connexion). L'instruction
  conditionnelle est épinglée par son SQL ; l'isolation est prouvée en **e2e** contre la base éphémère de
  la CI.
- **e2e (Playwright, en CI)** : isolation croisée entre deux tenants ; report visible sur `/bureau/envois` ;
  lien de connexion envoyé budget épuisé (outbox `file`). Pas d'e2e en local (machine trop juste).
- **Non-régression** : suites existantes des campagnes, du planificateur, `ops-config`, `rls-inventory`,
  `provider-imports`, `e2e/campaigns.spec.ts`.

## Definition of Done

- Une PR, une branche `feature/s52-budget-envoi-adaptateur`, un commit de story (+ un commit à part pour
  les migrations si besoin de les revert seules).
- Les dix critères couverts par un test nommé, ou par l'e2e pour 2 (atomicité réelle) et 9 (isolation).
- Aucun appel à `sendEmailService` sans contexte (garanti par le typage) ; aucune occurrence nouvelle de
  `withRlsBypass` ; aucun contenu d'email ni adresse dans un journal.
- Deux tables nouvelles sous RLS forcée, classées dans `docs/architecture.md`, `rls-inventory` vert.
- Limite et réserve en réglages de tenant, modifiables par le SuperAdmin seul ; rien en dur.
- Écran conforme au design (composants du socle seulement) ; écarts consignés dans
  `docs/designs/s52-budget-envoi-adaptateur.md`.
- `pnpm lint`, `tsc`, `pnpm test --run` verts ; e2e verts en CI ; revue `/ks-review` passée.
- **À prévoir au déploiement** : aucune nouvelle minuterie (le planificateur de s26 rejoue les reportés) ;
  rappel — `asl-cms-planificateur` n'est toujours pas installé sur le VPS (mémoire projet).

## Correctifs de revue

Revue `docs/reviews/s52-budget-envoi-adaptateur.md` (2026-11-14) : deux défauts majeurs, mineurs n° 3, 6, 7
et 8 corrigés ; n° 4, 5 et 9 laissés tels quels, à la demande de Marie-Ève. Un commit de correctifs sur la
branche, migration `0051` comprise.

- [x] **Majeur n° 1 — plafond des campagnes le lendemain d'un report.** Arbitrage de Marie-Ève
      (2026-11-14) : **les parts glissent**. Le reste reporté part d'abord, le lendemain, et la suite de la
      campagne glisse d'un jour, sans qu'aucun jour ne dépasse `campaign.daily_send_cap`, toutes campagnes
      confondues (question 4 du design, tranchée). Mise en œuvre :
  - `campaign_part.deferred_to` / `deferred_count` (modèle, `pnpm db:generate` → `0051`) : le jour et la
    taille du reste, figés au report (`markCampaignPartDeferredTxnDao`). La part entamée garde son jour.
  - `getAllottedRecipientsByDayDao` compte ce reste ce jour-là : le plan d'une nouvelle campagne le voit.
  - Au report, sous le verrou du plan (`lockCampaignScheduleTxnDao`), la règle pure
    `slidePartsAfterDeferral` place chaque part programmée au premier jour qui la tient sous le plafond,
    après le reste de sa campagne ; `moveCampaignPartTxnDao` déplace la part et l'échéance de sa tâche
    ouverte non prise (02:00 Paris, `partRunAfter`). Une part ne glisse jamais avant son jour ; une part
    plus grande qu'un plafond abaissé depuis prend un jour libre. Le plafond lu est celui du jour du
    report.
  - Sans report, rien ne change (tests de s26 intacts). Aucune tentative comptée ; le reste n'est ni
    perdu ni renvoyé (les destinataires restent `pending`, pris un par un). `{date}` d'une part glissée
    vaut son nouveau jour, celui où elle part (ADR 052).
  - Limite connue : un reste reporté une seconde fois quitte le jour où il devait partir ; ce qui en est
    parti ce jour-là n'y est plus compté. C'est le jour courant, budget épuisé : un envoi de plus n'y part
    que sur une unité rendue.
  - **ADR** : complète l'ADR 053 §5 sans le contredire (destinataire rendu `pending`, tâche reprogrammée
    sans tentative, la ligne de destinataire reste la file de report) et applique au report la règle de
    l'ADR 052 (« le plafond est un budget du jour, partagé entre campagnes »). Pas d'ADR 054 ; l'ADR 053
    n'est pas modifié.
  - Écrans : inchangés. Chaque part affiche son jour (glissé le cas échéant) ; le bandeau et la sous-ligne
    « 60 reçues · 40 reportées au 15/11 » restent justes.
- [x] **Majeur n° 2 — rejeu sans limite d'un email refusé.** Sur un refus certain, le rejeu retente
      jusqu'à `campaign.send_max_attempts` (réglage de tenant lu comme les campagnes, 3 par défaut ; pas
      de valeur en dur, ADR 010), comptées par `job.attempts`. Au-delà : la tâche finit `failed`, la ligne
      `deferred_email` passe `failed` (`markDeferredEmailFailedTxnDao`) et son adresse et son contenu sont
      effacés dans la même instruction (critère 7). Le statut est un `text` à liste fermée : aucune
      migration. `/bureau/envois` la montre « En échec » (`badge` `destructive`, §3.13), hors du total en
      attente et de la date du prochain envoi.
- [x] **Mineur n° 3 — `deferredDayOf`.** Lit `campaign_part.deferred_to`, posé par le report seul : une
      nouvelle tentative à +30 min qui passe minuit n'est plus montrée comme un report. Les deux lectures
      de parts ne joignent plus `scheduled_job`.
- [x] **Mineur n° 6 — marge de 02:00.** Écrit dans `docs/architecture.md` : la marge ne protège que les
      rejeux et les parts d'un jour suivant ; un envoi reportable direct entre 00:00 et 02:00 heure de
      Paris compte sur le nouveau jour de Paris, alors que Brevo (s'il compte en UTC) est encore sur la
      veille. Volume faible, accepté.
- [x] **Mineur n° 7 — témoin `notification_failed`.** Un rejeu de notification au bureau en échec
      définitif, ou d'issue inconnue (`to_verify`), pose le témoin du message de contact ou du signalement
      d'origine, comme l'envoi direct. Une nouvelle tentative encore possible ne le pose pas.
- [x] **Mineur n° 8 — `parisDayStart`.** Retiré avec son test (et `parisOffsetMsAt`, qu'il était seul à
      utiliser).
