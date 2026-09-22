# ADR 021 — Menu public : table `menu_item` scopée directement ; pied de page : clé de

`organization_setting`, hors du registre typé

- Status: accepted
- Date: 2026-09-22
- Scope: story s04b-navigation-publique

## Context

s04b ajoute deux besoins de persistance nouveaux : une **liste ordonnée** d'entrées de menu (page
cible, rang, visibilité propre — critères 1 et 6) et un **contenu unique** de pied de page (critère
3). La recherche (`docs/research/s04b-navigation-publique.md`, Open questions 1 et 3-4) laissait les
deux ouverts.

**Le menu** est structurellement proche de `content_block` (liste ordonnée, rangs entiers, RLS
forcée) mais avec un patron d'accès différent : un bloc de page se lit toujours **à travers** sa page
(`page_id` connu d'avance), alors que le menu se liste **directement par organisation**
(« toutes les entrées de cette association, dans l'ordre ») sans point d'entrée `page_id` préalable —
le patron de `page` elle-même (`organization_id` direct), pas celui de `content_block` (policy jointe
via `page_id`).

**Le pied de page** est un champ de texte unique (décision de périmètre du design, brief
s04b : « un seul champ de contenu, pas plusieurs colonnes »). `organization_setting` (ADR 010,
ADR 016) est déjà le stockage clé/valeur par association du produit — mais sa couche service
(`ASSOCIATION_SETTINGS_REGISTRY`, `src/services/types/domain/association-settings-types.ts`) ne
connaît que quatre types de paramètre (`email`, `number`, `boolean`, `choice`), tous des scalaires
contraints. Aucun ne convient à un bloc de texte riche libre, et en ajouter un cinquième (`text` ou
`richtext`) toucherait un module partagé avec s02 (l'écran Réglages, qui rend un champ par entrée du
registre) pour un besoin qui n'a rien à voir avec les réglages de l'association.

## Decision

**Deux persistances distinctes, chacune sur le gabarit le plus proche de son propre patron d'accès —
pas un gabarit unique forcé sur les deux.**

- **`menu_item`** : table neuve, `organization_id` **direct** (comme `page`, pas comme
  `content_block`), `page_id` (FK `page`, `onDelete: 'cascade'`), `rank` (integer), `visible`
  (boolean, défaut `true`), horodatage. Policy RLS forcée sur `organization_id` directement — pas de
  jointure requise, contrairement à `content_block` dont la policy joint `page`. Contrainte unique
  `(organization_id, page_id)` : une page n'apparaît qu'une fois dans le menu d'une même association
  (le sélecteur d'ajout du design l'exclut déjà côté UI ; la base la garantit en dernier ressort, même
  gabarit défensif que `page_organization_slug_unique`).
- **Le pied de page vit dans `organization_setting`**, sous une clé dédiée
  (`site.footer_content`), **écrit et lu directement via
  `src/db/repositories/organization-setting-repository.ts`** (`getOrganizationSettingsDao`,
  `upsertOrganizationSettingsDao` — déjà génériques, sans dépendance au registre typé) — **sans
  passer par `ASSOCIATION_SETTINGS_REGISTRY`/`resolveSettings`/`validateSettingsChanges`**. Un
  `site-navigation-service.ts` neuf porte sa propre validation Zod (chaîne, vide autorisé — vide =
  aucun pied de page affiché côté public, même principe qu'un bloc incomplet omis). Aucune migration :
  la table existe déjà depuis s02.
  - Vérifié : `resolveSettings` itère `registry.map(...)`, jamais les lignes elles-mêmes — une ligne
    `site.footer_content` en base est donc invisible pour le registre et l'écran Réglages, aucune
    interférence possible.

## Considered options

- **`menu_item` sur le gabarit RLS de `content_block` (policy jointe via `page_id`)** — rejeté : la
  requête réelle est « toutes les entrées de cette organisation », pas « les entrées de cette page » ;
  joindre `page` à chaque lecture pour une colonne qui pourrait être directe ajoute une jointure sans
  bénéfice. `organization_id` direct est le gabarit de `page` elle-même, plus proche du besoin réel.
- **Pied de page dans une nouvelle table dédiée (comme `content_block`)** — rejeté : un seul champ de
  texte par association ne justifie pas une table ; `organization_setting` sert exactement ce cas
  (une valeur, une clé, par association) et existe déjà, sans migration.
- **Ajouter un type `text`/`richtext` à `AssociationSettingDefinition` puis déclarer le pied de page
  dans `ASSOCIATION_SETTINGS_REGISTRY`** — rejeté : le registre et l'écran Réglages qui le rend sont
  un module partagé avec s02, conçu pour des paramètres de configuration scalaires (adresses, seuils,
  teinte), pas pour du contenu édité en texte riche avec sa propre barre d'outils. L'étendre pour ce
  seul besoin élargirait la responsabilité d'un module qui n'a pas à connaître le pied de page.
- **Une seule table pour le menu et le pied de page** (ex. une ligne « pied de page » dans
  `menu_item` avec un type spécial) — rejeté : deux concepts sans rapport (une liste ordonnée
  d'entrées vs. un champ de texte unique) forcés dans une même forme pour économiser une migration
  déjà bon marché (`organization_setting` existe, la migration de `menu_item` est petite).

## Consequences

**Ce qui devient plus simple**

- Lister le menu d'une association ne demande pas de jointure pour la policy RLS.
- Le pied de page ne demande aucune migration ni extension de module partagé ; sa validation reste
  locale à s04b.

**Ce qui devient plus difficile**

- Deux mécanismes de persistance différents pour une seule story (une table neuve, une clé
  générique) plutôt qu'un seul — à documenter clairement dans le plan pour que l'implémenteur ne les
  confonde pas.
- `organization_setting` porte maintenant des clés de deux natures (paramètres de configuration du
  registre, et ce contenu hors registre) : un futur lecteur de la table doit savoir que toutes les
  clés ne passent pas par `ASSOCIATION_SETTINGS_REGISTRY`.

**À surveiller**

- Si une future story a besoin d'un deuxième champ de contenu simple (hors registre de paramètres),
  ce patron (clé dédiée dans `organization_setting`, service local, pas de passage par le registre
  typé) est le précédent à suivre — pas une nouvelle table à chaque fois.
- `docs/architecture.md` (§ Classement RLS) doit gagner `menu_item` dans la liste des tables scopées
  (24 tables, 5 scopées) ; `organization_setting` y figure déjà, aucune ligne supplémentaire pour le
  pied de page.
