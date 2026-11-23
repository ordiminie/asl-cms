# ADR 070 — Relances d'impayés : une campagne automatique par échéance et par rang, créée par une tâche quotidienne

- Status: accepted
- Date: 2026-11-23
- Scope: story s29-relances-impayes
- Complète : ADR 006 (planificateur en base), ADR 010 (rien en dur), ADR 051/052 (campagnes, envoi
  étalé), ADR 053 (budget quotidien), ADR 059 (factures, prédicat « impayé »), ADR 060/061 (cible et
  adresses), ADR 064 (nature des envois), ADR 065/067 (courrier)

## Context

s29 relance automatiquement les impayés : jusqu'à trois relances par facture, ancrées sur sa date
d'échéance, activables par association, idempotentes, décomptées du budget quotidien, envoyées à toutes
les adresses actives d'une fiche sans doublon par adresse, avec un courrier pour les fiches sans email et
une page de suivi.

Tout le moteur existe déjà pour les campagnes : cible « impayés » recalculée (s27), lignes de
destinataire idempotentes et parts étalées (s26), budget et report (s52), dédoublonnage par adresse
(s53, s54), nature statutaire ou facultative (s27b), courrier figé (s28). La campagne manque seulement
d'un déclencheur sans session.

Le calendrier « 3, 2 puis 1 semaine » se lit comme des **intervalles successifs** depuis l'échéance
(CDCT V5 §8.3 : « espacées respectivement de 3, 2 puis 1 semaine »). Chez La Fourche, l'échéance est la
même pour tous : chaque relance tombe le même jour pour des centaines de fiches.

## Decision

1. **Une relance = une campagne** créée sans session, pour un couple (échéance, rang 1 à 3). Elle passe
   par le même cœur que `sendCampaignService` (cible → plan des parts → création transactionnelle →
   tâches `campaign.deliver_part`), extrait en une fonction partagée sous `withTenant`. Elle apparaît dans
   l'archive des campagnes, avec ses destinataires, sa carte « Courrier postal » et ses statistiques.
2. **Cible propre à l'échéance** : les fiches dont au moins une facture d'échéance D est impayée au sens
   de `isUnpaidInvoice` (le seul lecteur d'un statut). La cible est **recalculée à la création de chaque
   rang**, jamais figée au lancement : une facture réglée interrompt la série. Un statut à classer n'est
   jamais impayé.
3. **Relecture au moment de l'envoi** : juste avant d'envoyer, chaque destinataire d'une relance est
   relu. S'il n'a plus de facture impayée d'échéance D, rien ne part et sa ligne passe au statut
   `settled`. Ce statut n'est ni « reçu » ni « en échec ». Cela couvre une facture réglée pendant un
   report de budget (s19 : relancer à tort un membre à jour est pire que rater une relance).
4. **Tâche quotidienne `billing.unpaid_reminders`** par association, chaîne auto-reprogrammée (patron de
   la synchronisation Pennylane, ADR 062 §8), clé d'idempotence = le jour visé. Elle est garantie quand le
   réglage passe à « activé ». Désactivée, la tâche se termine sans rien créer et sans se reprogrammer.
5. **Calage « une à la fois »** (arbitrage du 23/11/2026) : le rang 1 est dû à `échéance + intervalle 1`.
   Le rang r > 1 est dû à `max(échéance + intervalles 1..r, jour d'envoi réel du rang r−1 + intervalle
r)`, et seulement une fois le rang r−1 **terminé**, c'est-à-dire sa campagne `sent` ou `interrupted`.
   Au plus un rang par échéance et par passage. Une activation tardive ou un report ne provoque ni rafale
   ni télescopage.
6. **Idempotence à trois étages** :
   - une table `unpaid_reminder`, unique `(organization_id, due_on, rank)`, porte `campaign_id`. Elle est
     écrite **dans la même transaction** que la campagne ;
   - la soumission de la campagne est déterministe (uuid v5 de l'association, de l'échéance et du rang) ;
   - les lignes de destinataire sont déjà idempotentes (s26).

   Un passage rejoué ne crée rien de plus.

7. **Réglages** (ADR 010) :
   - l'activation `billing.reminder.enabled`, un booléen désactivé par défaut ;
   - trois intervalles en semaines, `billing.reminder.delay_weeks.1..3`, entiers ≥ 1 et sans défaut, de
     valeur de seed 3 / 2 / 1 pour le premier tenant ;
   - **un seul** objet et **un seul** texte pour les trois rangs (arbitrage du 23/11/2026), sans défaut.

   L'activation est refusée tant qu'un de ces cinq réglages manque.

8. **Nature** : un type d'envoi `unpaid_reminder` porte son réglage `campaign.nature.unpaid_reminder`
   (s27b), valeur de seed `statutaire` pour le premier tenant. Les « types d'envoi qui portent une nature »
   sont séparés des « modèles du composeur » : la relance automatique n'est pas un choix du composeur.
9. **Factures regroupées** : la variable `{factures}`, réservée aux relances, se remplace par une liste
   Markdown. Elle contient une ligne par facture impayée d'échéance D des fiches du destinataire. Elle est
   lue à l'envoi, et à la génération pour une lettre. Une fiche sans facture impayée à la génération est
   retirée du PDF.
10. **Suivi** : la page `/bureau/relances` exige l'action `campaign.manage`. Elle se dérive des campagnes
    de relance et de leurs lignes (destinataires, fiches du courrier) : aucune trace propre par facture.
    Le courrier se génère **par rang**, depuis la carte s28 de la campagne du rang.

## Considered options

- **Un moteur de relance propre** (table de relances par facture, envoi direct par `sendEmailService`) —
  rejeté : il réécrirait l'étalement, le report, l'idempotence par ligne, le dédoublonnage par adresse et
  le courrier, déjà éprouvés par s26, s52, s53, s54 et s28.
- **Planifier les trois rangs à la création de la série** (trois tâches datées dès le premier passage) —
  rejeté : la cible serait figée, et un report ou une activation tardive ferait partir deux rangs le même
  jour.
- **Lire « 21, 14 puis 7 jours après l'échéance »** — rejeté : R3 partirait avant R1, et le CDCT écrit
  « espacées ».
- **Rattrapage : seulement le rang le plus récent, ou seulement les rangs futurs** — rejetés par
  l'arbitrage du 23/11/2026 : le premier fait partir une relance 3 comme premier message, le second ne
  relance pas du tout après une activation tardive.
- **Texte par rang** — rejeté par l'arbitrage du 23/11/2026 : six champs de plus pour un bureau
  bénévole.
- **Intervalles par défaut dans le registre** — rejeté : ce sont les valeurs du CDCT pour un client,
  donc des valeurs de seed (ADR 010).
- **Relance hors du budget** — rejeté : le budget décompte tout email sortant (ADR 053).

## Consequences

- `campaign` gagne une référence de rang par `unpaid_reminder`, et `campaign_recipient_status` la valeur
  `settled`. Le classement RLS passe de 55 à 56 tables (37 scopées).
- Le composeur, l'archive et la page de désinscription lisent la nouvelle séparation entre types d'envoi
  et modèles. La relance automatique figure parmi les envois statutaires annoncés au désinscrit.
- Rien ne part sans la minuterie `asl-cms-planificateur` en production : elle est à installer au prochain
  déploiement.
- À surveiller : à 400 impayés et 100 envois de campagne par jour, un rang s'étale sur 4 jours. Le rang
  suivant attend la fin du précédent, donc la série dure plus longtemps que 6 semaines. C'est voulu.
