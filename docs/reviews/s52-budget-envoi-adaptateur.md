# Revue s52-budget-envoi-adaptateur (deuxième revue)

J'ai relu le diff `git diff main...feature/s52-budget-envoi-adaptateur` (commits `1d50c9e9` et `f2befbec`). Le commit de correctifs `f2befbec` a été relu comme du code neuf. Je l'ai confronté au plan (`validated: yes`, section « Correctifs de revue »), à AGENTS.md, aux ADR 053, 052, 010, 002 et 003, au design system et à `docs/designs/s52-budget-envoi-adaptateur.md`.

La première revue (même date) avait relevé deux défauts majeurs et sept mineurs, `Max severity: major`, `Ship allowed: yes`. À la demande de Marie-Ève, les majeurs 1 et 2 et les mineurs 3, 6, 7 et 8 ont été corrigés avant la livraison ; les mineurs 4, 5 et 9 ont été laissés volontairement. Arbitrage du majeur 1 (2026-11-14) : les parts glissent.

**Verdict :** les défauts majeurs 1 et 2 et les mineurs 3, 6, 7 et 8 sont bien corrigés. Le nouveau code n'introduit aucun défaut critique ni majeur. Il reste cinq points mineurs.

## Plan compliance

- [x] Les tâches 1 à 10 sont toujours présentes. Les six correctifs cochés au plan sont tous dans `f2befbec`.
- [x] Les mineurs 4, 5 et 9 sont laissés tels quels, comme prévu, et le plan le dit.
- [x] Rien n'est ajouté hors du plan. Le retrait de la jointure `scheduled_job` dans `getCampaignPartsDao` et `getOpenCampaignPartsDao` vient du mineur n° 3 et il est écrit au plan.
- [x] La question n° 4 du design est tranchée et consignée, avec l'arbitrage du 2026-11-14 (§4, `docs/designs/s52-budget-envoi-adaptateur.md`).

## Anti-hallucination

