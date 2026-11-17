# Design — Story s19-factures-liste

> Conçu le 2026-11-17, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s19-factures-liste.md`.
> Écrans d'ancrage : s53 (carte « Mes terrains », vocabulaire « terrain »), s12 (fiche d'un propriétaire),
> s23 (notification au bureau).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, comme pour s53) ; contrôle en lecture seule à la place : aucune couleur hors des tokens de
> `:root` (chaque valeur `oklch` est une déclaration de token, identique au §1.1/§1.9), marges dans
> l'échelle 4/8/12/16/24/32/48/64, six planches en deux versions chacune (ordinateur et mobile 390 px,
> par requêtes de conteneur sous 640 px).

## Périmètre du design

Quatre écrans, chacun en **ordinateur (1 280 px) et mobile (390 px)**. Données fictives : association
« Clos-Fleuri » (CF, teinte 195) ; Bernard Lefèvre, trois terrains (parcelle 12 compteur 0045821,
parcelle 27 compteur 0051207, parcelle 31 au nom de « SCI Les Pins » sans compteur). Les statuts
« Payée », « En attente », « Partiellement payée », « Relance 1 » sont **fictifs** : la liste réelle se
relève en s20, et aucune valeur n'est livrée dans le code ni la configuration (amendement du 15/11).

| Écran | Route                                                             | États   |
| ----- | ----------------------------------------------------------------- | ------- |
| 1     | `/dashboard` — carte « Mes factures »                             | 1a à 1c |
| 2     | `/bureau/proprietaires/{id}` — carte « Factures »                 | 2a      |
| 3     | `/bureau/proprietaires/{id}/factures/nouvelle` et `…/{factureId}` | 3a à 3d |
| 4     | Email « un statut de facture est à classer »                      | 4       |

**Non dessiné**, parce que la story ne le demande pas : téléchargement du PDF (s20), bouton de paiement
(s21), écran de classement des statuts (exclu en V1 par le critère 6), historique des corrections (exclu
en V1), consommation (s18). Les **réglages** nouveaux (objet, destinataire, classement des statuts) n'ont
pas de planche : la page des réglages est générée depuis le registre (§3.1, « un type de réglage → un
composant ») ; voir le manque n° 1.

## Screen(s)

### Écran 1 — Espace membre : « Mes factures » (`/dashboard`)

Carte placée **juste après « Mes terrains »** (s53), dans la coquille s46. Pas de sous-page : un membre
a une facture par terrain et par an (amendement du 15/11), la liste tient dans la carte ; et §8 interdit
onglets et densité côté membre.

- Titre `h2` serif 20 px « Mes factures » ; `meta` « Les factures de vos {n} terrains, les plus récentes
  en premier. » (un terrain : « Vos factures, les plus récentes en premier. »).
- **Une seule liste** pour tous les terrains du compte (critère 1), triée par date d'émission
  décroissante. Colonnes : **Émise le** (`data`, `jj/mm/aaaa`) · **Objet** (texte composé, critère 4) ·
  **Terrain** (« Parcelle **12** » + `meta` « Compteur **0045821** », « Compteur non renseigné », ou le
  nom de la fiche quand il diffère du compte, « SCI Les Pins ») · **Montant** (`data` 600, aligné à
  droite, « 412,50 € ») · **Échéance** (`data`) · **Statut** (`badge`).
- **Statut** : le texte affiché est le statut **tel que fourni** (ou son libellé configuré, avec repli
  sur le brut — à confirmer au plan). La **variante** du badge suit le prédicat (composition §3.10,
  aucune couleur nouvelle) : impayé → `outline` + point plein `primary` ; non impayé → `outline` texte
  `muted-foreground` ; **à classer → `secondary`**. Le mot porte l'information ; jamais de rouge.
- Aucune action par ligne en s19. Pied de carte : « Une facture vous semble fausse ? Écrivez au bureau
  depuis la page Contact. »
- **Pagination** : règle du tableau (25 lignes, 10 cartes sous 640 px, « Précédent / Suivant » écrits)
  au-delà de ce nombre seulement.
- **Mobile** (§3.5) : une carte par facture — l'objet en titre, le badge dessous (§3.9), puis les paires
  dans l'ordre des colonnes.
- **Aucun identifiant** de fiche ou de facture dans l'écran ni dans un lien : la liste vient de la
  session et du domaine (critère 7).

### Écran 2 — Bureau : carte « Factures » de la fiche (`/bureau/proprietaires/{id}`)

Après la carte « Parcelles » existante. Tableau du bureau (§2.1) : Émise le · Objet (+ `meta` parcelle) ·
Montant · Échéance · Statut · **Source** · action.

- **Une seule action par ligne** : « Modifier » (`outline`) pour une facture **saisie sur le site** ; une
  facture **Pennylane** n'a pas d'action et la colonne Source le dit (« Pennylane » + `meta` « Lecture
  seule ») — le mot, pas une absence muette.
- Sous le tableau : `default` « Ajouter une facture » (le seul `default` de la carte).
- **Pennylane actif** (question laissée au design par la story) : **tranché par s20, critère 1**
  (« remplace la saisie manuelle »). Quand l'implémentation du tenant n'est pas `manuel`, le bouton
  « Ajouter une facture » n'apparaît pas et les lignes saisies restent consultables. En s19, seule
  `manuel` existe : le cas n'a pas de planche.
- Vide : « Aucune facture pour ce propriétaire. → Ajouter une facture » (§3.2).
- Visible des rôles qui portent l'action du registre ; sinon la carte n'est pas rendue.

### Écran 3 — Bureau : saisir ou modifier une facture (page)

Plus de deux champs : une **page**, pas un `dialog` (§3.11). Fil d'Ariane « Propriétaires › {nom} ›
Ajouter une facture ».

- Champs, une colonne (deux côte à côte en ordinateur pour les paires courtes) :
  1. **Terrain facturé** (`select`) — les parcelles dont la fiche est propriétaire à la date d'émission ;
     aide « Les parcelles dont {nom} est propriétaire à la date d'émission. » _Proposition liée à la
     question ouverte n° 1 de la recherche, à trancher au plan._
  2. **Année** (`input` numérique en `data`) et **Montant** (`input` en `data`, « € » écrit à droite).
  3. Aperçu en `meta` : « Objet affiché au membre : **Cotisation et eau 2026** » — l'objet n'est pas
     saisi, il est composé depuis le réglage du tenant et l'année (critère 4).
  4. **Émise le** et **Échéance** — champ date de §3.9 (saisie au clavier, pré-rempli à aujourd'hui pour
     l'émission ; l'échéance est obligatoire, critère 3).
  5. **Statut** (`select`) — les statuts déclarés dans la configuration du tenant ; aide « Les statuts
     déclarés dans les réglages de l'association. » _Proposition liée à la question ouverte n° 4._
- Actions : `default` « Enregistrer la facture », `outline` « Annuler » (empilés 56 px en mobile, le
  principal en premier).
- **3b, erreurs** : résumé ancré `destructive` 2 px avec liens d'ancrage + message sous chaque champ
  (« Saisissez un montant positif, par exemple 412,50. », « L'échéance ne peut pas précéder la date
  d'émission (15/03/2026). »).
- **3c, succès** : retour sur la fiche, `alert` neutre `CircleCheck` « Facture enregistrée. {nom} la voit
  dès maintenant dans son espace, carte « Mes factures ». »
- **3d, facture Pennylane** : la page n'a **pas de formulaire** ; paires en lecture, `alert` neutre
  `muted` + `Info` « Cette facture vient de Pennylane. Elle se lit ici mais se corrige dans Pennylane. »
  Si un envoi direct arrive quand même (critère 9), refus en `alert` `destructive` 2 px : « La facture
  n'a pas été modifiée. Elle vient de Pennylane et ne se corrige que là-bas. Rien n'est perdu. »
- Lien de retour « Revenir à la fiche » (`ArrowLeft` + libellé).

### Écran 4 — Email « un statut de facture est à classer »

Nature **« Notification au bureau »** (vocabulaire de §3.13), gabarit HTML et jumeau sombre des
notifications au bureau de s23, version texte brut.

- Objet (§5.6, ≤ 60 caractères, préfixé) : « ASL {nom} — un statut de facture est à classer ».
- Corps : le statut inconnu entre guillemets ; « Tant qu'il n'est pas classé, les factures qui le portent
  ne sont comptées ni comme réglées, ni comme impayées : elles restent hors des relances. » ; nombre de
  factures concernées ; lien en clair vers les réglages de l'association. **Aucun nom de membre ni
  montant** : le destinataire voit le détail dans le back-office.
- Fréquence d'envoi (une fois par statut ou par facture) : question ouverte n° 3 de la recherche, à
  trancher au plan.

## Mockup

`docs/designs/s19-factures-liste.html` — visual reference. DO NOT copy into production: Execute builds
with the real components. Six planches (1a, 1b/1c, 2a, 3a/3b, 3c/3d, 4), chacune en cadre ordinateur
puis cadre mobile 390 px.

## Reused components (from the design system)

- En-tête de l'espace membre (§3.12), marqueur « Espace personnel » (§3.4) — inchangés.
- `card` — Mes factures, Factures (bureau), page de saisie.
- `table` + cartes empilées sous 640 px (§3.5), `pagination`.
- `badge` — statut, variantes de §3.10 (`outline` + point `primary`, `outline` atténué, `secondary`).
- `select`, `input` (numérique en `data`), champ date (§3.9), `label`, aide en `muted-foreground`.
- `alert` — succès neutre `CircleCheck`, neutre `muted` + `Info`, résumé d'erreurs `destructive` 2 px.
- `button` `default` / `outline` (48 px ; 56 px empilés sur mobile).
- `skeleton` — chargement de « Mes factures ».
- Icônes du vocabulaire figé (§1.7) : `Receipt` facture, `Map`, `Droplet`, `Info`, `CircleCheck`,
  `ArrowLeft`, `Calendar`.
- Typographie `data` (JetBrains Mono, `tabular-nums`) : dates, montants, parcelle, compteur.
- Gabarit d'email des notifications au bureau (s23, §5).

## States

- **Mes factures (1)** : plusieurs terrains (1a) · un terrain (même liste, phrase d'introduction au
  singulier) · vide (1b, « Aucune facture pour l'instant… » + écrire au bureau) · chargement (1c, trois
  lignes `skeleton`, `aria-busy`) · erreur : page d'erreur existante de l'espace membre · compte sans
  fiche : carte non rendue (comportement de « Mes terrains »).
- **Factures du bureau (2)** : liste mixte (2a) · vide · non autorisé (carte absente).
- **Saisie (3)** : formulaire (3a) · erreurs (3b) · succès (3c) · Pennylane en lecture et refus serveur
  (3d) · erreur serveur : `alert` `destructive` ancré, « La facture n'a pas été enregistrée. Rien n'est
  perdu : vos saisies sont conservées. »
- **Email (4)** : statut inconnu ; envoi reporté au lendemain si le budget est épuisé (s52, sans écran).

## Design system gaps

1. **Réglage de type « liste »** (classement des statuts impayé / non impayé, libellés par statut) : le
   registre et la page générée ne connaissent que email, nombre, booléen, choix, texte. Selon l'option
   retenue au plan (question n° 2 de la recherche) — `textarea` d'un statut par ligne (rendu existant),
   nouveau type, ou table dédiée —, le rendu est à décider ; **non dessiné ici**.
2. **Variante de badge « à classer »** : `secondary` reprend l'étape « en cours » de §3.10, faute d'un
   état « indéterminé » propre. À inscrire au §3 si la forme est retenue.
3. **Montant en champ** : §3.1 prévoit « nombre en `data`, unité écrite à droite » ; la virgule décimale
   française et le nombre de décimales ne sont pas décrits.
4. **Terrain dans une ligne de facture** : le libellé « Parcelle N · Compteur M » sur deux lignes dans
   une cellule de 56 px reprend l'écart déjà relevé par s53 (écran 4) — même validation à faire.
5. Écarts propres à la maquette : polices non chargées (repli système), barre latérale indicative,
   icônes lucide redessinées à la main.
