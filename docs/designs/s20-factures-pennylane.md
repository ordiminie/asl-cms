# Design — Story s20-factures-pennylane

> Conçu le 2026-11-19, chemin **agent** (orchestrateur). Source visuelle unique : `docs/design-system.md`.
> Contexte : `docs/research/s20-factures-pennylane.md`. Écrans de départ : `docs/designs/s19-factures-liste.md`.
> **Web : mode clair uniquement** (ADR 033). Aucun email nouveau.
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas sur la machine (`libnspr4.so`
> absente) ; contrôle en lecture seule à la place, le 19/11/2026 : styles repris de la maquette de s19,
> couleurs toutes issues des tokens §1.1 / §1.9 (aucune couleur hors du bloc `:root`), espacements dans
> l'échelle §1.4, une rupture mobile `max-width: 640px` dans le cadre, quatre états par écran présents.

## Screen(s)

Trois écrans, **bureau (≥ 1 024 px) et mobile (390 px)** dans le même fichier. Données fictives :
« Clos-Fleuri », Bernard Lefèvre, deux terrains (parcelles 12 et 13 sur un compteur commun ; parcelle 27).

| Écran | Route                                 | Change par rapport à l'existant (s19)                                                    |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | `/dashboard` — carte « Mes factures » | colonne « Facture » (PDF), terrain à plusieurs parcelles, date de mise à jour, 3 états    |
| 2     | `/bureau/proprietaires/{id}`          | carte « Facturation » (identifiant client Pennylane) ; « Factures » sans saisie            |
| 3     | `/bureau/reglages`                    | option « Pennylane », réglage « Libellés des statuts », carte « Synchronisation Pennylane » |

- **Écran 1 — Mes factures.** La carte de s19 reste ; trois ajouts :
  - **Colonne « Facture »** : bouton `outline` « PDF » (icône `Download`, nom accessible complet « PDF de
    la facture 2026, parcelle 12 ») ; sous 640 px, « Télécharger le PDF » pleine largeur, 56 px. Sans PDF
    (`public_file_url` nul) : texte `muted` « PDF non disponible », **aucun bouton** (critère 8). Le PDF
    s'ouvre dans le même onglet (un téléchargement, pas une page) ; le lien est demandé à Pennylane **au
    clic**, jamais rendu dans la page (il expire en 30 min).
  - **Terrain** : « Parcelles 12 et 13 » quand le terrain en compte plusieurs (propriété **à la date
    d'émission**), puis « Compteur … » ; le nom de la fiche s'il diffère du compte (s19, inchangé).
  - **Mise à jour** : « Factures mises à jour le 19/11/2026 à 14 h 05. » sous le tableau (`meta`), sous
    Pennylane seulement.
  - **Statut** : libellé du réglage (« En retard » pour `late`), sinon le statut brut ; variante du badge
    inchangée (classe `unpaid / settled / unclassified`, s19).
- **Écran 2 — Fiche (bureau).** Carte **« Facturation »** avec le champ « Identifiant client Pennylane »
  (`input` en `data`, facultatif, aide : « L'« Identifiant Client » de ce terrain dans l'export des clients
  Pennylane, de la forme 3f2a…-…-…. »),
  enregistré avec la fiche (critère 4). Sans identifiant, sous Pennylane : `alert` d'avertissement « Cette
  fiche n'est reliée à aucun client Pennylane. Ses factures ne remontent pas. » Carte « Factures » : sous
  Pennylane, plus de « Ajouter une facture » ni de « Modifier » ; phrase « Les factures viennent de
  Pennylane et se lisent ici en lecture seule. Mises à jour le … » ; les factures saisies avant le passage
  restent listées, colonne Source « Saisie sur le site · Lecture seule ».
- **Écran 3 — Réglages.** Carte « Facturation » (s19) : `radio-group` « Fournisseur des factures »
  (« Saisie sur le site », « Pennylane » ; SuperAdmin seul, s52) ; nouveau réglage texte long **« Libellés
  des statuts »** (`textarea` en `data`, compteur, aide « Un statut par ligne : le statut tel que Pennylane
  l'écrit, « = », puis le mot que lisent les membres. Un statut sans libellé s'affiche tel quel. »). Sous
  Pennylane seulement, carte **« Synchronisation Pennylane »** : `alert` neutre `CircleCheck` « Factures
  mises à jour le … » (ou avertissement si la dernière a échoué), puis lignes de compteur : factures
  remontées, écartées (brouillons, avoirs, sans date), **fiches sans identifiant** (liens vers les fiches),
  **clients Pennylane sans fiche** (référence en `data` + nom tel que Pennylane l'écrit) ; **écarts de terrain** (la facture n° … dit « parcelle AH 7 · compteur … » alors que la fiche
  porte « AH 6 » : lien vers la fiche) ; bouton
  `outline` « Mettre à jour maintenant ».

## Mockup

`docs/designs/s20-factures-pennylane.html` — référence visuelle. **NE PAS copier en production** : l'Execute
construit les écrans avec les vrais composants (`table`, `button`, `badge`, `alert`, `card`, `input`,
`textarea`, `radio-group`, `skeleton`).

## Reused components (from the design system)

- `table` + cartes empilées §3.5, `badge` (s19), `button` `outline`, icône lucide `Download`, `RefreshCw`.
- `alert` neutre (`Info`, `CircleCheck`), `alert` d'avertissement (§3.2), alerte ancrée `role="alert"`.
- Réglages générés §3.1 : texte long (`textarea` + compteur), choix fermé (`radio-group`).
- Compteur en lignes libellé / valeur `data` (§3.13).

## States

| Écran | Vide | Chargement | Erreur | Succès |
| ----- | ---- | ---------- | ------ | ------ |
| 1 | s19 (« Aucune facture pour l'instant ») ; compte non relié (1e) : « Vos factures ne sont pas encore reliées à votre espace. Le bureau en est informé et s'en occupe. » | `skeleton` (s19) | synchro échouée (1d) : `alert` neutre « Les factures n'ont pas pu être mises à jour. Voici vos factures telles qu'elles étaient le … » ; PDF au clic (1f) : alerte « Le PDF n'a pas pu être ouvert. Réessayez dans un moment. » | 1a |
| 2 | fiche sans identifiant (2b) : avertissement | existant | identifiant déjà pris par une autre fiche : « Cet identifiant est déjà porté par la fiche « … ». » (bordure `destructive`) | toast d'enregistrement existant |
| 3 | jamais synchronisé : « Pas encore de mise à jour. La première a lieu dans l'heure. » | `skeleton` sur les nombres pendant « Mettre à jour maintenant » | échec (3b) : avertissement, données conservées, « Nouvel essai dans l'heure. » ; clé absente : « La clé d'accès à Pennylane n'est pas configurée sur le serveur. » | 3a |

## Design system gaps

1. **Carte non générée dans la page des réglages** : « Synchronisation Pennylane » n'est pas un réglage
   du registre. Précédent : l'aperçu « Dans Google » de s11 (§3.1). Proposition : une carte d'état placée
   après la carte de sa section, rendue seulement quand le réglage qui la justifie est actif.
2. **Réglage « clé = valeur » par ligne** : rendu comme le texte long existant (§3.1), avec une aide qui
   donne la syntaxe ; pas de composant nouveau. À noter au §3.1 comme forme retenue.
3. **Bouton de téléchargement par ligne** : la règle « une seule action par ligne » (§2.1) est tenue (c'est
   l'unique action de la ligne côté membre). À inscrire au §3.12 avec la variante « non disponible » écrite.
