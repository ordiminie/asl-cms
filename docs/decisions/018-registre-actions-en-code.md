# ADR 018 — Registre des actions soumises à autorisation : dans le code, pas en table

- Status: accepted
- Date: 2026-09-21
- Scope: story s03b-roles-registre-actions

## Context

`docs/stories.md` (règle transverse) exige que « toute story qui introduit une action soumise à
autorisation la déclare au registre créé par s03b, avec les rôles qui l'exécutent par défaut ». La
story s03b elle-même est explicite sur la forme : « Le registre est ici une simple déclaration avec
rôles par défaut, sans écran ; s37 le transforme en matrice configurable par tenant. »

`docs/architecture.md` (section « Entités ajoutées par ASL-CMS », domaine « Autorisation ») nomme en
revanche `action_registry` aux côtés d'entités qui sont des tables Drizzle réelles (`page`,
`content_block`, `member_profile`…), ce qui laisse penser à une table dès s03b. La recherche de s03b
(`docs/research/s03b-roles-registre-actions.md`) a vérifié qu'aucune des 21 tables actuelles du schéma
(section « Classement RLS des 21 tables », `docs/architecture.md`) ne porte ce nom : la table n'existe
donc dans aucune des deux lectures, mais la formulation de l'architecture est ambiguë sur l'intention.

Un précédent direct existe déjà dans le projet : ADR 016 a tranché la même question pour les
paramètres d'association (`organization_setting`) — définition en code, valeurs seules en base — pour
des raisons qui s'appliquent ici presque mot pour mot.

## Decision

**Le registre des actions est un module de code, isomorphe, sans persistance.** Pas de table, pas
d'écran, pas de migration dans s03b.

- Un tableau `readonly` de définitions dans `src/services/types/domain/action-registry-types.ts` :
  pour chaque action, un identifiant stable (`id`) et ses rôles d'association par défaut
  (`defaultRoles`, parmi `board`, `owner`).
- Une fonction pure de résolution, paramétrée par le registre (comme `resolveSettings` et
  `validateSettingsChanges` le sont par `ASSOCIATION_SETTINGS_REGISTRY`), pour qu'un test puisse lui
  passer un registre ad hoc sans toucher au registre de production — c'est ce que le critère 3 de s03b
  appelle « une action de test ».
- Une fonction d'autorisation générique dans `src/services/authorization/`, qui combine le bypass
  SuperAdmin, le rôle de l'utilisateur dans l'organisation, et ce registre — appelée par les services
  qui déclarent une action, à la place d'un contrôle de rôle écrit à la main.
- `docs/architecture.md` sera corrigé dans le commit de s03b : `action_registry` y est décrit comme un
  module de code, retiré de la liste implicite des tables.
- La table de **surcharge par tenant** (rôles personnalisés par association) reste un problème de
  **s37**, non résolu ici. Le jour où elle existe, elle prime sur le registre de code pour les tenants
  qui l'ont configurée ; le registre de code reste la définition et le défaut.

## Considered options

- **Table `action_registry` dès s03b** — rejeté : la story ne demande ni écran ni configuration par
  tenant (« sans écran »), et une table pour un ensemble d'actions fixé dans le code introduirait une
  synchronisation code ↔ données sans bénéfice avant s37 (une clé d'action n'existe que si une story
  écrit le code qui la déclare et le service qui la contrôle — ils doivent changer ensemble, dans le
  même commit, exactement le raisonnement d'ADR 016 pour les paramètres).
- **CASL directement, sans registre séparé** — rejeté : `canManageAssociation` est déjà volontairement
  hors CASL (pour exclure l'`admin` global du bypass), et le besoin ici est une liste **déclarative**
  de rôles par action, pas des règles conditionnelles sur des ressources — plus proche d'un registre à
  la ADR 016 que d'une ability CASL.
- **Étendre `ASSOCIATION_SETTINGS_REGISTRY` pour y ranger aussi les actions** — rejeté : deux
  préoccupations distinctes (la valeur d'un paramètre vs. qui a le droit de faire quoi) ; les mélanger
  romprait la lisibilité du registre de s02 pour un gain nul.

## Consequences

**Ce qui devient plus simple**

- Déclarer une action = une entrée de registre : les services existants (s01b, s02) migrent vers
  l'appel générique sans changer de comportement (critère 4), et toute story future fait de même sans
  écrire son propre contrôle de rôle à la main — la revue « contrôle à la main en doublon du registre »
  a un seul endroit à vérifier.
- Le critère 3 (« une action de test ») se prouve en unitaire, avec un registre ad hoc, sans fixture
  de base ni écran à monter.

**Ce qui devient plus difficile**

- Le registre ne survit pas à un tenant qui voudrait un rôle différent de son défaut — c'est exactement
  ce que s37 doit résoudre ; s03b ne doit pas anticiper cette configuration.
- Retirer une action du registre ne se voit qu'au code ; aucune ligne orpheline à nettoyer en
  contrepartie (pas de table), mais aucune trace historique non plus.

**À surveiller**

- `docs/architecture.md` doit rester cohérent avec cette décision après le commit de s03b — un futur
  lecteur qui n'ouvre que l'architecture ne doit plus lire `action_registry` comme une table.
- Quand s37 ajoutera la table de surcharge, elle devra composer avec ce registre (le lire comme
  défaut), pas le remplacer.
