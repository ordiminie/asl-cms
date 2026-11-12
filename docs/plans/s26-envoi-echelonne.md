---
validated: yes
---

# Plan — Story s26-envoi-echelonne

Branch: `feature/s26-envoi-echelonne` (depuis `origin/main` à `67778fe3`, après le merge de la PR 65).

Entrées : `docs/stories.md` (s26, complexité 4), `docs/research/s26-envoi-echelonne.md`,
`docs/designs/s26-envoi-echelonne.md` (validé le 2026-11-12), `docs/design-system.md`,
`docs/decisions/052-planificateur-script-minuterie-parts-de-campagne.md` (écrit avec ce plan).

> ⚠️ **La recherche est antérieure à la scission du 11 novembre** : elle raisonne sur un seuil de 300, un
> budget transverse et une file de report, qui sont passés à s52. Ses pièges 3 à 6, 9 à 14 et 16 restent
> valables et ont été **relus dans le code** pour ce plan ; ses questions 1 à 3, 11 et 12 sont à s52.

## Target story

**En tant que** membre du bureau **je veux** que les grosses campagnes s'étalent toutes seules sur plusieurs
jours, et voir qui a reçu la campagne **afin de** ne pas dépasser le quota d'envoi ni générer de surcoût, et
de savoir à qui elle est parvenue.

Critères d'acceptation (résumé fidèle ; texte complet dans `docs/stories.md`, l. 2031-2108) :

1. Plus de destinataires que le **plafond quotidien des campagnes** (100 par défaut) → parts quotidiennes,
   la première le jour même, sans action du bureau ; au plus le plafond → un seul envoi.
2. 250 destinataires → 100, 100, 50 ; le nombre de parts n'est jamais codé en dur.
3. Le plafond est un **paramètre de tenant** : 500 fait partir 400 destinataires en un envoi.
4. Le plafond vaut **par jour et par association pour toutes les campagnes** : deux campagnes du même jour
   se partagent les 100 envois.
5. **Indicateur par destinataire** : _reçue_ (date), _programmée pour le <jour>_, _à vérifier_, _en échec_ ;
   pour la campagne, les destinataires et l'état de chaque part.
6. Liste des destinataires **paginée**, bornée à la campagne et à l'association, **sans jeton**.
7. Un redémarrage avant ou pendant une part ne perd ni ne duplique rien.
8. **Jamais deux fois** le même destinataire, même relancé ou déclenché en parallèle ; l'arrêt entre l'envoi
   et son enregistrement est _à vérifier_, jamais rejoué.
9. Une part programmée pour demain est _programmée_, pas _bloquée_.
10. Un échec arrête la part sans perdre les suivantes ; nouvelle tentative au passage suivant, dans une limite
    (paramètre de tenant, **défaut fixé ici : 3**), après quoi la campagne est _en échec_.
