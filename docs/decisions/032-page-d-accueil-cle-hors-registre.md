# ADR 032 — La page d'accueil désignée est une clé hors registre de `organization_setting`

- Status: accepted
- Date: 2026-10-12
- Scope: story s44-page-accueil

## Context

s44 laisse le bureau désigner la page du CMS qui sert d'accueil (`/`). Il faut stocker ce choix, par
association, en référençant la page par son **identifiant** (le slug peut changer).

Trois contraintes structurent le choix :

- **Le registre typé des paramètres (ADR 016) ne sait pas référencer une page.** Ses types sont
  `email`, `number`, `boolean`, `choice` (options statiques) et `text`. Sa validation est pure,
  isomorphe, sans accès à la base : elle ne peut pas vérifier qu'un identifiant désigne une page
  **publiée de la bonne association**, ce que le critère 3 de s44 exige côté serveur.
- **Le critère 3 demande l'étanchéité entre associations** : le bureau de l'une ne désigne jamais la
  page d'une autre, ni par l'interface, ni en forgeant un identifiant.
- **Le choix doit survivre à la dépublication de la page** (la page redevient l'accueil quand le
  bureau la republie) et ne jamais casser `/` si la référence devient pendante.

Deux précédents existent, tous deux de l'ADR 021 : le pied de page vit dans `organization_setting`
**sous une clé hors registre**, lue et écrite directement par le repository générique ; et
`menu_item.page_id` est une vraie clé étrangère vers `page`.

## Decision

Le choix est **une ligne de `organization_setting`, clé `site.home_page_id`**, dont la valeur est
l'identifiant de la page. **Pas de ligne = accueil automatique.** La clé n'est pas dans
`ASSOCIATION_SETTINGS_REGISTRY` : elle est lue et écrite par un service dédié
(`home-page-service.ts`), sur le modèle du pied de page (`site-navigation-service.ts`).

- **Écriture** : `setHomePageService` valide l'identifiant (UUID), contrôle l'action
  `site.home.manage`, puis lit la page **sous `withTenant(organizationId, …)`** : la RLS ne rend rien
  pour la page d'une autre association, ce qui la fait refuser exactement comme une page inconnue.
  Une page qui n'est pas publiée est refusée. Désigner « aucune page » supprime la ligne.
- **Lecture publique** : `getPublicHomePageService` (sans autorisation, comme `getPageBySlugService`)
  rend la page désignée **quel que soit son statut** ; c'est le DAL qui ne la sert que si elle est
  publiée. Une référence pendante rend `undefined` : l'accueil minimal prend le relais.
- **Cache** : la lecture publique est taguée `home-page:<organizationId>` **et**, une fois la page
  connue, `page:<organizationId>:<slug>` (le tag que les actions de pages invalident déjà à la
  création, la modification, la publication et la dépublication). Changer le choix invalide le
  premier tag ; modifier ou republier la page invalide le second. Aucune action de s04 n'est modifiée.

## Considered options

- **Nouveau type « page » dans le registre typé** — rejeté : le registre est un module isomorphe pur
  sans accès à la base. Lui faire connaître les pages casserait cette propriété pour un seul
  paramètre, et dupliquerait dans le registre la règle « publiée, de la bonne association » que le
  service porte déjà.
- **Colonne `home_page_id` (clé étrangère) sur `organization`** — rejeté : une migration et une
  dépendance circulaire (`organization` ↔ `page`) pour un réglage ; la table `organization` n'est
  pas couverte par la RLS des tables métier (migration `0004_rls_tenant_isolation.sql`), donc la
  protection d'étanchéité se déplacerait du moteur vers le code. Le bénéfice, l'intégrité référentielle, ne vaut rien ici : une référence
  pendante est de toute façon traitée par l'accueil minimal.
- **Drapeau `is_home` sur `page` (index unique partiel)** — rejeté : changer d'accueil devient deux
  écritures à ordonner (retirer l'ancien, poser le nouveau) pour tenir l'unicité, et une migration.
- **Désigner la page par son slug** — rejeté : le slug peut changer (s04), le choix se casserait
  silencieusement. La story impose l'identifiant.

## Consequences

- **Aucune migration.** Le critère d'isolation est tenu par la RLS déjà forcée sur
  `organization_setting` et sur `page` ; il est prouvé en e2e comme les autres tables métier.
- Le choix est invisible du registre : l'écran « Réglages », généré depuis lui, ne le montre pas. Il
  a son écran dédié (« Page d'accueil », groupe « Le site »).
- **Pas d'intégrité référentielle** : toute lecture de la clé doit traiter « page introuvable »
  comme « accueil automatique ». C'est le seul point de vigilance de cette option.
- Si une future story ajoute la suppression d'une page, elle devra aussi supprimer la ligne
  `site.home_page_id` qui la désigne, ou laisser la lecture publique tomber sur l'accueil minimal
  (elle le fait déjà).
- Le jour où le registre saura référencer des entités, ce choix pourra y être migré sans changer
  d'adresse ni de stockage : la clé et la valeur resteraient identiques.
