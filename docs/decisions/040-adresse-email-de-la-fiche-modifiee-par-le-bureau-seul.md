# ADR 040 — L'adresse email d'une fiche ne se modifie que par le bureau ; le membre corrige téléphone et adresse postale

- Status: accepted
- Date: 2026-10-28
- Scope: story s16-coordonnees-membre

## Context

s16 laisse un propriétaire connecté corriger ses coordonnées depuis son espace. La story citait
« adresse postale, téléphone, **email de contact** » et demandait de ne pas changer « silencieusement
l'identifiant de connexion ».

Ce que dit le code (recherche de s16) :

- la fiche n'a **qu'une** colonne email, `member_profile.email`. Elle pilote `mail_only` et
  l'ouverture, la fermeture et le remplacement du compte de la fiche (ADR 037). Dans cette
  association, elle **est** l'identifiant de connexion ;
- changer cette adresse ferme l'accès lié à l'ancienne et en ouvre un sur la nouvelle
  (`decideMemberAccount` → `replace`, s12d). Si le membre le faisait lui-même, il serait déconnecté
  à la requête suivante (ADR 038). Une faute de frappe le laisserait dehors. L'adresse d'un tiers
  déjà inscrit ailleurs ouvrirait à ce tiers l'espace du membre, sans preuve de possession ;
- le changement d'adresse de Better Auth (`changeEmail`, fermé en s12d par
  `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL=false`) réécrit `user.email` pour **toutes** les
  associations de la personne, sans que les fiches suivent. Or l'arbitrage du 20/10/2026 interdit
  de toucher les autres associations.

Arbitrage de produit du 23/10/2026 : **l'adresse email reste au bureau**.

## Decision

- Le membre modifie **téléphone et adresse postale** (adresse, complément, code postal, commune). Son
  adresse email est **affichée, jamais modifiable** : pour la changer, il écrit au bureau, qui la
  modifie depuis la fiche (chemin de s12d, inchangé).
- L'écriture côté membre **ne peut pas** toucher l'email, par construction. Elle passe par un DAO
  dédié qui n'écrit que les cinq colonnes postales et téléphoniques. La fiche est désignée par
  `(organization_id, user_id)`, jamais par un identifiant venu du navigateur. Aucune logique de
  compte (`decideMemberAccount`, `applyMemberAccountDecision`) n'est appelée.
- Le changement d'adresse de Better Auth (`/account`) reste **fermé définitivement**. La promesse
  « s16 le rouvrira » (s12d, commentaire de `src/env-schemas.ts`) est retirée.
- Le manque du design system §9 (« Changement d'adresse email par le membre ») est tranché :
  **via le bureau**.

## Considered options

- **Le membre change l'adresse de sa fiche, avec la règle du bureau** (ancien accès fermé, nouveau
  ouvert) : rejeté. Le membre serait déconnecté sur-le-champ, une faute de frappe l'enfermerait
  dehors, et l'adresse d'un tiers lui ouvrirait l'espace. Pour s'en prémunir, il faudrait prouver
  la possession de la nouvelle adresse (lien de confirmation, compté dans le budget Brevo) : un
  flux entier, pour un besoin rare que le bureau couvre déjà.
- **Une adresse de contact distincte de l'identifiant de connexion** (colonne nouvelle, piste de
  l'ADR 037) : rejeté pour l'instant. Il faudrait une migration et une règle pour savoir quelle
  adresse reçoit les envois (s42, s25, campagnes) et laquelle pilote `mail_only`. Rien ne le
  demande aujourd'hui. Un besoin futur passera par un nouvel ADR.
- **Rouvrir `changeEmail` de Better Auth en synchronisant les fiches** : rejeté. Cette option
  touche toutes les associations de la personne, ce que l'arbitrage du 20/10/2026 interdit. De
  plus, aucun hook ne propage aujourd'hui `user.email` vers les fiches.

## Consequences

- Plus simple : l'écriture côté membre n'a ni conflit d'adresse (`email_taken`), ni changement de
  compte, ni fuite possible de l'identité d'une autre fiche.
- Le bureau reste le seul chemin pour changer une adresse. Il est déjà tracé dans l'écran de la
  fiche (s12d) et il prévient de l'accès qui change.
- L'ADR 037 reste valable. Sa mention « s16 prévoit que l'adresse de contact puisse diverger » n'est
  plus d'actualité : l'adresse de contact et l'identifiant de connexion restent une seule et même
  colonne.
- À surveiller : si une association demande qu'un membre change lui-même son adresse, rouvrir la
  question par un nouvel ADR, avec une preuve de possession de la nouvelle adresse.
