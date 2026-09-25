# ADR 025 — Les messages du site : une table `contact_message` dédiée, `user_submissions` laissée au boilerplate

- Status: accepted
- Date: 2026-09-24
- Scope: story s08-formulaire-contact

## Context

s08 doit persister les messages envoyés depuis la page publique `/contact` et les rendre
consultables par le bureau. Une chaîne complète existe déjà, héritée du boilerplate et partiellement
reprise par s01 (`docs/research/s08-formulaire-contact.md`) : table `user_submissions`, repository
scopé, service, façade, DAL, et un écran SuperAdmin `/admin/submissions`. La question est de la
réemployer ou d'écrire une table propre au produit.

**Ce qui plaide pour le réemploi** : la table est déjà scopée par `organization_id` sous RLS forcée
(`drizzle/migrations/0004_rls_tenant_isolation.sql`), son repository passe partout par `getDb()`,
la liste est déjà paginée et triée par `created_at desc`, et les colonnes `read` / `archived`
existent.

**Ce qui plaide contre**, point par point :

- **Elle mélange trois natures.** `submission_type` vaut `contact | feedback | support`, et le bouton
  `QuickFeedbackButton` du boilerplate (`src/components/features/quick-feedback-action.ts`, monté
  dans `(app)/layout.tsx`) y écrit des lignes `feedback` sur le même tenant. La liste du bureau
  devrait filtrer, et un oubli de filtre montrerait au bureau les retours produit du boilerplate.
- **`organization_id` est nullable, en `onDelete: 'set null'`.** Une ligne orpheline reste en base et
  devient invisible sous RLS au lieu de disparaître avec l'association. Le corriger imposerait une
  migration sur une table que le reste du boilerplate écrit encore.
- **`metadata` est un jsonb libre**, et c'est exactement là que l'action actuelle écrit l'adresse IP
  du visiteur en clair — ce que le critère 6 de la story interdit. Garder le champ, c'est garder la
  porte par laquelle la faute est entrée.
- **Les types de domaine importent le modèle Drizzle**
  (`src/services/types/domain/user-submission-types.ts` : `UserSubmission = UserSubmissionModel`),
  à l'encontre de `rule-architecture` : la présentation qui les consomme dépend de la persistance.
- **Il manque une colonne.** Le design validé
  (`docs/designs/s08-formulaire-contact.md`, écrans 2 et 3) montre au bureau qu'une notification n'est
  pas partie : cet état doit être persisté. Dans `user_submissions`, il finirait dans le `metadata`
  jsonb, non typé et non requêtable — le champ qu'on cherche précisément à ne plus utiliser.
- **`user_submissions` porte la preuve d'isolation RLS de s01.** `e2e/tenant-isolation.spec.ts`
  (l. 160-260) lit `/en/admin/submissions` sur l'association A puis interroge la table en SQL direct,
  et le seed (`src/db/scripts/seed.ts:515-540`) l'alimente. Toute modification de son schéma, de sa
  policy ou de l'écran SuperAdmin met en jeu cette preuve, qui n'a rien à voir avec s08.

Le précédent existe dans le dépôt : l'**ADR 023** a écarté `posts` pour les actualités et créé `news`,
avec le même raisonnement — une table héritée dont la forme ne correspond pas et dont les lecteurs
hérités continuent de vivre.

## Decision

**Une table `contact_message` dédiée**, à champs fixes, scopée par `organization_id` sous RLS forcée
(ADR 002), et **`user_submissions` n'est pas touchée**.

1. `contact_message` porte : `id`, `organization_id` (**`NOT NULL`**, FK `organization`,
   `onDelete: 'cascade'`), `sender_name` (nullable — le nom est facultatif), `sender_email`,
   `subject`, `body`, `read` (défaut `false`), `notification_failed` (défaut `false`),
   `created_at`. Index `(organization_id, created_at desc)` pour le tri de la liste du bureau.
2. **Aucune colonne `metadata`, aucun jsonb, aucune colonne d'adresse.** Le critère 6 (« aucune
   adresse IP en clair en base ») devient une propriété du schéma, pas une discipline d'appelant :
   il n'existe pas d'endroit où écrire une IP. Le compteur de débit et son empreinte HMAC vivent
   dans `rate_limit_event`, séparément.
