# Design — Story s29-relances-impayes

> Conçu le 2026-11-23, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s29-relances-impayes.md`.
> Écrans d'ancrage : s26 (détail d'une campagne, états d'un envoi, §3.13), s27 (décompte d'une cible,
> §3.14), s28 (carte « Courrier postal », §3.17), s19/s20 (factures et réglages de la section
> « Factures », §3.15), s02 (cartes générées des réglages, §3.1).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait (navigateur indisponible) — détail en dernière ligne de ce fichier.

## Périmètre du design

Trois écrans. Les deux écrans web viennent en **ordinateur (1 280 px) et mobile (390 px)**. Données
fictives : association « Clos-Fleuri » (CF, teinte 195), échéance commune du 31/03/2026, relances le
21/04, le 05/05 et le 12/05/2026.

| Écran | Où                                                         | États   |
| ----- | ---------------------------------------------------------- | ------- |
| 1     | `/bureau/relances` — suivi des relances                    | 1a à 1e |
| 2     | `/bureau/reglages` — section « Relances des impayés »      | 2a, 2b  |
| 3     | Email de relance — les factures regroupées                 | 3       |

**Non dessiné**, parce que la story ne le demande pas ou que l'écran existe : le détail d'une relance
envoyée (c'est le détail de campagne de s26, avec ses destinataires et sa carte « Courrier postal » de
s28, inchangés), la lettre de relance (gabarit §6.1, contenu de la relance), la notification « facture
disponible » (manuelle, `CDCT §8.3`), un écran de relance manuelle d'une seule fiche, l'historique au-delà
de la série en cours d'une échéance.

## Screen(s)

### Écran 1 — Bureau : « Relances des impayés » (`/bureau/relances`)

Entrée « Relances » dans le groupe « L'association » de la barre du bureau (`NAV_GROUPS`), juste après
« Campagnes » ; sans le droit de gestion des campagnes, `BureauAccessDenied`. Donnée par utilisateur,
lue derrière `<Suspense>`.

- `h1` « Relances des impayés », `meta` « Les membres dont une facture reste impayée, et les relances qui
  leur ont été envoyées. »
- **Bandeau d'état** (une `alert`, en tête) :
  - activée : `alert` neutre fond `muted`, **sans icône** (§3.13, annonce de l'avenir) — « La relance
    automatique est activée. Une relance part 3 semaines après l'échéance, puis 2 semaines et 1 semaine
    plus tard. » + lien « Modifier dans les réglages » (vers la section de l'écran 2). Les durées sont
    lues dans les réglages, jamais écrites en dur.
  - désactivée (1b) : `alert` `warning` + `AlertTriangle` — « La relance automatique est désactivée. Aucune
    relance ne part ; la liste ci-dessous reste à jour. » + lien « L'activer dans les réglages ».
- **Carte « Calendrier »** — une carte par **échéance** ayant au moins un impayé (en pratique une seule par
  an), titre `h2` serif 20 px « Échéance du 31/03/2026 ». **Plan écrit** (§3.13 : lignes à filet gauche
  2 px `border`, dates et nombres en `data`, ni calendrier ni frise), une ligne par rang :
  - « Relance 1 — 21/04/2026 » + badge d'état d'un envoi (§3.13) : « Envoyée » `outline` texte
    `muted-foreground`, puis en `meta` « 212 adresses · 4 courriers » ; liens « Voir l'envoi » (détail
    de campagne s26) et « Courrier postal (4) » (même page, ancre de la carte s28) ;
  - « Relance 2 — 05/05/2026 » + « En cours d'envoi » ou « Programmée pour le 05/05 » `secondary` ;
  - « Relance 3 — 12/05/2026 » + « À venir » `secondary`.
  - Un rang reporté par le budget garde sa ligne et sa date prévue ; en `meta` « 100 reçues · 112
    reportées au 22/04 » (forme « Part entamée » de s52, §3.13). Jamais « En échec » pour un report.
  - Relance désactivée : les rangs futurs disent « Non programmée » `outline` `muted-foreground`.
- **Compteur** (`dl`, forme §3.13) au-dessus du tableau : « Impayés » · « Par email » · « Par courrier ».
- **Tableau « Impayés »** (§2.1, §3.5), trié par nom, paginé à 25 :
  **Membre** (nom, lien vers la fiche) · **Parcelle** (`data`, plusieurs séparées par une virgule) ·
  **Facture** (date de la facture `data`, puis en `meta` « échéance 31/03/2026 ») · **Relances**
  (« 2 sur 3 » en `data`, puis chaque date en `meta` « 21/04 · 05/05 » ; « Aucune » en `muted` avant la
  première) · **Envoi** (« Email », ou badge `outline` « Courrier »).
  - **Une fiche par ligne**. Un propriétaire de plusieurs factures impayées de la même échéance (s53) a
    une seule ligne : la colonne Facture empile ses factures (une ligne `data` par facture, avec sa
    parcelle). La relance qu'il reçoit les regroupe (écran 3).
  - **Aucune action par ligne** : le publipostage se génère par relance, depuis la ligne du calendrier
    (« Courrier postal (4) »), car une lettre porte le contenu figé d'une relance. Une fiche « Courrier »
    est donc présente, marquée, et atteinte par l'action de son rang — jamais omise (critère 10).
  - Sous 640 px : cartes empilées (§3.5), nom en tête, paires « Parcelle », « Facture », « Relances »,
    « Envoi ».
- Pied de page `meta` : « Un statut de facture à classer n'est pas un impayé : il n'est pas relancé. Le
  classement se fait dans les réglages, section Factures. »

### Écran 2 — Réglages : section « Relances des impayés » (`/bureau/reglages`)

Cartes générées du registre (§3.1), placée **après** la section « Factures » (même règle que la carte
Pennylane, §3.15). Six réglages :

1. **Relance automatique** — `switch` « Relancer automatiquement les impayés », aide « Désactivée, aucune
   relance ne part. Les campagnes que vous envoyez vous-même ne changent pas. »
2. **Première relance** — `input` nombre + unité « semaines après l'échéance » (seed 3).
3. **Deuxième relance** — « semaines après la première » (seed 2).
4. **Troisième relance** — « semaines après la deuxième » (seed 1).
5. **Objet de la relance** — `input` texte, compteur (plafond de l'objet reçu, §5.6).
6. **Texte de la relance** — `textarea` long, compteur ; aide : « Variables : {nom}, {parcelle}, {date},
   {factures}. {factures} écrit la liste des factures impayées du membre. »

- **2b — activation refusée** : activer sans objet ou sans texte → résumé ancré `destructive` 2 px et
  message sous le champ vide (« Écrivez le texte de la relance avant de l'activer. »), §3.1.
- La **nature** de la relance automatique s'affiche dans la section « Nature des envois » existante (s27b),
  ligne « Relance automatique », en lecture seule pour le bureau (réservée au SuperAdmin).

### Écran 3 — Email de relance : les factures regroupées

Gabarit commun des campagnes (§5.1 à §5.6), pied **statutaire** ou facultatif selon la nature (§5.4).
L'objet et le texte sont ceux des réglages. La variable `{factures}` est remplacée par une **liste à
puces** du texte (le rendu Markdown existant), une puce par facture impayée de cette échéance :

> - Facture 2026, parcelle 12 : 320,00 €, à régler avant le 31/03/2026
> - Facture 2026, parcelle 14 : 185,00 €, à régler avant le 31/03/2026

Montants en `data` dans la version HTML seulement si le gabarit l'accepte déjà (sinon texte simple) ;
version texte : les mêmes lignes précédées de « - ». La lettre de relance (s28) porte la même liste. Aucun
lien de paiement dans la liste (s21 le porte dans l'espace membre).

## Mockup

`docs/designs/s29-relances-impayes.html` — visual reference. DO NOT copy into production: Execute builds
with the real components. Planches : 1a (ordinateur + mobile), 1b/1c, 1d/1e, 2a/2b, 3.

## Reused components (from the design system)

- `sidebar` du bureau — nouvelle entrée « Relances ».
- `card`, `table` + cartes empilées sous 640 px (§3.5), pagination (§3.13).
- `alert` neutre `muted` sans icône (§3.13), `alert` `warning` + `AlertTriangle`, résumé `destructive`.
- `badge` — états d'un envoi (§3.13) : `outline` terminé, `secondary` à venir / en cours.
- Plan écrit (§3.13), compteur `dl` (§3.13), « Part entamée » (§3.13, s52).
- Cartes générées des réglages (§3.1) : `switch`, `input` nombre avec unité, `input`, `textarea` à compteur.
- `skeleton` — chargement du tableau et du calendrier.
- Gabarit email des campagnes (§5), liste Markdown du corps.
- Icônes du vocabulaire figé (§1.7) : `AlertTriangle`, `Info`.
- Typographie `data` : dates, nombres, montants, parcelles.

## States

- **Suivi (1)** : activée avec impayés (1a) · désactivée (1b) · aucun impayé (1c, « Aucun impayé. Tous les
  membres sont à jour de leurs factures. » — file qui se vide seule, sans action, §3.13 s52) · chargement
  (1d, `skeleton` du compteur, du calendrier et de trois lignes, `aria-busy`) · factures illisibles (1e,
  fournisseur injoignable : `alert` `destructive` « Les factures ne peuvent pas être lues pour l'instant.
  La liste reviendra quand la lecture sera rétablie. Aucune relance ne part tant qu'elles sont
  illisibles. » — jamais une liste vide trompeuse) · non autorisé : `BureauAccessDenied`.
- **Réglages (2)** : au repos (2a) · activation refusée (2b) · succès : forme existante des réglages.
- **Email (3)** : un seul état.

## Design system gaps

1. **Variable de liste `{factures}`** — les variables sont une liste fermée de code (`{nom}`, `{parcelle}`,
   `{date}`, §5.6). La relance regroupe des factures : il faut une variable qui rend **plusieurs lignes**.
   Proposition : une quatrième variable, rendue en liste Markdown, valable pour la relance automatique
   seulement. À trancher au plan.
2. **Publipostage par relance plutôt que par ligne** — le critère 10 demande « une action qui génère leur
   publipostage » ; une lettre portant le contenu figé d'une relance, l'action vit sur le **rang** (ligne
   du calendrier), pas sur la fiche. Une action par fiche obligerait à produire une lettre hors relance.
   À confirmer au plan.
3. **Statut « Non programmée »** — état d'un rang futur quand la relance est désactivée : composé de
   `outline` texte `muted-foreground` (forme « terminé » de §3.13), sans nouveau badge. À verser au §3.13.

Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du conteneur,
comme pour s19, s31 et s53) ; contrôle en lecture seule à la place : aucune valeur hex ni rgb, chaque
`oklch` est une déclaration de token du §1.1/§1.9, marges dans l'échelle 4/8/12/16/24/32/48/64 (les
autres valeurs en px sont des tailles de police de l'échelle, des bordures 1/2 px, la piste du `switch`
et les largeurs de cadre), planches 1a à 3 présentes, les écrans web en ordinateur et en mobile 390 px
(requêtes de conteneur sous 640 px).
