# ADR 067 — Adresse du courrier et calage de la fenêtre

- Status: accepted
- Date: 2026-11-20
- Scope: story s28-publipostage-pdf

## Context

La lettre de s28 doit se glisser dans une enveloppe DL à fenêtre gauche (§6.1 du design system :
fenêtre x 20 · y 45 · 100 × 35 mm, NF Z 11-011 ; cadre d'adresse 90 × 25 mm, 4 lignes max). Ces
mesures sont « à confirmer avant la première impression » et une imprimante décale souvent de
quelques millimètres. Par ailleurs, l'ADR 058 fait du **domicile** l'adresse du courrier ; une fiche
sans email peut ne pas en avoir (seed : une fiche au terrain seul).

## Decision

1. **Adresse** : le domicile (`home_*`). À défaut, **arbitrage du 20/11/2026** : le terrain (`land_*`) ;
   à défaut des deux, le **nom seul**. Ces lettres sont signalées au bureau avant la génération, avec un
   lien vers la fiche. Ce repli ne change pas l'ADR 058 pour le cas général : il ne sert qu'à une fiche
   sans domicile.
2. **Lignes du bloc** (4 au plus) : nom · libellé d'entreprise s'il diffère du nom (sans casse ni
   espaces) · ligne d'adresse, suivie de « , complément » quand le bloc dépasserait 4 lignes ·
   code postal et ville. 12 pt, sans gras. Une ligne vide est omise.
3. **Géométrie** : les mesures §6.1 sont des **constantes de code** (une norme d'enveloppe, pas une
   préférence d'association), regroupées dans un seul module.
4. **Calage** : deux réglages d'association (ADR 016) — `letter.address_offset_x_mm` et
   `letter.address_offset_y_mm`, entiers de −10 à +10, 0 par défaut — déplacent le **cadre de
   l'adresse seul**, sur les lettres et sur une **page de calage** téléchargeable à part (contour de la
   fenêtre, cadre décalé, plis, adresse d'exemple, décalage appliqué écrit en clair).
5. **Homonymes** : la clé « même nom et même domicile » est celle de l'import (nom, ligne d'adresse,
   code postal, en minuscules, espaces compactés), extraite en règle pure partagée ; une fiche sans
   domicile n'est jamais regroupée. Le choix du bureau (une lettre par personne / une par terrain) est
   passé à la génération, jamais enregistré, et **aucune valeur n'est présélectionnée**.

## Considered options

- **Domicile seul, fiche sans domicile exclue** — proposé, rejeté par l'arbitrage : le bureau préfère
  une lettre au terrain à aucune lettre.
- **Géométrie entièrement en réglages** — rejeté : une association pourrait sortir l'adresse de la
  fenêtre ; deux décalages bornés suffisent à corriger une imprimante.
- **Aucun réglage, correction dans le code** — rejeté par l'arbitrage : un calage raté bloquerait un
  envoi jusqu'à une livraison.
- **Page de calage en tête de chaque PDF** — rejeté : une page à retirer à chaque mise sous pli, et le
  critère 1 veut un courrier par page.

## Consequences

- Deux réglages de plus dans la page Réglages (carte « Courrier »), rendus par le générateur existant.
- L'import (s13) et s28 partagent une seule définition des homonymes.
- La note agentique de s28 (« jamais le terrain ») est amendée par le point 1 pour la fiche sans
  domicile.
