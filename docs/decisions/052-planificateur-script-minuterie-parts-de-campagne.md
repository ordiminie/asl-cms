# ADR 052 — Le planificateur est un script lancé par minuterie ; une campagne s'étale en parts persistées

- Status: accepted
- Date: 2026-11-12
- Scope: story s26-envoi-echelonne

## Context

s26 pose le planificateur de l'ADR 006 et étale une campagne en parts quotidiennes plafonnées. L'ADR 006
laisse ouverts le déclencheur (route interne à secret partagé, ou script — l'ADR 036 §5 admet les deux),
la forme des parts, la garantie de non-doublon (ADR 051 : « une ligne d'envoi par destinataire, créée avant
le premier email ») et le sort d'un membre qui se désinscrit entre deux parts. La recherche
(`docs/research/s26-envoi-echelonne.md`, pièges 3 à 6, 9 et 16, questions 4, 6, 7, 8, 9, 10) les a laissés
ouverts ; la story les renvoie au plan. Le budget transverse de tout email sortant est sorti de s26 (s52).

## Decision

- **Déclencheur : un script `tsx` lancé par une minuterie systemd** toutes les cinq minutes, sur le modèle
  de la purge (s08b). Aucune route, aucun secret dans `@/env`. La cadence est inférieure à la journée : une
  part du lendemain part dans les cinq minutes qui suivent minuit à Paris, et un passage manqué est
  rattrapé (`Persistent=true`). La création d'une campagne déclenche en plus un passage immédiat de son
  association (`after()`), pour que la première part n'attende pas la minuterie.
- **`scheduled_job`** (ADR 006) : `organization_id`, `kind`, `idempotency_key`, `run_after`, `payload`
  (jsonb, sans donnée personnelle : des identifiants), `attempts`, `locked_at`, `completed_at`, plus
  `failed_at` (tentatives épuisées). Unique `(organization_id, kind, idempotency_key)`. Un passage prend
  les tâches dues d'une association en `FOR UPDATE SKIP LOCKED`, pose `locked_at` et `attempts + 1`, **valide
  cette transaction courte**, puis exécute hors verrou : un verrou périmé (15 min) rend la tâche reprenable
  après un redémarrage. Un `withTenant` par association, jamais `withRlsBypass`.
- **Une part = une ligne `campaign_part`** (`campaign_id`, `number`, `scheduled_for` jour de Paris,
  `recipient_count`, statut `scheduled | sending | sent | failed`) **et une tâche** `campaign.deliver_part`
  (clé = identifiant de la part). Chaque `campaign_recipient` porte son `part_id`. L'état visible du bureau
  se lit sans jointure sur le jsonb de la tâche.
- **Le plafond est un budget du jour, partagé entre campagnes** : à la création, sous un verrou consultatif
  par association (`pg_advisory_xact_lock`, patron déjà employé par les catégories), les jours sont remplis
  dans l'ordre, chacun à hauteur de `plafond − destinataires déjà programmés ce jour-là` (parts non
  échouées de toutes les campagnes). Le nombre de parts découle donc des destinataires et du plafond.
- **Non-doublon : « en cours d'envoi » posé avant l'envoi.** Un destinataire passe `pending → sending` par
  un `UPDATE … WHERE status = 'pending' RETURNING` atomique, **avant** `transport.send`, puis `sent` après.
  Un envoi refusé avec certitude (réponse HTTP non 2xx du fournisseur, drapeau `refused` de
  `EmailTransportError`) remet la ligne en `pending` ; tout autre échec, et tout arrêt du processus
  laissé dans `sending` plus de 15 minutes, la passe en **`to_verify`** — visible du bureau, **jamais
  renvoyée**. Une ligne `sent`, `sending` ou `to_verify` n'est jamais reprise.
