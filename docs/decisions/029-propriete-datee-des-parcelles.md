# ADR 029 — Propriété datée des parcelles : périodes demi-ouvertes, contrôle sous verrou

- Status: accepted
- Date: 2026-09-30
- Scope: story s12-membres-parcelles

## Context

s12 porte le cœur du modèle de données du bloc B. La relation membre ↔ parcelle est **datée** :
une vente ne transfère pas l'historique antérieur, et s18, s19, s28 et s32 devront lire « le
propriétaire d'une parcelle à une date ». Le piège annoncé par la story est la clé étrangère
`parcel → membre_actuel`, qui passe tous les tests naïfs et casse à la première vente.

Quatre forces :

1. **Identité** : ni l'email (absent chez 100 membres sur 400, changeant, partagé dans un foyer) ni le
   numéro de parcelle (transmis à la vente) ne peuvent identifier un membre.
2. **Bornes** : il faut une convention pour le jour de la vente, sans jour de chevauchement ni jour
   sans propriétaire.
3. **Non-chevauchement** (critère 4) : un contrôle « lire puis écrire » laisse passer deux écritures
   concurrentes. La garantie en base serait une contrainte d'exclusion
   `EXCLUDE USING gist (parcel_id WITH =, daterange(starts_on, ends_on) WITH &&)`, qui exige
   l'extension `btree_gist` ; seule `uuid-ossp` est installée, et le rôle applicatif n'est ni
   SUPERUSER ni BYPASSRLS.
4. **Immuabilité** (critère 2) : une vente clôture la période du vendeur « sans la modifier » ; poser
   sa date de fin est pourtant une écriture sur sa ligne.

## Decision

1. **Trois tables scopées** : `member_profile` (clé primaire UUID autogénérée, seule identité),
   `parcel` (numéro unique par association), `parcel_ownership` (`parcel_id`, `member_profile_id`,
   `starts_on`, `ends_on` nullable). **Aucune colonne « propriétaire actuel »** : il se lit toujours
   par date.
2. **Périodes demi-ouvertes `[starts_on, ends_on)`** : `ends_on` est le jour de la vente, premier jour
   de l'acquéreur ; le dernier jour du vendeur est la veille. `CHECK (ends_on IS NULL OR ends_on >
starts_on)`.
3. **Non-chevauchement contrôlé sous verrou de ligne** : dans la transaction du scope de tenant,
   `SELECT … FROM parcel WHERE id = $1 FOR UPDATE`, puis contrôle par une fonction pure, puis
   écriture. Les écritures concurrentes sur une même parcelle sont sérialisées.
4. **Une période close est immuable** : la seule mise à jour possible pose `ends_on` sur une période
   **ouverte** (`WHERE ends_on IS NULL`), une fois. Le repository n'expose aucune autre écriture sur
   une période.
5. **`mail_only` est une colonne générée** (`email IS NULL`), pas une saisie : l'attribut que s25 et
   s28 consomment ne peut pas diverger de l'email.

## Considered options

- **Clé étrangère `parcel.current_member_id`** — rejetée : c'est le défaut que la story interdit ;
  l'historique disparaît à la première vente.
- **Périodes fermées `[début, fin]` avec fin = veille de la vente** — rejetée : la lecture « à une
  date » doit alors comparer à `fin + 1`, et deux périodes contiguës se testent par un décalage d'un
  jour, source d'erreurs dans chaque story qui lira ces dates.
- **Contrainte d'exclusion `btree_gist`** — écartée pour l'instant : plus forte, mais elle demande
  d'installer une extension par un rôle privilégié en CI et sur le VPS (s12b). Le passage reste
  possible plus tard par une migration, sans changer le modèle ni les services.
- **Verrou consultatif (`pg_advisory_xact_lock`)** — non retenu ici : la ligne `parcel` existe
  toujours au moment du contrôle (elle est créée au rattachement si besoin), un verrou de ligne est
  plus lisible et se libère avec la transaction.
- **`mail_only` saisi par le bureau** — rejeté : un booléen indépendant de l'email finit par le
  contredire, et la note de la story interdit de le déduire d'une chaîne vide, pas d'un `NULL`.
- **Étendre la table `member` de Better Auth** — rejetée : elle est exemptée de RLS (ADR 014), et
  « aucune table métier future n'hérite de cette exemption ».

## Consequences

- `getParcelOwnerAtService(organizationId, parcelId, date)` devient le point d'entrée de s18, s19, s28
  et s32 ; sa convention demi-ouverte est la leur.
- L'affichage d'une période close écrit « au » **la veille** de `ends_on` : c'est la seule traduction
  à faire, et elle est centralisée.
- Les écritures concurrentes sur une parcelle attendent le verrou : sans conséquence au volume d'une
  ASL (quelques ventes par an).
- La garantie de non-chevauchement est applicative : tout futur chemin d'écriture (import s13) doit
  passer par le même service, jamais par un DAO direct. À vérifier en revue de s13.
