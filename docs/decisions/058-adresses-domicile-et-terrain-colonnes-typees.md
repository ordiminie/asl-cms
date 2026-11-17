# ADR 058 — Domicile et terrain : colonnes typées sur la fiche, terrain par défaut en paramètre

- Status: accepted
- Date: 2026-11-17
- Scope: story s55-adresses-typees-entreprise

## Context

s55 distingue deux adresses postales d'une fiche (`member_profile`) : le **domicile** (adresse postale, celle
du courrier) et le **terrain** (le terrain de vacances), toutes deux facultatives, plus un libellé « nom de
l'entreprise ». Aujourd'hui la fiche porte un seul jeu de quatre colonnes (`address_line`,
`address_complement`, `postal_code`, `city`), écrit par le bureau (s12), le membre (s16, sur toutes ses
fiches, s53) et l'import (s13). La story exige une reprise **sans perte** de cette adresse en domicile.

Le fichier réel ne porte la rue du terrain que pour une partie des lignes (recherche s55). Arbitrage du
17/11/2026 : à l'import, l'`Adresse` est le domicile, sauf quand une `Adresse de livraison` est renseignée —
la livraison est alors le domicile et l'`Adresse` le terrain ; un membre sans adresse de terrain reçoit le
code postal et la commune de l'association, sans rue (« 34450 Vias » pour La Fourche).

## Decision

1. **Colonnes typées sur `member_profile`** : les quatre colonnes existantes deviennent le domicile
   (`home_address_line`, `home_address_complement`, `home_postal_code`, `home_city`) par **renommage**
   (migration sans perte, aucune copie de données) ; quatre colonnes nouvelles portent le terrain
   (`land_address_line`, `land_address_complement`, `land_postal_code`, `land_city`) ; une colonne
   `company_name`. Toutes facultatives.
2. **Le terrain par défaut est un paramètre d'association** (ADR 010) : deux paramètres texte du registre,
   « code postal du terrain par défaut » et « commune du terrain par défaut », facultatifs, **sans défaut
   dans le code**, modifiables par le bureau dans « Réglages ». L'import les applique au terrain d'une fiche
   **créée** sans adresse de terrain ; paramètres vides → terrain laissé vide. La valeur « 34450 / Vias »
   est saisie pour La Fourche (réglage ou seed du premier tenant), jamais écrite dans le code.

## Considered options

- **Table `member_profile_address` (type `home` | `land`, unique par fiche et type)** — rejetée : la story
  fixe exactement deux types, sans liste ni historique ; une 48e table à RLS forcée, une jointure à chaque
  lecture de fiche et une migration de données (copie, pas renommage) pour aucun besoin exprimé.
- **Garder les colonnes actuelles pour le domicile sans les renommer** — rejetée : `address_line` à côté de
  `land_address_line` laisse croire que la première est « l'adresse » générique ; les relecteurs de s28 et
  s56 doivent lire « domicile » dans le nom.
- **Constante « 34450 Vias » dans le mappage d'import** — rejetée : valeur propre au premier tenant, échec
  de revue sous l'ADR 010.
- **Terrain par défaut calculé à la lecture (non stocké)** — rejeté : l'arbitrage demande que la fiche le
  porte, et le bureau doit pouvoir le corriger fiche par fiche comme une valeur ordinaire.

## Consequences

- Plus simple : une seule ligne à lire, renommage sans perte, aucune table à inventorier (le compte « 47
  tables » est inchangé).
- À surveiller : drizzle-kit peut proposer DROP + ADD au lieu de RENAME — la migration générée est relue
  avant commit ; sauvegarde s12c avant `db:migrate` en production.
- Ajouter un troisième type d'adresse demanderait une migration vers une table : à rouvrir par un nouvel
  ADR si le besoin apparaît.
- La correction du membre (s16, toutes les fiches du compte) ne touche que le domicile : le terrain reste
  propre à chaque fiche.
