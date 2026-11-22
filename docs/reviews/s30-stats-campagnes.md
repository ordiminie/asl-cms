# Revue s30-stats-campagnes : ouvertures et clics des campagnes

Tour 4 — 21/11/2026. Branche `feature/s30-stats-campagnes`, commits :

- d099c552 (feat) ;
- a2373e45 (fix, tour 1 : M1, m3, m4, m5) ;
- c9654bf9 (fix, arbitrage complémentaire : m1, m2, m6) ;
- 6813fd0a (fix, tour 2 : m7, m8) ;
- 847d5a29 (fix, tour 3 : m9).

Diff jugé : `git diff main...feature/s30-stats-campagnes` (48 fichiers). Les quatre commits de correctif ont été relus comme du code neuf avec `git show`, et 847d5a29 ligne à ligne. Relecteur : subagent `reviewer`, contexte neuf, lecture seule.

**Verdict : envoi autorisé.** Ni critique ni majeur ; m9 est corrigé. Un nouveau mineur, m10 : l'argument retenu pour garder le jour prévu comme date de début de la portée est inexact quand le budget du jour est déjà épuisé au premier destinataire (rien ne part ce jour-là). Effet limité à l'affichage, d'un jour ; aucun chiffre n'est faux.

## 1. Vérifications exécutées

Copie du dépôt par `tar` en disque local, au HEAD 847d5a29, sans `node_modules` ni `.next` (`node_modules` en lien symbolique). Rien n'a été écrit dans /workspace.

| Vérification | Résultat |
| --- | --- |
| `pnpm test --run` | `Test Files  430 passed (430)`, **`Tests  5851 passed \| 1 skipped (5852)`**, `EXIT 0`. 0 occurrence de « timeout » ou « timed out » dans le journal. 4 tests de plus qu'au tour 3 (5847) : 2 tests de règle et 2 tests de carte. |
| `pnpm exec tsc --noEmit` | `TSC EXIT 0`, aucune sortie |
| `pnpm lint` | `✖ 2 problems (0 errors, 2 warnings)`, `LINT EXIT 0`. Avertissements hors diff : `.remember/tmp/last-ndc.ts` et `.scratch/check-migration.mjs`. |
| `pnpm exec drizzle-kit check` | `Everything's fine` |
| `pnpm exec playwright test --list e2e/campaigns.spec.ts` | `Total: 48 tests in 1 file`. Critère 3 s30 (l.1741) et critère 4 s30 (l.1770) listés, jusqu'à webkit. |

Ni build ni e2e : ils tournent en CI.

## 2. Références vérifiées

### Le calcul de 847d5a29 se fait sur les vraies lignes de destinataires

- `sentDayOf(part, counts)` (`src/services/rules/campaign-rules.ts:387-396`, non exportée) reçoit les `counts` construits par `toPartDto` (l.398-419), issus de `recipientCountsOf(countRows.filter((row) => row.partId === part.id))` (l.402-404) : les seules lignes de la part.
- Ces lignes viennent de `getRecipientStatusCountsDao` (`campaign-repository.ts`, après l.966) : `count()` groupé par campagne, part et statut sur `campaign_recipient`, via `getDb()`.
- `withPartsAndCounts` (`campaign-service.ts`) passe ses résultats à `toCampaignDto` → `toPartDto`. Les comptes sont réels.

### Lecture « aucun email parti » de `received + toVerify === 0`, statut par statut

Table `COUNT_KEY_OF` (l.318-328) ; transitions relues dans `campaign-service.ts:934-1001` et dans le repository.

| Statut de la ligne | Clé | Un email est-il parti ? | D'où vient la ligne |
| --- | --- | --- | --- |
| `sent` | `received` | oui | `markRecipientSentTxnDao` après `result.status === 'sent'` |
| `to_verify` | `toVerify` | peut-être, issue inconnue | `markRecipientToVerifyTxnDao` sur une erreur non certaine, et `markSending…ToVerifyTxnDao` (balayage, clôture) |
| `failed` | `failed` | **non** | `markRecipientFailedTxnDao` (ni email ni nom, avant tout envoi) ; `failUnreceivedRecipientsTxnDao` (l.803-815) ne touche que des lignes **`pending`** |
| `unsubscribed` | `unsubscribed` | **non** | `markRecipientUnsubscribedTxnDao` remplace l'envoi |
| `pending` | `scheduled` | non | refus certain → `releaseRecipientClaimTxnDao` (l.715-727), puis `failed` à l'interruption |
| `sending` | `sending` | inconnu | `finishPart` la convertit en `to_verify` avant de clore une part `sent` (l.1118) |

Aucun statut de rebond (`bounced`) : le produit ne lit pas les rebonds.

- **Une part `sent` à 0 + 0 n'a réellement rien envoyé** (tous ses destinataires désinscrits ou sans adresse) : l'écarter de la portée est la bonne lecture.
- **`failUnreceivedRecipientsTxnDao` ne transforme pas `to_verify` en `failed`** : un email peut-être parti garde la part dans la portée, choix prudent.
- Angle théorique : une ligne `sending` encore détenue par un passage concurrent vivant sur une part close en `failed`. Négligeable, non compté comme constat.

