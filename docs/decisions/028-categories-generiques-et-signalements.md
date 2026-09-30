# ADR 028 — Catégories génériques par domaine, signalements routés par catégorie

- Status: accepted
- Date: 2026-09-30
- Scope: story s10-signalements-publics
- Remplace, pour les signalements, la note agentique de s10 selon laquelle « le champ
  `email_destination` n'est pas utilisé par les signalements » (arbitrage de l'utilisatrice du
  30/09/2026).

## Context

s10 est la première story qui a besoin de **catégories administrables** : fuite, voirie, éclairage,
nuisance… Le découpage lui confie le modèle **générique** du produit (`{nom, adresse?}`, plafond 10,
avec un discriminant de domaine) : s23 (questions au bureau) et s35 (petites annonces) le
réemploieront avec leur propre domaine, sans le réimplémenter.

Quatre forces :

1. **Le nom `categories` est pris.** `src/db/models/post-model.ts` déclare `pgTable('categories')`
   pour le blog hérité, exempté de RLS et lu hors scope (ADR 023).
2. **Supprimer une catégorie ne supprime pas les signalements reçus** (critère 5), et la maquette
   montre, pour un signalement dont la catégorie a été supprimée, **son nom** suivi de « catégorie
   supprimée ».
3. **Le plafond de 10** se vérifie par un compte suivi d'une insertion : deux requêtes laissent
   passer une onzième catégorie en cas de double soumission.
4. **Destinataires.** Les Réglages de s02 annonçaient « adresse de contact pour tous les
   signalements, plus l'adresse du responsable forage pour les signalements de fuite ». Les
   catégories étant libres (renommables, supprimables), rien ne permet au code de savoir qu'une
   catégorie est « la fuite ». L'utilisatrice a tranché le 30/09 : **l'adresse portée par la
   catégorie reçoit les signalements de cette catégorie, en plus de l'adresse de contact.**

## Decision

1. **Une table `association_category`**, générique, scopée par RLS forcée :
   `id`, `organization_id`, `domain` (texte, valeurs fermées côté code : `'report'` aujourd'hui),
   `name`, `routing_email` (nullable), `created_at`, `deleted_at` (nullable).
   - `domain` est un **texte validé par le code**, pas un `pgEnum` : s23 et s35 ajouteront leur valeur
     sans migration.
   - Unicité du nom **parmi les catégories actives** d'un même domaine, insensible à la casse (index
     unique partiel).
2. **Suppression logique** : supprimer une catégorie pose `deleted_at`. Elle disparaît du formulaire
   public et de l'écran des catégories, ne compte plus dans le plafond, et les signalements qui la
   référencent continuent de lire son nom. La clé étrangère du signalement est `ON DELETE RESTRICT` :
   une suppression physique par erreur échoue au lieu d'effacer quoi que ce soit.
3. **Plafond de 10 par domaine et par association, atomique** : l'insertion se fait dans la
   transaction du scope de tenant, après un `pg_advisory_xact_lock` sur la clé
   (association, domaine), puis compte des actives, puis insertion. Deux ajouts simultanés sont
   sérialisés.
4. **Adresse vide = absente** : `''` et les espaces sont normalisés en `NULL` avant l'écriture ;
   aucune chaîne vide n'est jamais stockée.
5. **Routage des signalements** : destinataires = `contact.email` (Réglages, lu à l'envoi) **plus**
   `routing_email` de la catégorie si elle en porte une, dédupliqués sans tenir compte de la casse.
   Un envoi par destinataire : le contrat `EmailTransport` (`to: string`) n'est pas touché.
6. **Le réglage `forage.responsable.email` est conservé sans effet** (arbitrage du 30/09) : sa phrase
   d'aide dit désormais qu'il n'est pas utilisé par l'application. Aucun code ne le lit.

## Considered options

- **Table `categories` ou `category`** — rejetée : collision avec le blog hérité, et confusion garantie
  dans le schéma entre une table exemptée et une table scopée.
- **Une table par domaine** (`report_category`, puis `question_category`…) — rejetée : c'est
  exactement la réimplémentation que le découpage interdit à s23 et s35.
- **Suppression physique + `ON DELETE SET NULL` + copie du nom sur le signalement** — rejetée : deux
  sources pour le même nom (renommer une catégorie ne renommerait pas les signalements), une colonne
  dénormalisée de plus, et une suppression irréversible là où l'archivage suffit.
- **Suppression physique + `ON DELETE CASCADE`** — rejetée : contraire au critère 5.
- **Compte puis insertion sans verrou** — rejetée : laisse passer la onzième catégorie sur une double
  soumission.
- **Marqueur « fuite » sur la catégorie, ou catégorie système non supprimable, pour prévenir le
  responsable forage** — rejetées par l'utilisatrice au profit de l'adresse portée par la catégorie :
  plus simple, plus générale, et déjà dans le modèle.
- **Retirer `forage.responsable.email`** — écarté par l'utilisatrice : le réglage reste, sa phrase
  d'aide cesse de promettre un effet.

## Consequences

- s23 et s35 ajoutent une valeur de `domain` et leur écran ; ni table, ni migration de modèle.
- Le seed du premier tenant porte l'adresse du responsable forage **sur la catégorie « Fuite
  d'eau »**, plus dans le réglage.
- Renommer une catégorie renomme son affichage sur les signalements déjà reçus : c'est voulu (une
  seule source), et c'est à dire au bureau si la question se pose.
- Une catégorie supprimée ne réserve pas son nom : l'unicité ne porte que sur les actives, on peut
  recréer « Nuisance » après l'avoir supprimée, et les deux lignes coexistent.
- Un échec d'envoi vers **l'un** des destinataires marque le signalement « notification non envoyée »
  (le bureau le voit dans la file), sans faire échouer la soumission — précédent de s08.
- À surveiller : si un jour le réglage forage doit être retiré, c'est une story à part (registre,
  libellés, tests de s02 qui s'en servent comme exemple de défaut par renvoi).
