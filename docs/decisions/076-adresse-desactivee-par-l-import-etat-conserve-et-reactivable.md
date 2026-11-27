# ADR 076 — Adresse désactivée par l'import : un état conservé et réactivable

- Status: proposed
- Date: 2026-11-26
- Scope: story s56-import-annuel-coordonnees

## Context

La mise à jour annuelle (s56, critères 3, 4 et 5) rend « plus active » une adresse email de fiche que le
fichier de Pennylane ne porte plus : titulaire remplacée, titulaire absente, supplémentaire venue d'un fichier
précédent. Aujourd'hui `member_profile_email.status` ne connaît que `active` et `pending` (ADR 056) : une
adresse ne cesse d'être active qu'en étant **supprimée** (`deleteMemberProfileEmailDao`), et son refus des
campagnes (`unsubscribed_at`, ADR 057) part avec la ligne.

L'utilisatrice a tranché le 26/11/2026 : une adresse désactivée par un import qui **réapparaît** dans un
fichier suivant est **réactivée**, **garde sa désinscription**, et ne redevient pas titulaire d'office. Le
bureau doit pouvoir la voir sur la fiche (badge « Désactivée par l'import » prévu par s42b, design system
§9). Il faut donc garder la ligne.

## Decision

1. **Nouvelle valeur `disabled_by_import`** de l'enum `member_profile_email_status` (migration générée par
   `pnpm db:generate`). La ligne est conservée avec son `origin`, son `role` ramené à `additional` et son
   `unsubscribed_at` intact. Aucune colonne nouvelle : `updated_at` date la désactivation.
2. **Une adresse désactivée n'est pas active** : elle ne se connecte pas, ne reçoit ni campagne ni invitation,
   ne compte pas dans « courrier uniquement » (= aucune adresse `active`, ADR 056 §2 inchangé). Tous les
   lecteurs qui filtrent déjà `status = 'active'` l'excluent sans changement ; les lecteurs qui rendent
   « actives et en attente » (suivi des invitations s42b, espace membre) l'écartent explicitement.
3. **Désactiver délie ce compte de cette fiche** (`closeMemberAccount`, ADR 056 §3) ; la ligne `member` ne
   part qu'avec la dernière fiche et seulement pour le rôle `member`. L'import ne désactive jamais une adresse
   dont le compte porte un rôle autre que `member` (arbitrage B du 26/11, plan s56).
4. **Réactiver** (l'adresse revient dans un fichier, ou le bureau la saisit à nouveau) : `status = active`,
   `role` donné par `roleForNewActiveEmail` (titulaire seulement si la fiche n'a aucune adresse active),
   compte ouvert ou retrouvé et relié comme pour une adresse ajoutée ; `unsubscribed_at` conservé. Une saisie
   par le bureau d'une adresse désactivée la réactive avec l'origine `site` ; une saisie par le membre la fait
   passer `pending` (confirmation par lien, ADR 056 §5). L'index unique `(member_profile_id, lower(email))`
   reste vrai : jamais deux lignes pour la même adresse sur une fiche.
5. Le bureau voit la ligne sur la fiche avec le badge `outline` « Désactivée par l'import » et peut la
   **retirer** (suppression, chemin existant, sans remplaçante puisqu'elle n'est pas active).

## Considered options

- **Supprimer la ligne** (comportement actuel de « n'est plus active ») — rejeté : perd la désinscription
  (ADR 057), interdit la réactivation demandée, rien à montrer au bureau.
- **Colonne `disabled_at` à côté du statut** — rejeté : deux sources pour « active » ; `status` est déjà le
  point de passage de tous les lecteurs.
- **Table d'archive des adresses désactivées** — rejeté : nouvelle table à RLS pour une seule valeur d'état,
  réactivation par copie entre tables.

## Consequences

- Les types `'active' | 'pending'` des règles (`member-email-rules.ts`, `member-invitation-campaign-rules.ts`)
  et des DTO s'élargissent ; chaque écrivain qui insère une adresse sur une fiche doit d'abord chercher une
  ligne désactivée de la même adresse.
- Le badge du design system §9 (s42b, s56) passe de « proposé » à « utilisé » sur la fiche du bureau ; le
  suivi des invitations (s42b) n'affiche pas encore les adresses désactivées (elles en sont écartées).
- s38 (export RGPD) et l'inventaire de `docs/architecture.md` comptent ces lignes comme des adresses de fiche.