### L'argument sur le jour de début est inexact : voir m10

- `deliverCampaignPartService` (l.1134-1182) sert les destinataires un par un ; le premier qui reçoit `deferred` de `sendTenantEmail` (`email-service.ts:378-408`) arrête la part.
- `deferPartOutcome` (l.1056-1105) ne pose alors que `deferredTo` (et `deferredCount`). `scheduledFor` ne change pas pour la part reportée : `moveCampaignPartTxnDao` ne déplace que les parts `scheduled`.
- Si le budget accorde des envois avant d'être épuisé, la part envoie bien le jour prévu, puis reporte. **Mais si `claimReportableSendTxnDao` (`email-send-budget-repository.ts:27-43`) refuse dès le premier destinataire, rien ne part le jour prévu.**
- Ce refus est atteignable : `reportableCount` est partagé par **tous** les envois reportables de l'association (seul `login` y échappe, `isNeverDeferred`), alors que le plan de création (`planCampaignParts`, `campaign-service.ts:605-610`) ne voit que les attributions des campagnes (`getAllottedRecipientsByDayDao`).

### Données de test

- **`campaign-test-data.ts:12-35`** : `partOf` calcule `sentDay` comme le service (`day` si état clos **et** `receivedCount + toVerifyCount > 0`, sinon `null`). Dans `campaign-detail.test.tsx:248-259`, les parts 2 et 3 `failed` à `receivedCount: 0` donnent `sentDay: null`, exactement ce que produit `toPartDto`.
- **DTO des tests de carte productibles** : nouveaux tests (`campaign-statistics-card.test.tsx:103-132`) et test m7 (l.92-101), dont l'équivalent service est épinglé par `campaign-rules.test.ts:486-489`.
- **Test de règle existant** : les `sentCounts` ajoutés (`campaign-rules.test.ts:474-484`) rendent le DTO conforme ; attentes inchangées, test non affaibli.

### Carte des parts, libellé, docstring, porte dérobée

- `sentDay` n'est lu que par `campaign-statistics-card.tsx:140` et `:181` ; `campaign-detail.tsx` n'est pas touché par 847d5a29.
- `messages/fr.json` : `scope` « Sur l’ensemble de la campagne : {parts} envois, du {from} au {to}. », conforme aux textes attendus.
- La docstring de `CampaignPartDTO.sentDay` (`campaign-types.ts:149-155`) correspond au code.
- Aucun nouvel appel à `withRlsBypass`.

## 3. Diff comparé au plan

| Tâche | Fait | Remarque |
| --- | --- | --- |
| 1. Modèle et migration | oui | 0074 générée, `drizzle-kit check` propre |
| 2. Contrat `EmailTransport` | oui | inchangé |
| 3. Brevo | oui | inchangé |
| 4. Point d'envoi | oui | inchangé |
| 5. Campagnes taguées | oui | inchangé |
| 6. Règle pure | oui | inchangé depuis m8 |
| 7. Service, façade, types | oui | docstring de `sentDay` complétée (tâche 19) |
| 8. DAL, carte, libellés | oui | filtre `sentParts` ajouté (tâche 19) |
| 9. e2e | oui | inchangé, listé |
| 10. M1 | oui | |
| 11. m3 | remplacée par la tâche 17 | |
| 12. m4 | oui | |
| 13. m5 | oui | |
| 14. m1 | oui | |
| 15. m2 | oui | |
| 16. m6 | oui | |
| 17. m7 | oui | toujours en place |
| 18. m8 | oui | toujours en place |
| 19. m9 | **oui** | `sentDay` `null` pour une part close à 0 + 0 ; la carte écarte ces parts des dates et de `{parts}`, omet la phrase s'il ne reste qu'une part ; tests de règle (`campaign-rules.test.ts:508-543`) et de carte (l.103-132) avec des DTO productibles ; carte des parts non touchée. |

Rien hors plan. Trace sans effet : le repli `part.sentDay ?? part.day` de `lastDayOf` (`campaign-statistics-card.tsx:181`) est devenu inatteignable depuis le filtre.

## 4. Les tests protègent-ils les critères ?

- **Critère 1** : inchangé. `302`, `154 · 51 %`, `42 · 14 %` et le plafond à 100 sont épinglés.
- **Critère 2** : la portée apparaît à plusieurs parts et disparaît à une seule.
  - Sans `if (counts.received + counts.toVerify === 0) return null`, le test l.524 casse.
  - Sans le filtre `sentParts`, le test l.103 casse (« 3 envois … au 14/11/2026 »).
  - Avec `parts.length > 1` remis, le test l.120 casse.
  - « `failed` avec un `to_verify` reporté → 17/11 » (l.534) épingle la lecture prudente.
  - **Aucun test n'épingle la date de début d'une première part reportée** (m10).