11. `scheduled_job` et la table des parts sont **isolées par tenant** (test d'accès croisé).
12. Le planificateur est déclenché par une **minuterie systemd** installée et documentée ; un passage ne
    traite que le dû, deux passages simultanés ne traitent jamais deux fois la même part.

## Arbitrages posés par ce plan (à valider avec lui)

Ils figurent dans l'ADR 052 ; ce sont ceux que la story renvoyait au plan, plus un ajout.

| Sujet                       | Décision                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Déclencheur                 | **Script `tsx` + minuterie systemd toutes les 5 min**, comme la purge ; pas de route, pas de secret. Un passage immédiat de l'association part aussi en `after()` à la création. |
| Parts                       | Table **`campaign_part`** + une tâche `campaign.deliver_part` par part. Plafond du jour rempli sous verrou consultatif par association.                                          |
| Non-doublon                 | `pending → sending` atomique **avant** l'envoi ; refus HTTP certain → retour `pending` ; tout autre échec ou arrêt > 15 min → **`to_verify`**, jamais renvoyé.                   |
| Tentatives                  | **3** (`campaign.send_max_attempts`), reprise à +30 min × tentative ; ensuite part, parts suivantes et campagne en échec.                                                        |
| `{date}` d'une part         | **Le jour de la part**, pas celui de la création.                                                                                                                                |
| Désinscrit entre deux parts | **Ne reçoit pas** les parts suivantes (statut `unsubscribed`, visible dans « Tous »). Cet état n'est **pas dans la maquette** : voir « Écarts au design ».                       |
| `effectiveCampaignStatus`   | **Supprimée** avec `CAMPAIGN_STALE_AFTER_MS` : « À vérifier » et « En échec » se lisent des statuts et décomptes.                                                                |

### Écarts au design validé (à reporter dans `docs/designs/s26-envoi-echelonne.md` au passage)

- **La carte « Envois » des Réglages n'existe pas** : la maquette la suppose avec un champ « Adresse de
  réponse des campagnes » ; en réalité les réponses vont à `contact.email` (carte des adresses de
  notification). Le plan crée la carte « Envois » avec **le seul champ « Plafond quotidien des campagnes »** ;
  il ne duplique pas l'adresse de réponse. **La carte porte en plus un second champ, « Nombre de tentatives
  d'envoi d'une part » (3 par défaut)** : le registre génère la page et la story exige un paramètre de tenant ;
  la maquette ne le dessine pas. Même type « Nombre » (§3.1), aucun composant nouveau ; à confirmer.
- **État « Désinscrit »** d'un destinataire (arbitrage ci-dessus) : `badge` `outline` texte
  `muted-foreground`, mot écrit « Désinscrit », **sans nouveau filtre** ni nouvelle paire au compteur. Gap
  à consigner, non comblé librement.

## Tasks (ordered)

Dix tâches : le seuil de la story. Si la tâche 5 s'élargit au-delà de ce qui est écrit, **s'arrêter et
séparer la reprise automatique** (tâches 5, partie « échec et reprise ») dans `docs/stories.md` avant de
continuer — c'est la coupe que la story prévoit.

1. [x] **Règles pures et paramètres du tenant.** Dans `src/services/rules/` (nouveau
       `campaign-schedule-rules.ts`) : `planCampaignParts(recipientCount, dailyCap, allottedByDay, today)` →
       `[{day, count}]` (jours remplis dans l'ordre, jours déjà pleins sautés, jamais de part nulle) ;
       `parisDayStart(day)` → instant du minuit de Paris (DST) ; `dueDayOf` via `calendarDayOf` (existant) ;
       `retryDelayMs(attempt)`. Dans `association-settings-types.ts` : clés `campaign.daily_send_cap`
       (nombre entier ≥ 1, défaut `100`, unité « envois par jour ») et `campaign.send_max_attempts` (entier 1-10,
       défaut `3`, unité « tentatives » ; le registre génère l'écran, une clé sans `page` n'existe pas),
       accesseurs `getCampaignDailySendCap` / `getCampaignSendMaxAttempts`, nouvelle `section: 'sending'`
       (carte « Envois » de la page Réglages), libellés `messages/fr.json` (`AssociationSettings`).
       _Échoue si :_ 250 → 100/100/50 ; 100, 101, 200, 201, 300 ; plafond 500 et 400 → 1 part ; 40 déjà
       alloués aujourd'hui → 60 puis 100… ; deux campagnes le même jour ; jour déjà plein sauté ; DST du 29/03
       et du 25/10/2026.
2. [x] **Schéma et migrations.** `src/db/models/scheduled-job-model.ts` (`scheduled_job`, ADR 006 +
       `failed_at`, unique `(organization_id, kind, idempotency_key)`, index des tâches dues) ;
       `campaign-model.ts` : table `campaign_part` (`campaign_id` cascade, `number`, `scheduled_for` en `date`
       mode string, `recipient_count`, statut `scheduled | sending | sent | failed`, `finished_at`, unique
       `(campaign_id, number)`), `campaign_recipient.part_id` (FK `campaign_part`), `claimed_at`, et trois
       valeurs d'enum de statut : `sending`, `to_verify`, `unsubscribed`. `pnpm db:generate` pour le schéma ;
       `drizzle-kit generate --custom` pour (a) la RLS **forcée** + `tenant_isolation` des deux tables, calquée
       sur `0044_campaign_rls.sql`, (b) le **rattrapage des campagnes de s25** : une part 1 par campagne
       existante (jour = `send_date`, statut dérivé de la campagne), `part_id` renseigné, puis `NOT NULL`.
       Jamais de SQL ni de journal écrits à la main. Tenir `docs/architecture.md` (titre, compteur « 22 » → 24,
       « 41 tables » → 43, une ligne par table) et `src/db/rls-inventory.test.ts`.
       _Échoue si :_ l'inventaire RLS ne connaît pas les deux tables ; le rattrapage laisse un `part_id` nul.
3. [x] **Planificateur générique** (ADR 006, 052). `scheduled-job-repository.ts` :
       `enqueueScheduledJobTxnDao` (idempotent par la clé unique), `claimDueJobsTxnDao` (échéance, verrou
       absent ou périmé de 15 min, tentatives restantes, `FOR UPDATE SKIP LOCKED`, pose `locked_at` et
       `attempts + 1` dans la même instruction), `completeJobTxnDao`, `rescheduleJobTxnDao`,
       `failJobTxnDao`, `releaseJobTxnDao` (sans compter la tentative). `scheduled-job-service.ts` :
       `runDueScheduledJobsService({handlers, organizationId?})` — liste les associations
       (`getAllOrganizationIdsDao`), **un `withTenant` par association**, claim en transaction courte puis
       exécution **hors verrou**, erreur d'une association isolée des autres (modèle de
       `purgeExpiredRateLimitFingerprintsService`). Façade `scheduled-job-service-facade.ts` qui compose le
       registre `kind → handler` à partir du service des campagnes. Script
       `src/db/scripts/run-scheduled-jobs.ts` (modèle exact de `purge-rate-limit-fingerprints.ts` :
       `allowServerOnly()`, `initDotEnv()`, import dynamique, code de sortie non nul si une association échoue).
       _Échoue si :_ deux appels simultanés traitent une tâche deux fois ; une tâche dont le verrou a 16 min
       n'est pas reprise ; une tâche à 14 min l'est ; la clé d'idempotence est ignorée ; une association en
       échec arrête les autres ; le script sort 0 malgré un échec.
4. [x] **Création d’une campagne en parts.** `sendCampaignService` : lit le plafond (réglages), puis, **dans
       `withTenant` et sous `pg_advisory_xact_lock` par association** (patron de
       `association-category-repository.ts:93`), lit les alloués par jour, appelle `planCampaignParts`, crée
       la campagne, ses parts, ses destinataires (chacun avec son `part_id`, répartis dans l'ordre stable de
       `recipient.id`) et **une tâche par part** (`run_after` = maintenant pour aujourd'hui, `parisDayStart`
       ensuite) — le tout dans la transaction existante de `createCampaignWithRecipientsTxnDao`. `deliver`
       devient « passage immédiat des tâches dues de l'association » (le contrat `deliver: (() => Promise<void>)
| null` et le `after()` de l'action ne changent pas). Nouveau `previewCampaignPlanService` (lecture seule,
       sans verrou) pour l'écran d'aperçu. Une soumission rejouée ne crée ni part ni tâche (unique existant).
       _Échoue si :_ 250 → 3 parts et 3 tâches ; 100 → 1 part ; plafond 500 / 400 destinataires → 1 part ;
       deux créations simultanées de 100 le même jour ne dépassent pas 100 ; un rejeu de `submissionId` ne
       duplique rien.
5. [x] **Livraison d'une part.** Remplace `deliverCampaignService` par `deliverCampaignPartService` (le
       gestionnaire de `campaign.deliver_part`). Dans l'ordre : balayage des lignes `sending` de plus de 15 min
       → `to_verify` ; part `sending` ; pour chaque destinataire `pending` de la part, **sans fiche
       désinscrite** (sinon `unsubscribed`) : `claimRecipientForSendDao` (`pending → sending`, `claimed_at`,
       atomique) → `sendToRecipient` avec `{date}` = jour de la part → `markRecipientSentTxnDao`. Échec :
       refus certain (nouveau drapeau `refused` sur `EmailTransportError`, posé par `brevo-transport` et
       `resend-transport` sur réponse non 2xx) → ligne `pending` + part reprogrammée (+30 min × tentative) ;
       autre échec → `to_verify` + reprogrammation. Tentatives épuisées → part, parts suivantes, destinataires
       non reçus `failed`, campagne `interrupted`. Dernière part terminée → `finishCampaignTxnDao(…, 'sent')` ;
       une part intermédiaire ne clôt rien. Envois désactivés par les réglages → tâche libérée sans tentative.
       Retirer `effectiveCampaignStatus` et `CAMPAIGN_STALE_AFTER_MS`.
       _Échoue si :_ un destinataire `sending` n'est jamais renvoyé ; deux passages parallèles sur la même part
       envoient une seule fois chaque email ; un arrêt simulé entre envoi et marquage laisse `to_verify` ;
       un refus HTTP → retry, une exception réseau → `to_verify` ; la part 1 terminée ne clôt pas la campagne ;
       la dernière la clôt ; un désinscrit entre deux parts n'est pas écrit ; une `sending` à 14 min n'est pas
       balayée, à 16 min elle l'est ; `{date}` = jour de la part ; trois échecs → campagne `interrupted` et
       parts suivantes `failed`.
6. [x] **Lectures et DTO.** `CampaignDTO` gagne : décomptes par statut de destinataire (reçue, programmée,
       à vérifier, en échec, désinscrit), `parts: CampaignPartDTO[]` (numéro, jour, destinataires, état) et un
       `displayState` dérivé (« En cours d'envoi », « Envoyée », « À vérifier » si `sent` avec des
       `to_verify`, « En échec » si `interrupted`) — liste blanche, **aucun jeton**. Nouveau
       `getCampaignRecipientsPageDao` + `getCampaignRecipientsService` : filtre par statut (« Tous » par
       défaut), 25 par page, tri par nom puis `id`, borné à la campagne **et** à l'association, `memberProfileId`
       `NULL` toléré (le `innerJoin` actuel fait disparaître la ligne : `leftJoin`, libellé repli). Façade, DAL
       (sans `'use cache'`, un test de source l'interdit), `page.tsx` de la campagne lit `?statut=` et `?page=`.
       _Échoue si :_ un décompte diverge d'une somme de lignes ; la page 2 du filtre « À vérifier » ; une
       campagne d'une autre association → introuvable ; le DTO contient `unsubscribe` ; un destinataire sans
       fiche apparaît.
7. [x] **Écran 1 — aperçu et confirmation** (`campaign-preview-step.tsx`, `S1Apercu`). Section « Destinataires
       et plan d'envoi » : envoi unique, plan écrit (nombres en `data` à droite, filet 2 px), déjà-parti du jour
       (1c), `alert` `warning` quand le plafond du jour est atteint (1d), `alert-dialog` qui répète le plan (1e),
       bouton 56 px / pile en mobile ; en succès, `alert` neutre « Campagne lancée… » (2j). Libellés
       `messages/fr.json` (`CampaignsBureau`), dates `jj/mm/aaaa` dès que le plan dépasse trois jours.
       _Échoue si :_ un composant n'affiche pas « 1 part / 3 jours / report » selon le DTO ; la confirmation
       cite un plan différent de l'aperçu ; mobile ancré en bas ; aucun message « trop de destinataires ».
8. [x] **Écrans 2, 3 et 4 — détail, archive, réglage.** `campaign-detail.tsx` : bandeau d'état (`alert`
       neutre **sans icône**, `warning`, `destructive`, succès), carte Avancement (`progress` « n sur N », compteur
       à quatre valeurs en `dl`), carte « Envois par jour » (absente si une seule part ; cartes empilées sous
       640 px), carte Destinataires (`select` « Afficher » avec décomptes, résumé `aria-live`, tableau paginé,
       « Précédent » inactif en page 1), paire « Plafond » du Résumé ; `campaign-progress-refresh.tsx` ne
       relit **que** tant qu'une part est `sending` (pas pour une part programmée) ; `campaign-list.tsx` :
       colonnes « Lancée le » et « 200 sur 296 », badges d'état de campagne ; page Réglages : carte « Envois »
       générée depuis le registre (tâche 1). Badges d'un destinataire : composition du tableau de
       `docs/designs/s26-envoi-echelonne.md` (Reçue `outline` + date `data` hors badge ; Programmée
       `secondary` ; À vérifier `outline` + point `primary` ; En échec `destructive` ; Désinscrit `outline`
       muet). _Échoue si :_ une part programmée est rendue « interrompue » ou « bloquée » ; le filtre revient
       à la page 1 ; aucun état ne repose sur la couleur seule ; le jeton est dans le HTML ; la relecture
       continue sur une campagne seulement programmée ; la carte « Envois » manque à `/bureau/reglages`.
9. [x] **Exploitation, ADR et docs vivantes.** `ops/systemd/asl-cms-planificateur.{service,timer}` (modèle
       de la purge : même utilisateur, durcissement identique ; `OnCalendar=*:0/5`, `Persistent=true`,
       `RandomizedDelaySec` court) ; `ops/ops-config.test.ts` l'épingle (`ExecStart`, directives, cadence
       < 1 jour) ; `docs/exploitation/README.md` (copie des unités, `enable --now`, `list-timers`,
       `journalctl -u asl-cms-planificateur`, que faire d'une ligne « À vérifier ») ; ADR 052 déjà écrit ;
       `docs/design-system.md` : « Formes retenues par s26 » (filtre de tableau §3.5, `alert` neutre sans icône
       — à traiter avec la variante « muted » de s48 —, `warning` pour un report, compteur, plan écrit,
       « Précédent » inactif) ; `docs/designs/s26-envoi-echelonne.md` : les deux écarts ci-dessus.
       _Échoue si :_ `ops-config.test.ts` ne voit pas l'unité ; la doc ne mentionne pas l'installation de la
       minuterie.
10. [x] **e2e — isolation et étalement** (`e2e/campaigns.spec.ts`, contre un build de production, seed
        déterministe tenu dans `src/db/scripts/seed.ts`). (a) Plafond du tenant abaissé à 2, campagne de 5
        membres : trois parts, première reçue (outbox `file`), suivantes **programmées** ; relance du
        planificateur sans nouveau mail pour les reçus. (b) **Accès croisé entre deux tenants** : l'autre
        association ne voit ni la campagne, ni ses parts, ni ses destinataires, ni ses tâches ; une URL forgée
        rend « introuvable ». (c) Redémarrage simulé : ligne `sending` vieillie → `to_verify`, aucun renvoi.
        _Échoue si :_ l'autre tenant lit une ligne de `campaign_part` ou `scheduled_job`.

## Files touched

Nouveaux : `src/services/rules/campaign-schedule-rules.ts` (+ test) · `src/db/models/scheduled-job-model.ts` ·
`src/db/repositories/scheduled-job-repository.ts` (+ test) · `src/services/scheduled-job-service.ts` (+ test) ·
`src/services/facades/scheduled-job-service-facade.ts` (+ intercepteur de logs, `shouldLogDetails: () => false`) ·
`src/db/scripts/run-scheduled-jobs.ts` · `ops/systemd/asl-cms-planificateur.{service,timer}` ·
`drizzle/migrations/0045_*.sql` (schéma, généré) et `0046_*_rls.sql` (custom) + `meta/` (générés) ·
`docs/decisions/052-planificateur-script-minuterie-parts-de-campagne.md` (déjà écrit) ·
`docs/research/s26-envoi-echelonne.md`, `docs/designs/s26-envoi-echelonne*` (déjà présents, commités avec la story).

Modifiés : `src/db/models/campaign-model.ts` · `src/db/repositories/campaign-repository.ts` (+ test) ·
`src/services/campaign-service.ts` (+ tests) · `src/services/rules/campaign-rules.ts` (+ test ;
suppression de `effectiveCampaignStatus`) · `src/services/types/domain/campaign-types.ts` ·
`src/services/types/domain/association-settings-types.ts` (+ test) · `src/services/facades/campaign-service-facade.ts` ·
`src/app/dal/campaign-dal.ts` (+ test) · `src/lib/emails/transport/{email-transport,brevo-transport,resend-transport}.ts` (+ tests) ·
`src/app/[locale]/(bureau)/bureau/campagnes/**` (`page.tsx`, `[id]/page.tsx`, `actions.ts` et leurs tests) ·
`src/components/features/campaigns/{campaign-detail,campaign-list,campaign-preview-step,campaign-progress-refresh,campaign-format,campaign-test-data}.*` ·
page Réglages (rendu de la section `sending`) · `messages/fr.json` · `src/db/scripts/seed.ts` ·
`src/db/rls-inventory.test.ts` · `ops/ops-config.test.ts` · `e2e/campaigns.spec.ts` ·
`docs/architecture.md` · `docs/exploitation/README.md` · `docs/design-system.md`.

À ne pas toucher : `env.ts`, `env.example`, `ops/env.production.example` (aucun secret), `withRlsBypass`
(aucune occurrence nouvelle), `sendEmailService` (le budget de tout envoi est s52).

## Test strategy

Deux niveaux seulement (`rule-ci-cd-devops`) : **Vitest** (base et auth mockées, `pnpm test --run`) et
**Playwright** sur le build de production — jamais en local (mémoire du dépôt : machine trop juste ; build et
e2e se jouent sur GitHub).

- **Unitaire pur** (tâche 1) : la table des cas 100/101/200/201/250/300, plafond 500, jour partagé, DST.
  C'est le cœur, il se prouve sans base.
- **Unitaire avec repositories mockés** (tâches 3 à 6) : l'ordre des appels et les garde-fous — claim avant
  envoi, jamais d'envoi sur une ligne non `pending`, échec → état attendu, dernière part seule clôt,
  `withTenant` autour de chaque lecture, jamais `withRlsBypass`. **L'atomicité du `SKIP LOCKED` et du
  `UPDATE … WHERE status='pending'` n'est pas testable en unitaire** (`db.ts` refuse toute connexion en test) :
  elle est prouvée par l'e2e, et le plan l'écrit plutôt que de la faire passer pour vérifiée.
- **Composants** (tâches 7, 8) : tests Vitest/jsdom des états du design (a→j), un `describe` par écran, mobile
  et bureau ; contrôle d'accessibilité (`aria-live` du résumé, `aria-disabled` de « Précédent »).
- **Source** : tests de source existants conservés (pas de `'use cache'` dans le DAL des campagnes, aucun
  `withRlsBypass` nouveau, `provider-imports.test.ts`, `rls-inventory.test.ts`, `ops-config.test.ts`).
- **e2e** (tâche 10) : étalement bout en bout par plafond abaissé, accès croisé, reprise. Ne **pas** lancer
  `pnpm build` en vérification finale (règle du dépôt) ; `pnpm lint`, `pnpm exec tsc --noEmit` ciblés, et
  `pnpm test --run` sur les fichiers touchés. Le montage 9p de `/workspace` est lent : valider sur une copie
  locale si des workers expirent, **un timeout n'est jamais un vert**.
- **Tests existants à faire évoluer, pas à contourner** : `campaign-rules.test.ts` (statut effectif),
  `campaign-service` (livraison arrêtée au premier échec), `campaign-repository.test.ts`,
  `campaign-detail.test.tsx`, `campaign-list.test.tsx`, `campaigns.spec.ts`.

## Risques et points de vigilance

- **Enum Postgres** : `ALTER TYPE … ADD VALUE` ne s'emploie pas dans la transaction qui l'ajoute — le
  rattrapage des données (tâche 2) vit dans la migration **suivante** ; `pnpm db:generate` produit la
  structure, jamais de SQL à la main.
- **Horloge** : `new Date()` interdit sous `'use cache'` ; l'instant vient toujours de l'appelant
  (`calendarDayOf(instant)`). Aucun `logger` dans une fonction cachée ; jamais d'adresse ni de contenu dans un
  journal.
- **Verrou consultatif et `withTenant`** : le verrou se pose **dans** le scope de tenant, avant la lecture des
  alloués ; une lecture avant le verrou rouvre la course.
- **Compte Brevo partagé entre tenants** (research q. 13) : hors périmètre — un client, une clé. À rouvrir à la
  signature d'un second client.
- **Reprise d'une ligne `to_verify`** : aucune action dessinée ni livrée (ADR 052) ; si l'équipe technique en
  a besoin avant s42, c'est une story.

## Definition of Done

- Les 12 critères ci-dessus sont chacun couverts par un test nommé qui peut échouer, dont l'accès croisé
  entre deux tenants (e2e) ; aucun critère n'est « vérifié à la main ».
- 100, 101, 200, 201, 250 et 300 destinataires, plafond 500, et deux campagnes le même jour sont dans le jeu
  de tests de la tâche 1.
- Une seule PR, un seul commit de story (recherche, design, plan, ADR 052, règle `ks-design.md`) ; la
  migration de rattrapage peut être un second commit, à rejouer seule.
- Aucune valeur en dur : plafond (100) et tentatives (3) sont des **valeurs de registre** du tenant ; aucun
  nombre de parts écrit dans le code.
- Aucun `withRlsBypass` nouveau, aucune route, aucune variable d'environnement nouvelle.
- `pnpm lint`, `pnpm exec tsc --noEmit` et `pnpm test --run` verts ; e2e vert **sur GitHub**.
- `docs/architecture.md` (24 tables sous RLS forcée) et `rls-inventory.test.ts` à jour ; `docs/exploitation/`
  décrit l'installation et le contrôle de la minuterie ; ADR 052 présent.
- Revue passée (`/ks-review s26-envoi-echelonne`, `Ship allowed: yes`) avant `/ks-ship`.
- **Hors DoD de cette PR, rappel pour la recette** : l'unité `asl-cms-planificateur.timer` doit être installée
  sur le VPS **avant** le déploiement de la version qui porte s26 (leçon de s49).