- [x] J'ai ouvert chaque cible nouvelle, rien n'est inventé :
  - `markContactMessageNotificationFailedDao(messageId)` (`contact-message-repository.ts:95`) et `markIncidentReportNotificationFailedDao(reportId)` (`incident-report-repository.ts:166`) ;
  - `getCampaignSendMaxAttempts` (`association-settings-types.ts:786`), `getAssociationSettingsService` et `retryDelayMs`, déjà importés dans `email-service.ts` ;
  - `deferredSendOn` et `deferredRunAfter` (`email-budget-rules.ts:42,45`) ;
  - `partRunAfter`, `lockCampaignScheduleTxnDao` (`pg_advisory_xact_lock`, le même verrou que la création d'une campagne, `campaign-service.ts:424`) et `deferJobTxnDao`, qui rend la tentative.
- [x] **Migration 0051 :** générée par drizzle-kit, pas écrite à la main.
  - `prevId` de 0051 = `id` de 0050 ; le journal a `idx` 51.
  - Le snapshot ne diffère de 0050 que par les deux colonnes ajoutées, plus deux réordonnancements de clés (`asc` / `isExpression`), typiques de drizzle-kit.
- [x] **Statut `failed` de `deferred_email` :** la colonne est un `text` sans contrainte CHECK (0049), donc il ne fallait pas de migration.

## Majeur n° 1 : les parts glissent

`slidePartsAfterDeferral` (`campaign-schedule-rules.ts`) et `deferPartOutcome` (`campaign-service.ts:837`) tiennent. Vérifié à la main sur les cas suivants.

- **Ordre.** Les parts sont traitées dans l'ordre de leur jour d'origine (tri stable, le DAO trie par `scheduled_for` puis `number`).
  - Une part repoussée est placée avant les parts d'origine du jour suivant.
  - `floor[campagne]` place chaque part après le reste et après la part précédente de sa campagne : l'ordre d'une campagne est conservé.
  - Le test de la maquette (40 le 15/11, la part 3 au 16/11) et le test « toute la campagne glisse » épinglent les jours exacts.
- **Plafond.** Le reste est placé d'office sur J+1. La somme des restes nés le jour J reste au plus égale à la charge de J, elle-même sous le plafond. Les autres parts ne passent que si `charge + taille <= plafond`.
- **Pas de boucle infinie.** `fits` accepte toujours un jour vide (`taken <= 0`). Au-delà de la dernière charge connue, les jours sont vides, donc la boucle finit, même avec un plafond abaissé ou nul. Un test le couvre.
- **Verrou.** Le verrou est pris en premier dans le `withTenant`, avant `markCampaignPartDeferredTxnDao`, la lecture et les déplacements. Deux reports concurrents se sérialisent : le second voit le `deferred_to` du premier.
- **Tâches.** Elles sont reprogrammées à 02:00 Paris (`partRunAfter`) et seulement si elles sont ouvertes et non prises (`locked_at is null`). La part ne bouge que si elle est `scheduled`. La part entamée (`sending`, jour J) n'est jamais déplacée.
- **Ni perte ni double envoi.** Les destinataires restent `pending` et sont pris un par un. `deferred_count` est figé en une instruction (sous-requête `count(*)`). Aucune tentative n'est comptée (issue `deferred` → `deferJobTxnDao`, `attempts - 1`).
- **`getAllottedRecipientsByDayDao`.** Il compte bien le reste à son jour (`sum(deferred_count)` groupé par `deferred_to`, parts échouées exclues). Après l'envoi du reste, la part `sent` y reste comptée, ce qui est juste pour l'historique. Le test SQL l'épingle.
- **Limite connue (reste reporté une seconde fois) : acceptable.** J+1 perd le décompte de ce qui en est parti, mais c'est le jour courant et son budget global est épuisé. Une part ajoutée ce jour-là serait elle-même reportée, sauf sur une unité rendue. Le dépassement n'est donc que théorique, et la limite est écrite au plan.

## Majeur n° 2 : rejeu borné

- [x] **Plafond de tentatives.** Il est lu dans le réglage de l'association `campaign.send_max_attempts`, sans valeur en dur (ADR 010). Un test passe le réglage à 5 : la 3e tentative est une nouvelle tentative, la 5e échoue.
  - `job.attempts` est incrémenté à la prise, donc `attempts < max` donne exactement `max` tentatives, comme `failedAttemptOutcome`.
- [x] **Effacement.** `markDeferredEmailFailedTxnDao` passe la ligne en `failed` et efface l'adresse, l'objet, les corps, les en-têtes, la réponse et le nom d'expéditeur dans le même `UPDATE`, gardé par `status = 'sending'`. Le test SQL vérifie chaque colonne et l'absence de l'adresse dans les paramètres.
  - `claimDeferredEmailForSendTxnDao` ne prend que `pending` : une ligne `failed` n'est jamais rejouée.
- [x] **« En échec » sur /bureau/envois.** Le badge utilise `Badge variant="destructive"`, conforme au §3.13, et le libellé est dans `messages/fr.json`.
  - Il est hors de `pendingRecipientTotal` et de `nextSendOn` (filtre `state === 'scheduled'`). Le test de service et le test de composant l'épinglent (`data-slot="badge"`, `bg-destructive`).

## Mineurs corrigés

- [x] **n° 7.** Le témoin est posé sur un échec définitif et sur `to_verify`, sous `withTenant`, et pas sur une tentative restante. Un test épingle `not.toHaveBeenCalled` à `attempts: 1`. Un témoin qui ne se pose pas est journalisé sans contenu.
- [x] **n° 3.** `deferredDayOf` lit `deferred_to`, posé par le report seul.
- [x] **n° 6.** La limite est écrite dans `docs/architecture.md`.
- [x] **n° 8.** `parisDayStart` et `parisOffsetMsAt` sont retirés avec leur test, et plus rien ne les référence (tsc).

## Rules compliance

- [x] **AGENTS.md :**
  - aucune nouvelle table ;
  - les colonnes ajoutées sont sur `campaign_part`, déjà sous RLS forcée (0046) ;
  - les repositories passent par `getDb()` ;
  - aucune nouvelle occurrence de `withRlsBypass` ;
  - rien en dur ;
  - aucune donnée personnelle dans les journaux.
- [x] **ADR 052 :** respecté. Le plafond reste un budget du jour partagé entre campagnes, et `{date}` vaut le nouveau jour de la part.
- [x] **ADR 053 §5 :** complété sans être contredit.
- [x] **Design system :** aucun composant, token ou couleur hors du système. L'intention de l'écran est tenue : chaque part montre son jour, glissé le cas échéant.

## Tests

- [x] **Suite unitaire relancée par le relecteur**, sur une copie locale (`git archive`) :
  - `Test Files 347 passed (347)`, `Tests 4371 passed | 4 skipped (4375)` ;
  - sortie 0, aucun timeout.
- [x] `tsc --noEmit` : 0 erreur hors `.next/`.
- [x] `eslint` sur tous les fichiers .ts et .tsx du diff : 0 erreur.
- [x] Les tests du service livrent une part sur un store simulé et vérifient :
  - le reste, son jour et son compte ;
  - le glissement de la part suivante avec sa tâche (02:00Z+1) ;
  - le plafond sur tous les jours ;
  - le verrou pris avant la lecture.
- [ ] L'e2e n'a pas été lancé en local (règle du dépôt : il tourne en CI). Le glissement n'a pas de scénario e2e : il n'est couvert qu'en unitaire, SQL compris.

## Regressions

- [x] Sans report, le plan de s26 est intact (test « une part servie sans report ne touche pas au plan », tests de s26 verts).
- [x] `getCampaignPartsDao` et `getOpenCampaignPartsDao` ne joignent plus `scheduled_job`. Tous les appelants compilent (`nextRunAfter` → `deferredTo`).

## Findings

**Défauts mineurs**

1. **Le reste ne part pas forcément d'abord face aux autres campagnes.** `campaign-service.ts` (`deferPartOutcome`) et `scheduled-job-repository.ts` (prise des tâches par `run_after, id`).
   - Le reste et une part d'une autre campagne qui tient le même jour partent tous deux à 02:00. Leur ordre dépend de l'uuid de la tâche.
   - Si le budget global du lendemain est de nouveau court (notifications, etc.), la part de l'autre campagne peut passer avant le reste, qui est alors reporté une seconde fois.
   - Le plafond des campagnes tient quand même. La priorité « le reste d'abord » est garantie dans le plan et au sein d'une campagne, pas à l'exécution d'une campagne à l'autre.
   - Le test multi-campagnes ne vérifie que des invariants (plafond, ordre de b), pas les jours exacts de chaque part.

2. **Les deux mises à jour de `moveCampaignPartTxnDao` ne vérifient pas leur effet** (`campaign-repository.ts`).
   - Si la part bouge mais que sa tâche est verrouillée, part et tâche divergent.
   - C'est inatteignable aujourd'hui : une tâche d'un jour futur n'est jamais prise, et toute issue lève le verrou. Un garde-fou (nombre de lignes, ou une seule instruction) rendrait l'invariant explicite.

3. **ADR 053 §4 fige la liste des statuts de `deferred_email` à `pending | sending | to_verify`.** `failed` y est ajouté sans ADR.
   - C'est un complément cohérent, documenté dans `docs/architecture.md` et dans le plan, et non une contradiction.
   - Mais les ADR sont immuables : l'ajout mériterait une ligne d'ADR, ou une mention explicite au plan « pas d'ADR » comme pour le majeur n° 1.

4. **Les lignes « En échec » restent à vie dans la carte « En attente »** (`email-sending-overview.tsx`, `listPendingDeferredEmailsDao`).
   - La carte est décrite comme « ce qui partira seul ». Ces lignes n'ont ni purge ni sortie, et la liste peut grossir et se paginer indéfiniment.
   - À trancher avec la question « Aucune sortie de À vérifier » du §3.13.

5. **`email-service.ts` importe directement les repositories de deux autres domaines** (`contact-message`, `incident-report`) pour poser le témoin.
   - C'est permis (un service appelle des repositories), mais ça couple l'adaptateur d'email à ces domaines. Un petit service de chaque domaine serait plus propre.

**Restent ouverts, laissés volontairement :** les mineurs 4, 5 et 9 de la première revue (contenu `to_verify` sans limite de durée ; va-et-vient d'une part `released` quand les envois sont désactivés ; invitations classées `platform` jusqu'à s42).

Max severity: minor
Ship allowed: yes