- **Critère 3** : inchangé (`pending_provider` sans chiffre, vrai zéro affiché, `expectNoFigure` sur tous les états non disponibles, e2e en `unsupported`, bornes 88/89 jours).
- **Critère 4** : inchangé (lecture sous `withTenant` avant le fournisseur, `not_found` sans appel, RLS en accès croisé en e2e).

## 5. Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

**m10. La date de début de la portée peut tomber un jour où rien n'est parti.**

- Où : `src/components/features/campaigns/campaign-statistics-card.tsx:141` et `:162` (`from: dayLabelOf(first.day)`).
- L'argument « une part reportée commence à envoyer le jour prévu » n'est vrai que si le budget accorde au moins un envoi avant le report.
- Cas faux : `claimReportableSendTxnDao` refuse dès le premier destinataire (budget reportable partagé par invitations, relances, rejeux, notifications ; le plan des parts ne compte que les campagnes). `deferPartOutcome` pose `deferredTo` sans qu'aucun email soit parti le jour `scheduledFor`, qui reste inchangé.
- Scénario :
  1. Le 12/11 au matin, une vague d'invitations et de relances consomme toute l'allocation reportable.
  2. À 14 h, le bureau lance une campagne en 3 parts (12, 13 et 14/11).
  3. La part 1 est refusée au premier destinataire et reportée au 13/11 ; les parts 2 et 3 glissent au 14 et au 15.
  4. Toutes partent ensuite. La carte affiche « 3 envois, du 12/11/2026 au 15/11/2026 », alors que rien n'est parti le 12.
- Impact : affichage seul, un jour trop tôt. Aucun chiffre faux ; la fenêtre Brevo commence à `sendDate`, plus tôt ou au même jour, et reste sûre.
- `first.sentDay` ne corrige pas : faux dans l'autre sens (une part partiellement envoyée le jour prévu puis reportée commencerait trop tard).
- Correctif possible : consigner la limite (phrase dans la docstring de la carte, note en recette) ; distinguer « rien parti le jour prévu » n'est pas fiable avec les colonnes actuelles (`deferredCount` écrasé à chaque report). La première option suffit.

## 6. Verdict sur les constats des tours précédents

Tours précédents, tous `Ship allowed: yes` : tour 1 (d099c552) `Max severity: major`, M1 et m1 à m6 ; tour 2 `minor`, m7 et m8 ; tour 3 `minor`, m9.

| Constat | Correctif | Verdict |
| --- | --- | --- |
| M1 (tour 1) : ADR §5 et docstring contraires au code | a2373e45 | corrigé, inchangé depuis |
| m1 (tour 1) : taux au-delà de 100 % | c9654bf9 | corrigé |
| m2 (tour 1) : `endDate` au jour de Paris | c9654bf9 | corrigé (commentaire rectifié par m8) |
| m3 (tour 1) : portée ignorant les reports | a2373e45, puis 6813fd0a | corrigé (via m7) |
| m4 (tour 1) : titre dupliqué | a2373e45 | corrigé |
| m5 (tour 1) : commentaire de page faux | a2373e45 | corrigé |
| m6 (tour 1) : libellé `untracked` sous le secours | c9654bf9 | corrigé |
| m7 (tour 2) : correctif m3 sans effet | 6813fd0a | corrigé, toujours en place |
| m8 (tour 2) : fuseau de Brevo affirmé | 6813fd0a | corrigé, à confirmer en recette |
| m9 (tour 3) : part close sans envoi comptée dans la portée | 847d5a29 | **corrigé** : vraies lignes de destinataires, lecture juste pour chaque statut, dates et `{parts}` filtrés, docstring exacte, DTO de test productibles. Limite restante : m10 (date de début), déjà présente avant (`first.day`), pas une régression. |

Les écarts déclarés au tour 1 restent acceptés.

## 7. Régressions et règles du dépôt

- **Multi-tenant** : inchangé (`withTenant`, `getDb()`, aucun `withRlsBypass` nouveau).
- **Périmètre de 847d5a29** : règle pure (signature interne de `sentDayOf`), docstring du DTO, carte des statistiques, donnée de test, plan.
- **Donnée de test** : `sentDay` des parts `failed` vides change dans `campaign-detail.test.tsx`, où il n'est pas lu ; tests verts.
- Règle pure, couches respectées, aucune valeur en dur, libellés dans `fr.json`.
- Fichiers non suivis (`docs/logs/`, ce rapport) hors du diff ; le rapport est commité par `/ks-ship`.

## 8. À faire en recette (hors CI)

Sur le VPS, avec une campagne réelle taguée :

- vérifier que le suivi des ouvertures et des clics est actif dans le compte Brevo ;
- vérifier que `requests` atteint `sent_count` ;
- vérifier le fuseau réel des dates d'`aggregatedReport` (m8) et sa limite de plage ;
- observer la portée d'une campagne reportée par le budget : la fin doit être le jour du report (m7) ;
- si l'occasion se présente : une campagne interrompue (la part vide ne doit pas figurer, m9) ; une campagne dont la première part a été reportée dès le premier destinataire (début annoncé un jour trop tôt, m10).

À noter sur la carte Trello « Mise en PROD ».

Max severity: minor
Ship allowed: yes
