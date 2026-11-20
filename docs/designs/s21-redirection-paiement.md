# Design — Story s21-redirection-paiement

> Conçu le 2026-11-20, chemin **agent** (orchestrateur). Source visuelle unique : `docs/design-system.md`.
> Contexte : `docs/research/s21-redirection-paiement.md`. Écran de départ :
> `docs/designs/s20-factures-pennylane.md` (écran 1). **Web : mode clair uniquement** (ADR 033). Aucun email.
>
> Contrôle visuel : voir la ligne de résultat en fin de fichier.

## Screen(s)

Un seul écran, **bureau (≥ 1 024 px) et mobile (390 px)**. Données fictives : « Clos-Fleuri », Bernard
Lefèvre, parcelles 12 et 13 (compteur commun) et parcelle 27.

| Écran | Route                                 | Change par rapport à l'existant (s19, s20)                                     |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 1     | `/dashboard` — carte « Mes factures » | colonne « Règlement » sur les factures impayées ; phrase de virement (une fois) |

- **Colonne « Règlement »** — rendue dès qu'au moins une facture de la liste est **impayée** (prédicat
  de s19, `statusClass === 'unpaid'`), quel que soit le fournisseur (manuel ou Pennylane). Placée après
  « Statut », avant « Facture » (PDF). Une cellule par ligne :
  - **impayée avec lien `https`** (1a) : bouton `default` « Payer » (icône `ExternalLink` 16 px), un `<a>`
    vers le lien du fournisseur, **nouvel onglet** (`target="_blank"`, `rel="noopener noreferrer"`) ;
    nom accessible complet : « Payer la facture 2026, parcelles 12 et 13 (s'ouvre dans un nouvel
    onglet) ». Le membre garde son espace ouvert : la page de paiement est sur un autre site ;
  - **impayée sans lien** — ou lien non `https` (critère 6) (1b) : texte `muted` « Par virement »,
    **aucun bouton** ;
  - **réglée ou « à classer »** (critère 5) : cellule vide, ni bouton ni mention.
- **Phrase de virement** (1b) — une seule fois, sous l'introduction de la carte, dès qu'une facture
  impayée n'a pas de lien : `alert` neutre (`Info`, fond `muted`) « Les factures à régler se paient par
  virement. Pour toute question, écrivez au bureau depuis la **page Contact**. » (lien `/contact`).
  Aucun IBAN, aucune coordonnée bancaire écrite par le site.
- **Mobile (< 640 px, cartes §3.5)** — sous les paires, dans l'ordre : « Payer cette facture » (`default`,
  pleine largeur, 56 px, même icône et même nom accessible) puis « Télécharger le PDF » (`outline`,
  s20). Sans lien : une ligne `muted` « À régler par virement. » à la place du bouton. Facture réglée ou
  à classer : rien.
- **Aucun formulaire de paiement** : le bouton est un lien, rien n'est saisi sur le site (critère 4).

## Mockup

`docs/designs/s21-redirection-paiement.html` — référence visuelle. **NE PAS copier en production** :
l'Execute construit l'écran avec les vrais composants (`table`, `button` en `asChild` sur un `<a>`,
`badge`, `alert`, `card`).

## Reused components (from the design system)

- `table` + cartes empilées §3.5 ; `badge` de statut (s19) ; `button` `default` et `outline` (s20).
- `alert` neutre `Info` sur fond `muted` (s20, état 1d).
- Lien de texte `link` vers `/contact` (pied de carte s19).

## States

| Écran | Vide | Chargement | Erreur | Succès |
| ----- | ---- | ---------- | ------ | ------ |
| 1 | aucune facture impayée (1c) : ni colonne « Règlement » ni phrase ; vide et non relié inchangés (s19, s20) | `skeleton` (s19) | lien absent ou non `https` = état 1b (jamais un lien mort) ; un échec chez le prestataire se passe sur son site | 1a (lien), 1b (virement) |

## Design system gaps

1. **Deux actions sur une ligne** (« Payer » et « PDF ») — §2.1 dit « une seule action par ligne » ;
   précédent ouvert : s48 (§9). Proposition : chaque action dans **sa** colonne (« Règlement »,
   « Facture »), une seule par cellule ; en mobile, l'action principale d'abord (« Payer cette
   facture », `default`, 56 px), puis le PDF (`outline`, 56 px). À inscrire au §3.15 (formes de s21).
2. **Lien sortant vers un autre site** — le design system n'annonce le nouvel onglet que pour le
   document PDF des contenus (§4). Proposition : tout lien qui quitte le site s'ouvre dans un nouvel
   onglet, annoncé dans le nom accessible (« s'ouvre dans un nouvel onglet ») et par l'icône
   `ExternalLink` (16 px) ; icône fonctionnelle hors du vocabulaire figé du §1.7, à y ajouter.
3. **Mention à la place d'une action** — « Par virement » (cellule) reprend la forme « PDF non
   disponible » de s20 (`muted`, sans bouton). Pas de composant nouveau.

Contrôle visuel : non fait — Chromium de Playwright ne démarre pas sur la machine (essai du 20/11/2026 :
« Target page, context or browser has been closed » au lancement, comme en s20) ; contrôle en lecture seule à la place, le 20/11/2026 : styles repris de la maquette de
s20, couleurs toutes issues des tokens §1.1 / §1.9 (aucune couleur hors du bloc `:root`), espacements
dans l'échelle §1.4, rupture mobile `max-width: 640px` dans le cadre, états 1a, 1b et 1c présents.
