# ADR 046 — Identifiant Pennylane sur la fiche, numéro de compteur sur la parcelle

- Status: accepted
- Date: 2026-11-08
- Scope: story s13-import-initial-membres

## Context

L'import de s13 (fichier de clients Pennylane de La Fourche) doit être idempotent : relancer le même
fichier ne duplique ni fiche ni parcelle. `member_profile` n'a aujourd'hui aucune clé qui permette de
retrouver la fiche créée par un import précédent : l'email est absent chez une centaine de
propriétaires et partagé dans des foyers, le nom et l'adresse ne sont pas uniques, et le numéro de
parcelle est transmis à la vente (AGENTS.md : jamais l'une de ces valeurs comme identité).

Le fichier fournit en revanche l'`Identifiant Client` Pennylane, unique sur les 413 lignes, que
l'utilisatrice a décidé de **conserver** pour rapprocher plus tard les factures du bon membre (s20,
ADR 011 : la clé de rapprochement est « une donnée du membre », pas déduite). La `Référence Client`
(`parcelle - compteur`) porte aussi le numéro de compteur, que s17 (relevés d'eau) exploitera et
qu'aucune colonne n'accueille.

## Decision

- Colonne **`pennylane_customer_id`** (texte, nullable) sur `member_profile`, avec un **index unique
  partiel** `(organization_id, pennylane_customer_id) WHERE pennylane_customer_id IS NOT NULL`. Elle
  identifie un _client Pennylane_, pas un propriétaire ; elle n'est jamais l'identité de la fiche
  (qui reste son `id`). Aucune table nouvelle : la RLS forcée de `member_profile` couvre déjà la colonne.
- Colonne **`meter_number`** (texte, nullable) sur `parcel`. La `Référence Client` est découpée sur le
  **dernier** `-` : avant = numéro de parcelle (un numéro composé comme `AE 215-352` reste entier),
  après = numéro de compteur.
- Les deux colonnes s'écrivent **uniquement par les services**, sans champ dans les formulaires du
  bureau en s13.

## Considered options

- **Table de rapprochement `member_import_key`** — rejetée : une table métier de plus (organization_id,
  RLS, test d'accès croisé) pour une valeur 1-1 avec la fiche, et s20 aurait à la jointer à chaque lecture.
- **Rapprocher sur nom + adresse** — rejetée : homonymes possibles (4 groupes du fichier réel n'ont pas
  la même adresse) ; un rapprochement à tort fusionnerait deux identités et ouvrirait les documents de
  l'un à l'autre.
- **Rapprocher sur l'email** — rejetée : absent chez ~100 propriétaires, partagé par 25 lignes.
- **Stocker la `Référence Client` entière comme numéro de parcelle** — rejetée : le compteur pollue les
  numéros affichés partout (s25, s28) et il faudrait une migration de données ensuite.

## Consequences

- Idempotence : une ligne dont l'identifiant existe déjà est « déjà présente », jamais recréée.
- s20 dispose de sa clé de rapprochement ; s17 de son compteur, sans nouvelle migration.
- Une fiche créée à la main n'a pas d'identifiant Pennylane : le rapprochement de s20 devra gérer ce cas.
- Le découpage de la référence reste **à confirmer par La Fourche** : si les parcelles jumelées se
  révélaient être deux terrains, une migration de données séparerait ces parcelles.
