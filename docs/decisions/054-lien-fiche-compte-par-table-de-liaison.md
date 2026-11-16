# ADR 054 — Le lien fiche ↔ compte passe par une table de liaison `member_profile_account`

- Status: accepted — remplace l'[ADR 037](037-lien-fiche-compte-par-colonne-user-id.md)
- Date: 2026-11-16
- Scope: story s53-un-acces-plusieurs-terrains

## Context

L'ADR 037 reliait une fiche à son compte par la colonne `member_profile.user_id`, **unique par
association**, et s12 rendait l'adresse email **unique par association** sur les fiches. Les réponses
de La Fourche (import 8 et 10) contredisent ces deux hypothèses : un propriétaire de plusieurs terrains
a une fiche par client Pennylane (ADR 048), donc par terrain, toutes à la même adresse, et il doit
retrouver ses terrains avec **un seul compte**. Le lien devient plusieurs-à-un. s54 l'utilisera aussi
dans l'autre sens (une fiche, plusieurs adresses, plusieurs comptes).

Ce que dit le code (recherche de s53) :

- `openMemberAccount` retrouve déjà le `user` d'une adresse connue : « un compte par adresse » existe,
  seuls les deux index l'empêchent sur deux fiches ;
- `closeMemberAccount` et `replaceMemberAccount` retirent la ligne `member` sans regarder les autres
  fiches du compte : avec un compte partagé, ils fermeraient l'accès à tous ses terrains ;
- neuf appelants lisent « ma fiche » au singulier (`getMemberProfileByUserIdDao`, sans tri).

## Decision

1. **Table `member_profile_account`** : `id`, `organization_id`, `member_profile_id` (FK fiche,
   `CASCADE`), `user_id` (FK `user`, `CASCADE`), `created_at`. RLS forcée, policy `tenant_isolation`
   sur sa propre colonne `organization_id`. **Unique `(member_profile_id)`** en s53 (une fiche a au plus
   un compte ; s54 lèvera cette contrainte par son propre ADR) ; index `(organization_id, user_id)`.
2. **Reprise** : une migration `--custom` copie chaque `member_profile.user_id` non nul dans la table,
   puis la colonne `user_id` et l'index `member_profile_organization_user_idx` sont retirés (migration
   générée). Une seule source du lien.
3. **L'index unique de l'adresse** (`member_profile_organization_email_idx`) devient un index **non
   unique** sur `(organization_id, lower(email))`, qui sert les recherches par adresse.
4. **Une adresse portée par plusieurs fiches d'une association = une personne = un compte.** Le
   service, et non plus la base, détecte une adresse déjà portée. Le bureau relie une fiche au compte
   existant **seulement par confirmation explicite** : l'écriture rend `email_shared` avec le compte
   détenteur ; le second envoi porte l'identifiant de ce compte, que le service **revérifie** (si
   l'adresse a changé de détenteur entre-temps, il redemande). L'import de s13 fait la même chose de
   lui-même et signale chaque regroupement au rapport.
5. **Fermer, c'est retirer le lien d'une fiche.** La ligne `member` n'est retirée (rôle `member`
   seulement, comme avant) que lorsque **plus aucune fiche** de l'association n'est reliée au compte.
   Le refus de vider l'adresse d'un membre du bureau ne vaut que pour sa **dernière** fiche.
6. **Remplacer l'adresse d'une fiche** : le rôle du bureau ne suit la nouvelle adresse (ADR 039) que si
   la fiche était la dernière du compte ; sinon l'ancien compte garde son rôle et ses autres fiches, la
   nouvelle adresse ouvre un accès de simple membre.
7. **« Mes fiches »** se lit par la table, toujours **triée** (premier numéro de parcelle actuelle,
   ordre numérique français, puis identifiant). « La première fiche » d'un compte, quand un appelant
   n'en veut qu'une (signalement, question, trace de rôle), est la première de cet ordre.

## Considered options

- **Garder `member_profile.user_id` en retirant l'index unique** — rejeté : plus court pour s53, mais
  s54 (une fiche, plusieurs comptes) devrait migrer encore le lien ; deux migrations du même lien en
  deux stories, et la colonne ne peut pas porter le sens inverse.
- **Une fiche par personne portant N terrains** — rejeté par la story : l'identifiant Pennylane
  passerait sur la parcelle, s13 casserait, et la facture ne suivrait plus la fiche facturée (s19).
- **Rapprocher fiches et compte par égalité d'adresses à chaque lecture** — rejeté (déjà par l'ADR 037) : ferait de l'email une identité. L'adresse **relie** des fiches à un compte au moment de
  l'écriture ; elle n'identifie jamais une fiche.
- **Fusionner les fiches d'une même adresse** — rejeté : contraire au critère 3 (« aucun compte n'est
  fusionné ») et à ADR 048 (une fiche par client Pennylane).
- **Contrainte d'unicité de l'adresse remplacée par un verrou** — inutile : deux saisies concurrentes de
  la même adresse relient deux fiches au même compte, ce qui est l'état voulu ; `createUserIfAbsentTxnDao`
  absorbe déjà la course sur le `user`.

## Consequences

- Tous les lecteurs de « ma fiche » passent au pluriel : espace membre (s12d), coordonnées (s16),
  signalements (s22), questions (s23), traces de rôle (s14). s18, s19, s31 et s32 liront la table.
- La table est déclarée dans `docs/architecture.md` (tableau des tables, inventaire s12c — couverte par
  `pg_read_all_data` d'`asl_backup`, sans grant) ; s38 devra l'exporter.
- Le statut `email_taken` disparaît des écritures du bureau au profit de `email_shared` ; le motif de
  rejet d'import `email_taken` n'est plus produit pour ce cas.
- L'isolation se prouve en e2e (RLS non testable en unitaire) : accès croisé entre deux membres d'une
  association et entre deux associations.