3. **`notification_failed` est une colonne**, pas un champ de métadonnées : le badge « Notification
   non envoyée » de la liste du bureau se lit sans déballer de jsonb.
4. **Le reste de la chaîne `user_submissions` reste en place, inchangé** : modèle, migration `0004`,
   repository, service, façade, DAL, écran SuperAdmin `/admin/submissions`, bouton de retour rapide,
   seed et `e2e/tenant-isolation.spec.ts`. Aucune ligne de leur code n'entre dans le diff de s08.
5. **Seul l'écrivain change** : la Server Action publique de `/contact` cesse d'écrire dans
   `user_submissions` et écrit dans `contact_message`. **Conséquence assumée et dite ici** :
   `/admin/submissions` ne reçoit plus de nouveaux messages de contact ; il conserve l'historique et
   continue de recevoir les `feedback` du bouton du boilerplate. Le bureau, lui, lit
   `/bureau/messages`, qui est l'écran de la story.

## Considered options

- **Réemployer `user_submissions` filtrée sur `type = 'contact'`, telle quelle** — rejeté. Le jsonb
  libre reste la porte ouverte du critère 6, l'état d'échec de notification n'a pas de place typée,
  `organization_id` reste nullable, et le bureau dépend d'un filtre dont l'oubli lui montre les
  retours produit du boilerplate.
- **Réemployer `user_submissions` en la durcissant** (`organization_id` `NOT NULL` + cascade,
  colonnes typées à la place du `metadata`, types de domaine détachés du modèle Drizzle) — rejeté.
  C'est une migration et une réécriture de couche sur une table que le boilerplate écrit encore par
  deux autres chemins, et qui porte la preuve d'isolation RLS de s01. Le rapport entre le risque
  (casser `e2e/tenant-isolation.spec.ts` et l'écran SuperAdmin) et le gain (ne pas créer une table de
  huit colonnes) est défavorable.
- **Retirer `user_submissions` et sa chaîne, et tout reprendre dans `contact_message`** — rejeté. Le
  retrait d'un sous-système hérité est l'affaire d'une story dédiée (ADR 009), et celui-ci porte la
  preuve d'isolation de s01 : la déplacer est un travail en soi, hors des sept critères de s08.
- **Une table commune aux messages du site et au formulaire « Questions au bureau » de l'espace
  membre (s22)** — rejeté. La note de la story l'interdit explicitement : s22 a son propre modèle
  (catégorie, membre identifié, routage). Mutualiser maintenant, c'est deviner la forme d'une story
  non écrite.
- **Stocker l'échec de notification dans `metadata`** (quelle que soit la table) — rejeté. Un état
  que la liste affiche et que la revue vérifie se lit dans une colonne.

## Consequences

**Ce qui devient plus simple**

- Le critère 6 est tenu **par construction** : aucune colonne de `contact_message` ne peut recevoir
  une adresse IP.
- La preuve d'isolation RLS de s01 reste verte sans y toucher, et s08 apporte la sienne sur sa
  propre table.
- La liste du bureau n'a rien à filtrer : toutes les lignes de `contact_message` sont des messages
  du site.
- Les types de domaine de s08 sont écrits sans dépendre du modèle Drizzle, comme `news-types.ts`.

**Ce qui devient plus difficile**

- Deux tables portent des messages entrants, dont une héritée et vivante. Il faut savoir laquelle
  on lit : **`contact_message` pour le produit, `user_submissions` pour le boilerplate**.
- Le classement RLS de `docs/architecture.md` et la garde `src/db/models/rls-inventory.test.ts`
  gagnent une table de plus.

**À surveiller**

- **`/admin/submissions` devient trompeur** : il s'appelle « soumissions » et ne reçoit plus les
  messages du site. À retirer ou à renommer par la story qui traitera les écrans SuperAdmin hérités
  (ADR 009), pas en passant.
- **La rétention des messages n'est fixée nulle part.** Seules les empreintes du limiteur ont une
  durée de vie (24 h, critère 7). Aucune mention RGPD n'est affichée sous le formulaire, faute de
  durée décidée (design, « ce que ce design ne couvre pas »). À rouvrir quand la rétention le sera.
- **Le bouton de retour rapide du boilerplate** continue d'écrire dans `user_submissions` depuis
  l'espace `(app)`. Il n'est pas dans le périmètre de s08.
