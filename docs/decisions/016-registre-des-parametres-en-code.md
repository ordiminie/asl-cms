# ADR 016 — Paramètres d'association : registre typé dans le code, valeurs seules en base

- Status: accepted
- Date: 2026-09-19
- Scope: story s02-parametres-association

## Context

L'ADR 010 décide une table `organization_setting` scopée tenant, « sur le modèle de `app_settings` mais
avec une clé composite `(organization_id, key)`, et les colonnes `value`, `type`, `category`, `label`,
`description` ». Il ne tranche pas où vit la **définition** d'un paramètre (son type, sa valeur par défaut,
sa règle de validation) ; il la duplique implicitement sur chaque ligne.

s02 rend la question concrète :

- le critère 2 exige qu'une clé **déclarée au registre** s'affiche et se valide « sans aucune modification
  de la page » : la page doit être générée depuis une définition unique, commune à toutes les associations ;
- le critère 4 exige qu'un paramètre **jamais renseigné** se lise à sa valeur par défaut « déclarée au
  registre » : une ligne absente n'a pas de colonne `type` ni de défaut à lire ;
- l'arbitrage du 19 septembre 2026 fait de l'adresse de contact un paramètre **obligatoire** et la **valeur
  par défaut** de l'adresse du responsable forage : un défaut peut donc renvoyer à un autre paramètre ;
- une adresse propre à une association ne peut pas être une valeur par défaut codée en dur (ADR 010, « rien
  en dur »).

## Decision

**La définition d'un paramètre vit dans un registre typé, dans le code ; la table ne stocke que des
valeurs.**

- Registre dans `src/services/types/domain/` : pour chaque clé, son type (`email`, `number`, `boolean`,
  `choice` avec sa liste fermée), son caractère obligatoire, sa valeur par défaut — une constante neutre
  (la teinte 195) ou **une référence à une autre clé** (`forage.responsable.email` → `contact.email`) —,
  la clé de traduction de son libellé et de son aide, et la page qui l'affiche.
- Table `organization_setting` : `organization_id`, `key`, `value`, `updated_at`, `updated_by` ; clé
  primaire `(organization_id, key)` ; RLS forcée (ADR 002). **Pas de colonnes `type`, `category`,
  `label`, `description`.**
- **Absence de ligne = valeur par défaut.** Vider un paramètre facultatif supprime sa ligne ; vider un
  paramètre obligatoire est refusé. Une ligne dont la clé n'est plus au registre est ignorée à la lecture ;
  une valeur stockée qui ne passe plus la validation de son type se lit comme absente.
- Aucune valeur propre à une association dans le registre : un paramètre obligatoire sans défaut neutre
  est saisi à la création de l'association (provisioning) et porté par le seed pour les tenants de test.

## Considered options

- **Colonnes `type`, `category`, `label`, `description` sur chaque ligne (lettre de l'ADR 010)** — rejeté :
  une ligne absente n'a ni type ni défaut, ce qui contredit le critère 4 ; la définition serait dupliquée
  pour chaque association et pourrait diverger de l'une à l'autre ; un libellé en base échapperait aux
  fichiers `messages/` (next-intl conservé, ADR 008).
- **Définitions dans une table de référence globale (`setting_definition`)** — rejeté : ajoute une table
  de plateforme et une migration de données pour chaque clé, alors qu'une clé n'existe que si une story
  écrit le code qui la lit ; le registre et son lecteur doivent changer ensemble, dans le même commit.
- **Stocker la valeur par défaut sur chaque ligne au provisioning** — rejeté : « vider ramène au défaut »
  deviendrait « vider ramène à la valeur copiée au provisioning », et changer un défaut demanderait de
  réécrire toutes les associations.
- **Réutiliser `app_settings` et ses énumérés `setting_type` / `setting_category`** — rejeté par l'ADR 010
  pour la table ; pour les énumérés, ils n'ont ni `email` ni liste fermée, et un énuméré Postgres ne peut
  pas porter la liste des options d'un choix.

## Consequences

**Ce qui devient plus simple**

- Déclarer une clé = une entrée de registre (et ses libellés) : la page, la validation et la lecture la
  prennent en compte sans autre changement — le critère 2, vérifié sur un registre de test.
- La revue « rien en dur » a un seul endroit à lire : le registre ne contient que des défauts neutres.
- Changer un défaut est un changement de code, relu et versionné, appliqué à toutes les associations
  qui n'ont pas renseigné la clé.

**Ce qui devient plus difficile**

- Retirer ou renommer une clé laisse des lignes orphelines en base : elles sont ignorées à la lecture, et
  une migration de données est à écrire si on veut les nettoyer.
- Une référence de défaut entre clés doit rester acyclique : le registre le vérifie par un test.

**À surveiller**

- Aucun secret dans `organization_setting` (ADR 010).
- L'ADR 010 reste en vigueur pour tout le reste (table scopée, RLS, `app_settings` réservé à la
  plateforme, lecture cachée par association) ; seule la liste de colonnes est remplacée par celle-ci.
