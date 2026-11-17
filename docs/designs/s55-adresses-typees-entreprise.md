# Design — Story s55-adresses-typees-entreprise

> Conçu le 2026-11-17, chemin **agent** (`/ks-orchestrator`). Source visuelle unique :
> `docs/design-system.md`. Contexte de code : `docs/research/s55-adresses-typees-entreprise.md`.
> Écrans d'ancrage : s12 (fiche du bureau, carte « Coordonnées », bannière « Fiche incomplète »), s16 / s53
> (carte « Mes coordonnées »).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright ne démarre pas (`libnspr4.so` absente du
> conteneur, vérifié le 2026-11-17) ; contrôle en lecture seule à la place : aucune couleur hors des
> tokens de `:root`, marges dans l'échelle 4/8/12/16/24/32/48, chaque planche en deux versions
> (ordinateur et mobile 390 px, par requêtes de conteneur), quatre états présents.

## Périmètre du design

Données fictives : association « Clos-Fleuri » (CF). Fiche « Jean Dubois » (particulier) ; fiche
« Épicerie du Clos » (entreprise) ; fiche « Lucie Martin » (incomplète).

| Écran | Route                                                    | États   |
| ----- | -------------------------------------------------------- | ------- |
| 1     | `/bureau/proprietaires/{id}` — carte « Coordonnées »     | 1a à 1f |
| 2     | `/dashboard` — carte « Mes coordonnées » (s16)           | 2a à 2c |

**Non dessiné** (l'écran ne change que par réemploi) : création d'une fiche (`/nouveau`) — elle reprend
**les mêmes champs** que l'état 1d, via le composant partagé `member-contact-fields.tsx` ; liste des
propriétaires — badge « Fiche incomplète » et compteur inchangés à l'écran, seule la règle change ; rapport
d'import — aucune ligne nouvelle tant que le plan n'en décide pas ; courrier (s28, plus tard).

**Vocabulaire** : « Adresse de domicile » et « Adresse du terrain » partout ; « adresse postale » ne
survit que dans la mention d'aide du domicile (« Adresse postale : le courrier de l'association part
ici. »), pour dire que le domicile **est** l'adresse postale (critère 2). « Nom de l'entreprise » pour le
libellé.

## Screen(s)

### Écran 1 — Fiche du bureau, carte « Coordonnées »

La carte existante (`DetailCard`, `dl` en deux colonnes `12rem / 1fr`, une colonne sous 640 px) passe de
deux paires à quatre, dans cet ordre :

1. **Téléphone** — inchangé.
2. **Adresse de domicile** — lignes de l'adresse (adresse, complément, code postal en `data` + commune),
   puis `meta` « Adresse postale : le courrier de l'association part ici. » Absente : « Non renseignée ».
3. **Adresse du terrain** — même rendu, sans mention. Absente : « Non renseignée ». (Réponse à la question 5
   de la recherche : le terrain vit dans « Coordonnées », pas dans la carte des parcelles — une fiche porte
   une seule adresse de terrain, quel que soit le nombre de ses parcelles.)
4. **Nom de l'entreprise** — le libellé, puis `meta` « Imprimé dans le bloc adresse du courrier. Ne change
   ni le rôle, ni les factures, ni le droit de vote. » Absent : « Aucun ».

Action unique : `button` `outline` « Modifier les coordonnées » (libellé existant).

**Édition (1d)** — le formulaire en place reste dans la carte, en trois blocs séparés par un filet :

- Téléphone (facultatif, `max-w-xs`) — inchangé.
- `fieldset` + `legend` « Adresse de domicile (facultatif) », aide « L'adresse postale de la fiche : là où le
  propriétaire reçoit le courrier le reste de l'année. » Champs actuels : Adresse, Complément (facultatif),
  Code postal (`data`, `10rem`) + Commune.
- `fieldset` + `legend` « Adresse du terrain (facultatif) », aide « L'adresse du terrain de vacances dans
  l'association. » Mêmes quatre champs.
- « Nom de l'entreprise (facultatif) », aide « Pour une entreprise établie sur le terrain (restaurant,
  supérette). Imprimé dans le bloc adresse du courrier ; ne change rien d'autre. »
- Actions : `default` « Enregistrer », `ghost` « Annuler » (existants). 56 px et pleine largeur sous 640 px.

Identifiants de champ : les deux groupes ont des noms distincts (ex. `home…` / `land…`) ; le focus de la
bannière « Ajouter l'adresse de domicile » vise l'Adresse **du domicile**.

### Écran 2 — Espace membre, carte « Mes coordonnées »

Carte s16 inchangée dans sa forme : la paire « Adresse postale » devient **« Adresse de domicile »**, et la
description de la carte dit « L'association vous écrit par courrier à votre adresse de domicile. » Le
formulaire de correction ne change que ses libellés (« Adresse de domicile » en `legend`). **Ni le terrain
ni le nom d'entreprise** n'y figurent : le membre ne les corrige pas (critère 5), et le terrain est propre à
chaque fiche alors que la correction vaut pour tous les terrains du compte (s53). Les groupes de coordonnées
divergentes (s53, 2b) se calculent sur le domicile seul.

## Mockup

docs/designs/s55-adresses-typees-entreprise.html — visual reference. DO NOT copy into production: Execute
builds with the real components.

## Reused components (from the design system)

- `Card` / `DetailCard` — carte « Coordonnées » et « Mes coordonnées », existantes.
- `dl` en paires — patron de la carte actuelle (s12, s16).
- `Input` + `Label` + `FormMessage` (§3.1 formulaires) — mêmes champs que l'adresse actuelle.
- `fieldset` / `legend` (§3.1, groupes de champs) — un par adresse.
- `Alert` niveau `warning` — bannière « Fiche incomplète » existante, texte réécrit.
- `Badge` « Courrier uniquement » / « Fiche incomplète » — existants.
- `Button` `outline` / `default` / `ghost` — existants.

## States

- **Vide / incomplet (1c, 2b)** : « Non renseigné(e) » / « Aucun » ; ni email ni domicile → bannière
  `warning` « cette fiche n'a ni adresse email ni adresse de domicile : aucun envoi ne peut atteindre ce
  propriétaire » + « Ajouter l'adresse de domicile ». Un terrain seul **ne lève pas** l'avertissement.
- **Chargement (1d)** : pas d'état distinct — « Enregistrement… » désactivé, comme aujourd'hui.
- **Erreur (1e)** : récapitulatif `destructive` en tête de carte + message sous le champ ; le message nomme
  le groupe (« Terrain : le code postal compte cinq chiffres. »), car les deux groupes ont un code postal.
- **Succès (1f, 2c)** : messages de statut existants (« Coordonnées enregistrées », « Vos coordonnées sont
  à jour »).

## Design system gaps

Aucun : tous les éléments existent (formulaire groupé §3.1, paires, bannière, badges). À noter pour s28 :
le **bloc adresse du courrier** (nom, nom d'entreprise, domicile) n'est pas dessiné ici — il appartient au
gabarit de publipostage de s28.