- **Échec et reprise** : un échec arrête la part en cours ; la tâche est reprogrammée (30 min × tentative),
  les destinataires non traités restent `pending`. Après `campaign.send_max_attempts` tentatives (paramètre
  de tenant, **3 par défaut**), la part est `failed`, **les parts suivantes aussi**, les destinataires non
  reçus passent `failed`, la campagne passe `interrupted` (affichée « En échec »). La campagne n'est
  `sent` qu'à la **dernière** part. Un envoi désactivé par les réglages de l'application libère la tâche
  sans compter de tentative.
- **`{date}` d'une part = le jour de la part**, pas celui de la création : « le jour d'envoi » (doc de
  `formatCampaignDate`). `campaign.send_date` reste le jour de lancement (« Lancée le »).
- **Un membre désinscrit entre deux parts ne reçoit pas les suivantes** : le refus prime sur la cible
  figée à la création (ADR 051). Sa ligne passe `unsubscribed` et reste visible ; elle ne compte ni
  parmi les reçus ni parmi les échecs.
- **La staleness `effectiveCampaignStatus` disparaît** : une campagne `sending` sans progrès pendant un jour
  est normale. « À vérifier » (campagne terminée avec des lignes `to_verify`) et « En échec » se lisent
  des statuts et des décomptes par statut.

## Considered options

- **Route interne à secret partagé (ADR 006)** — rejetée : un secret de plus dans `@/env`, `env.example` et
  `ops/env.production.example`, une route exposée à garder, pour un bénéfice (déclencher depuis
  l'application) dont aucune story n'a besoin. Le script de la purge a déjà fait ses preuves.
- **Dériver les parts des lignes de destinataire, sans table** — rejetée : l'état d'une part (programmée,
  en cours, en échec) et son nombre de destinataires deviennent des agrégats à recalculer, et le budget du
  jour exige de sommer les parts de toutes les campagnes.
- **Une seule `scheduled_job` par campagne, qui découpe à l'exécution** — rejetée : le plafond du jour doit
  être connu **à la création** (le bureau voit le plan avant d'envoyer, critère 6 de l'écran 1) et la reprise
  après un arrêt retombe sur des états implicites.
- **Au-moins-une-fois (renvoi après redémarrage)** — rejetée : le critère « jamais deux fois » est explicite ;
  le coût est une ligne `to_verify` à arbitrer par l'équipe technique, assumé.
- **Désinscrit entre deux parts : l'envoyer quand même** — rejetée : écrire à quelqu'un qui a refusé les
  campagnes est le défaut que la désinscription par jeton existe pour empêcher.
- **Nouvelle valeur `failed` du statut de campagne** — rejetée : `interrupted` existe déjà et n'est plus
  écrit que par un échec définitif ; le libellé « En échec » suffit, sans migration d'enum de plus.

## Consequences

- Deux tables métier (`scheduled_job`, `campaign_part`) : deux lignes au classement RLS de
  `docs/architecture.md` (24 tables sous RLS forcée) et au test `rls-inventory`. s29, s38 et s52 réutilisent
  `scheduled_job` sans en créer un second.
- Un élément hors du dépôt : la minuterie `asl-cms-planificateur.timer`, à installer et documenter dans
  `docs/exploitation/`. Une minuterie arrêtée ne produit **aucune erreur** : elle produit du silence (ADR 006,
  « à surveiller ») ; la liste `systemctl list-timers 'asl-cms-*'` fait partie de la recette.
- Une ligne `to_verify` n'a pas d'issue dans l'application : le bureau est renvoyé à l'équipe technique
  (écran, `docs/designs/s26-envoi-echelonne.md`). Une action de résolution est à décider si le cas se produit.
- Un envoi dont le transport a été injoignable est `to_verify`, même s'il n'est pas parti : c'est le prix d'un
  « jamais deux fois » tenu sans connaître l'issue réelle d'un délai dépassé.
- Le budget quotidien de **tout** email sortant (s52) s'ajoute **au-dessus** : le plafond des campagnes
  (100) n'en est qu'une part, le reste du quota Brevo restant aux emails de connexion.
