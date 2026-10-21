# ADR 037 — Une fiche propriétaire désigne son compte par une colonne `member_profile.user_id`

- Status: accepted
- Date: 2026-10-20
- Scope: story s12d-comptes-membres

## Context

s12 a livré la fiche métier `member_profile` (sous RLS forcée) sans aucun lien vers l'identité
(`user`, `member`, plan Better Auth, ADR 014). s12d doit ouvrir un compte pour une fiche dotée d'une
adresse email, le refermer quand l'adresse est retirée, et montrer à un propriétaire connecté
**sa** fiche et ses parcelles. Il faut donc savoir, sur une association, quelle fiche correspond à
quel compte.

Contraintes :

- l'identité d'un membre n'est **jamais l'email** (AGENTS.md) : il change, il est partagé dans un
  foyer, et s16 prévoit que l'adresse de contact puisse diverger de l'identifiant de connexion ;
- `user.email` est unique sur toute la plateforme ; une même personne peut avoir une fiche dans
  deux associations, avec un seul compte ;
- une adresse email est unique par association sur les fiches (index partiel de s12) ;
- l'espace membre doit résoudre « ma fiche » depuis la session et le domaine appelé, sans
  identifiant venu du navigateur.

## Decision

Ajouter à `member_profile` une colonne **`user_id`**, nullable, clé étrangère vers `user(id)` en
**`ON DELETE SET NULL`**, avec un index **unique partiel `(organization_id, user_id) WHERE user_id IS
NOT NULL`**. Générée par `pnpm db:generate` (migration `0033`).

- Ouvrir le compte d'une fiche = trouver ou créer le `user` par l'adresse en minuscules, poser la
  ligne `member` (rôle `member` si aucune n'existe ; un rôle existant n'est jamais touché), puis
  écrire `user_id` sur la fiche.
- Fermer = retirer la ligne `member` de **cette** association **seulement si son rôle est
  `member`** (condition portée par la requête), puis vider `user_id`. Le `user` n'est jamais
  supprimé.
- « Ma fiche » = la fiche de l'association du domaine dont `user_id` est l'utilisateur de la
  session, lue sous `withTenant`.

## Considered options

- **Rapprocher fiche et compte par égalité d'adresses** (`lower(member_profile.email) =
lower(user.email)`) à chaque lecture — rejeté : fait de l'email une identité, contre la règle du
  projet ; casse dès que s16 laisse diverger l'adresse de contact et l'identifiant de connexion.
- **Colonne `member_profile_id` sur `member`** — rejeté : `member` est une table Better Auth
  exemptée de RLS (ADR 014), écrite aussi par le plugin d'organisation ; y accrocher une donnée
  métier sous RLS mélange les deux plans et expose l'identifiant de fiche hors du scope du tenant.
- **Table de liaison `member_profile_account`** — rejeté : une relation au plus un-à-un par
  association ne justifie pas une table, qui demanderait sa propre policy RLS et son entrée dans
  l'inventaire de `docs/architecture.md`.
- **Garder `user_id` à la fermeture** (pour une réouverture) — rejeté : la carte « Accès à l'espace
  membre » et l'espace membre liraient un lien vers un compte qui n'a plus accès ; la réouverture
  repasse par l'adresse, qui retrouve le même `user`.

## Consequences

- Précédent suivi : `incident_report_event.author_user_id` (table sous RLS qui référence `user` en
  `SET NULL`).
- La table ne change pas de classement RLS ; seule la description de `member_profile` dans
  `docs/architecture.md` évolue.
- s13 (import), s15 (invitation), s16 (profil du membre) et toutes les stories « la fiche du membre
  connecté » s'appuient sur ce lien. s14 change le rôle de la ligne `member`, jamais le lien.
- Une violation d'unicité (deux enregistrements simultanés de la même adresse) doit être absorbée
  dans un point de sauvegarde, comme `createMemberProfileTxnDao` le fait déjà, sinon elle condamne la
  transaction du scope.
