# ADR 056 — Les adresses d'une fiche vivent dans `member_profile_email`, avec un rôle et un statut ; le membre ajoute et modifie par lien de confirmation

- Status: accepted — remplace l'[ADR 040](040-adresse-email-de-la-fiche-modifiee-par-le-bureau-seul.md) et,
  pour l'unicité `(member_profile_id)` seulement, l'[ADR 054](054-lien-fiche-compte-par-table-de-liaison.md) §1
- Date: 2026-11-16
- Scope: story s54-adresses-email-multiples

## Context

s54 donne plusieurs adresses à une fiche, chacune se connectant (décision de l'association du 16/11/2026).
L'adresse est aujourd'hui **une colonne**, `member_profile.email`, dont dépend la colonne **générée**
`mail_only` ; une fiche a au plus un compte (`member_profile_account`, unique `(member_profile_id)`, ADR 054) ;
seul le bureau modifie l'adresse (ADR 040). La story exige : un rôle **titulaire / supplémentaire** propre à
chaque fiche, exactement une titulaire dès qu'une adresse est active, une origine affichée (fichier / site),
et un ajout ou une modification par le membre qui n'active l'adresse qu'**après confirmation par lien**.

## Decision

1. **Table `member_profile_email`** : `id`, `organization_id`, `member_profile_id` (FK `CASCADE`), `email`,
   `role` (`holder` | `additional`), `status` (`active` | `pending`), `origin` (`file` | `site`),
   `added_by_user_id` (FK `user` `SET NULL`, nul pour le fichier et le bureau), `replaces_email_id` (FK
   self `CASCADE`, nul sauf pour une modification en attente), `confirmation_token_hash` (SHA-256, jamais
   le jeton en clair), `expires_at`, `unsubscribed_at` (ADR 057), `created_at`, `updated_at`. RLS forcée,
   policy `tenant_isolation`.
   - Unique `(member_profile_id, lower(email))` ; unique partiel `(member_profile_id) WHERE role = 'holder'
AND status = 'active'` (au plus une titulaire active) ; index `(organization_id, lower(email))`.
   - L'invariant « au moins une adresse active ⇒ exactement une titulaire » est tenu par une **règle pure**
     de succession appliquée dans chaque écriture, sous la transaction du tenant ; la base garantit le « au
     plus une ».
2. **`member_profile.email` et `mail_only` sont retirées.** Une seule source : « courrier uniquement » =
   aucune adresse **active** (`NOT EXISTS`), calculé dans les lectures. Reprise `--custom` : chaque
   `member_profile.email` non nul devient une adresse `active`, `holder`, origine `file` si la fiche a un
   `pennylane_customer_id`, sinon `site`.
3. **Un compte par adresse.** `member_profile_account` reste le lien `(fiche, compte)`, son unicité passe de
   `(member_profile_id)` à `(member_profile_id, user_id)`. Une adresse active ouvre (ou retrouve) le `user`
   de son adresse et le relie à la fiche ; une adresse `pending` n'a ni lien ni `user`. Retirer une adresse
   délie **ce** compte de **cette** fiche ; la ligne `member` ne part qu'avec la dernière fiche (s53).
4. **Qui écrit quoi.** Le bureau ajoute (active d'office, origine `site`), modifie, retire toute adresse et
   désigne la titulaire ; il ne retire la titulaire qu'en désignant la remplaçante, sauf dernière adresse
   active (la fiche passe en courrier). Le membre, résolu par la session (jamais par un identifiant de fiche
   venu du navigateur), **ajoute** des supplémentaires sur toutes ses fiches (arbitrage du 16/11), **modifie
   sa propre adresse** (celle égale à `user.email`) sur toutes ses fiches, **corrige ou annule** les adresses
   en attente dont il est l'auteur, et ne retire rien. Il ne peut ajouter une adresse portée par une fiche
   de l'association non reliée à son compte.
5. **Confirmation par lien.** Jeton aléatoire (`randomBytes`, base64url), stocké haché, usage unique,
   expirant après `member.email_confirmation_days` jours (paramètre du tenant, seed 7). La page publique
   `/confirmer-adresse/{jeton}` confirme **par un bouton** (Server Action), jamais au chargement. La
   confirmation revérifie l'expiration et la règle du point 4 (adresse prise entre-temps). Une modification
   confirmée remplace l'ancienne adresse : titre transmis si elle était titulaire, ancien compte délié, nouveau
   compte ouvert (chemin `replaceMemberAccount`, rôle du bureau déplacé selon l'ADR 054 §6). Une adresse en
   attente expirée est ignorée à la lecture et purgée à l'écriture suivante (aucune tâche planifiée).
6. L'email de confirmation est un envoi d'association de nature `member_email_confirmation`, décompté du
   budget (s52) et reporté au lendemain s'il est épuisé.

## Considered options

- **Garder `member_profile.email` comme copie de la titulaire** — rejeté : deux sources de la même adresse,
  synchronisées par le code seul ; une écriture oubliée ferait mentir `mail_only` et les envois.
- **Colonnes `email_2`, `email_3` sur la fiche** — rejeté : nombre arbitraire, ni rôle, ni statut, ni
  origine par adresse.
- **Référencer l'adresse depuis `member_profile_account`** — rejeté pour l'instant : le compte d'une adresse
  se retrouve déjà par `user.email` (le changement d'adresse Better Auth reste fermé), et la référence
  dupliquerait le rôle de la table de liaison.
- **Confirmer au chargement du lien** — rejeté : les anti-virus de messagerie ouvrent les liens et
  activeraient l'adresse sans personne.
- **Rouvrir `changeEmail` de Better Auth** — rejeté (déjà par l'ADR 040) : réécrit `user.email` pour toutes
  les associations de la personne.

## Consequences

- Tous les lecteurs de `member_profile.email` / `mail_only` passent par la table : liste et compteurs du
  bureau, `isIncomplete`, campagnes, désinscription, import, signalements et questions (qui copient désormais
  l'adresse de **la personne connectée**).
- Un membre qui modifie sa propre adresse se reconnecte avec la nouvelle une fois confirmée.
- La table est déclarée dans `docs/architecture.md` (inventaire s12c ; `member_unsubscribe` en sort, ADR 057) ; s38 devra l'exporter ;
  s40, s56 et s58 lisent le rôle `holder`.
- Le manque §9 « Changement d'adresse email par le membre » est rouvert et tranché ici.
