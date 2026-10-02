# Design Brief — Story s12-membres-parcelles

> Paste this brief into the external design tool (Claude Design). It is self-contained: story,
> screens, constraints, expected output. French UI copy throughout — the product has one locale, `fr`,
> without a URL prefix.

## Story

**En tant que** membre du bureau **je veux** gérer les propriétaires et leurs parcelles avec les
périodes de propriété **afin que** l'historique reste attaché au bon propriétaire après une vente.

Acceptance criteria:

1. Le bureau **crée un membre** et lui **rattache une ou plusieurs parcelles** avec une **date de
   début de propriété**. L'identifiant du membre est autogénéré — _invisible, ne pas l'afficher._
2. **Enregistrer une vente** clôture la période du vendeur et ouvre celle de l'acquéreur, **sans
   supprimer ni modifier la période close**.
3. Le propriétaire d'une parcelle se lit **à une date donnée** : avant la vente, l'ancien ; après,
   le nouveau.
4. Une parcelle ne peut pas avoir **deux propriétaires sur des périodes qui se chevauchent** : la
   tentative est refusée avec un **message explicite**.
5. Un membre possédant plusieurs parcelles est **un seul compte**, avec **la liste de ses
   parcelles**.
6. Le bureau saisit et met à jour les **coordonnées** d'un membre depuis sa fiche : **adresse
   postale, téléphone, adresse email** — y compris pour un membre sans compte.
7. Le bureau crée une fiche **sans adresse email** : aucun compte n'est créé, la fiche est marquée
   **« Joignable par courrier uniquement »**.
8. Une fiche « courrier uniquement » **sans adresse postale** est signalée **incomplète** dans la
   liste des membres : elle n'est joignable par aucun canal.
9. **Renseigner un email** sur une fiche « courrier uniquement » lui **ouvre un compte** ; **le
   retirer referme l'accès** sans supprimer la fiche ni son historique.
10. **Un membre ne voit que ses propres parcelles** ; l'accès à la fiche d'un autre membre est
    refusé.

Contexte produit : **cœur du modèle de l'espace membres.** Une association de ~400 propriétaires,
dont **~100 n'ont aucune adresse email** et reçoivent tout par courrier. Le back-office est tenu par
3 à 8 bénévoles non techniciens ; les membres sont souvent âgés et se connectent rarement. Une
parcelle se **vend** : l'historique (factures, relevés d'eau, documents) reste attaché au
propriétaire **de l'époque**, jamais transféré à l'acquéreur.

### Arbitrages déjà rendus — ne pas les rouvrir

- **L'email n'est pas l'identité d'un membre**, ni le numéro de parcelle. Une fiche existe sans
  email ; un numéro de parcelle change de propriétaire.
- **« Joignable par courrier uniquement » n'est pas un défaut** : c'est le cas nominal d'un quart
  des membres. Le ton de l'écran ne le traite jamais comme une erreur — **seule** la fiche
  courrier uniquement **sans adresse postale** est « incomplète ».
- **Aucun plan B de connexion** pour un membre sans email (pas de code, pas de compte partagé) :
  le design system l'a retiré.
- **Pas de purge, pas de coupure automatique d'accès** (arbitrage RGPD en attente) : aucun écran
  pour ça, aucune mention « compte expiré ».
- **Pas d'agrégation de factures** ici, ni de relevés, ni de documents : d'autres stories les
  afficheront sur la fiche plus tard. **Ne pas dessiner d'onglets ou de sections vides pour elles.**
- **Ouvrir un compte n'envoie rien** au membre _(hypothèse, à confirmer au plan)_ : l'invitation
  est une autre story. Le membre peut demander un lien de connexion sur le site.

## Screens to produce

Six écrans, plus des repères de continuité. Données fictives : association **« Les Amis de
l'Étang »**, teinte **« eau » (195)**. Numéros de parcelle en `data` (`font-mono`).

Membres d'exemple :

| Membre               | Parcelles          | Contact                                   | État                                  |
| -------------------- | ------------------ | ----------------------------------------- | ------------------------------------- |
| Claire Meunier       | 12, 13             | claire.meunier@example.fr · compte ouvert | —                                     |
| Jean et Odile Dubois | 47 (vendue 15/06/2026) | Courrier uniquement · 8 chemin des Pins, 33680 Lacanau | —                        |
| Paul Ferrand         | 47 (depuis 15/06/2026) | p.ferrand@example.fr · compte ouvert  | —                                     |
| Hélène Roy           | 21                 | Courrier uniquement · **aucune adresse**  | **Fiche incomplète**                  |
| Marcel Laurent       | 5, 6, 30           | 06 12 34 56 78 · courrier uniquement      | —                                     |

La parcelle **47** est l'exemple de vente : Jean et Odile Dubois du 03/02/1998 au 14/06/2026,
Paul Ferrand depuis le 15/06/2026.

### 0 · Repères de continuité — déjà livrés, **ne pas redessiner**

- **Barre latérale** : « Le site » (Pages, Actualités, Analyses d'eau, Navigation, Messages reçus,
  Membres du bureau, Bandeau d'alerte), « L'association » (Identité, Réglages). Cette story ajoute
  **« Membres »** au groupe **« L'association »**, **en tête**, avant Identité. ⚠️ « Membres du
  bureau » (le site public) existe déjà : les deux libellés doivent se distinguer à la lecture —
  le signaler. Items sans icône, actif = `sidebar-accent` + 600.
- **Espace membre** (`/dashboard`, gabarit `max-w-[1000px]`, une colonne, **ni `sidebar` ni
  `tabs`**) : aujourd'hui vide d'éléments d'association. Cette story y ajoute « Mes parcelles ».
- **Connexion par lien** : déjà livrée ; un membre dont la fiche a un email peut demander un lien.

### 1 · Back-office — Liste des membres (`/bureau/membres`)

- **Purpose** : retrouver un membre, repérer les fiches incomplètes, en créer une.
- **Layout** : `h1` « Membres ». `meta` : « 412 membres · 1 fiche incomplète ». Bouton `default`
  « Ajouter un membre ». Un champ **« Rechercher un nom ou un numéro de parcelle »** au-dessus du
  tableau _(proposition : 400 fiches sur 17 pages ne se parcourent pas sans ; hors critères, à
  confirmer au plan — le dessiner, l'annoter)_.
  `table` dans une `card`, **trié par nom** :
  - **Membre** — nom en `body-strong`, colonne d'identité ;
  - **Parcelles** — numéros **actuels** en `data`, séparés par des virgules ; « Aucune parcelle
    actuelle » en `muted-foreground` pour un ancien propriétaire ;
  - **Contact** — l'email, ou `badge` « Courrier uniquement » (neutre, **pas un avertissement**) ;
  - **État** — `badge` `AlertTriangle` 16 px + « Fiche incomplète » **seulement** quand la fiche
    est « courrier uniquement » sans adresse postale ; sinon la cellule est vide _(la seule cellule
    vide admise : l'absence d'alerte)_ ;
  - **Action** — une seule : « Ouvrir la fiche ».
- **Pagination** : 25 lignes, « Précédent / Suivant » écrits.
- **States** : **vide** (« Aucun membre pour l'instant. Ajoutez les propriétaires un par un, ou
  attendez l'import de la liste existante. » + « Ajouter un membre ») · **chargement** (`skeleton`)
  · **liste** (les 5 exemples) · **recherche sans résultat** (« Aucun membre ne correspond à « Duboi ».
  Vérifiez l'orthographe, ou cherchez par numéro de parcelle. »).
- **Mobile (390 px)** : cartes empilées (nom en titre, badges dessous, « Parcelles », « Contact »
  en paires, « Ouvrir la fiche » pleine largeur 56 px), 10 par page.

### 2 · Back-office — Ajouter un membre (`/bureau/membres/nouveau`)

- **Purpose** : créer une fiche, avec ou sans email, en une seule soumission.
- **Layout** : `breadcrumb` « Membres › Ajouter un membre ». `h1` « Ajouter un membre ». Formulaire
  en une colonne `max-w-[68ch]`, en trois `card` :
  1. **Identité** — **Nom** (`input`, obligatoire, aide : « Tel qu'il doit apparaître sur les
     courriers : "Jean et Odile Dubois", "SCI Les Pins". »). _(Un seul champ nom, pas prénom + nom :
     un propriétaire est parfois un couple ou une société — proposition à confirmer au plan.)_
  2. **Coordonnées** — **Adresse email** (« Facultatif », aide : « Avec une adresse, le membre peut
     se connecter à son espace. Sans adresse, il reçoit tout par courrier. ») · **Téléphone**
     (« Facultatif ») · **Adresse postale** : Adresse, Complément (« Facultatif »), Code postal (en
     `data`, 5 chiffres), Commune _(structure proposée pour le publipostage — à confirmer au plan)_.
     Sous l'adresse, **quand l'email est vide**, un encart `alert` neutre qui suit la saisie :
     « Sans adresse email, ce membre sera **joignable par courrier uniquement**. Son adresse postale
     est alors indispensable. »
  3. **Parcelles** — _facultatif à la création_ : on rattache les parcelles depuis la fiche
     (écran 4). Écrire simplement « Vous rattacherez ses parcelles depuis sa fiche, une fois
     enregistrée. » _(Proposition : garde le formulaire court ; à annoter.)_
- **Action** : `default` « Enregistrer le membre », `outline` « Annuler ».
- **States** : **vierge** · **avec email** (aucun encart) · **sans email** (encart « courrier
  uniquement ») · **erreurs par champ** (résumé ancré 2 px avec liens d'ancrage + bordures 2 px +
  messages : « Indiquez le nom du membre. » / « Cette adresse email n'est pas valide. » / « Un code
  postal compte 5 chiffres. ») · **email déjà utilisé par une autre fiche** de l'association
  (« Cette adresse est déjà celle de la fiche de Claire Meunier. » + lien vers la fiche) ·
  **enregistré** → la fiche (écran 3) avec `alert` neutre « Fiche créée. » (+ « Compte ouvert :
  Claire Meunier peut se connecter avec claire.meunier@example.fr. » quand il y a un email).
- **Mobile (390 px)** : champs 56 px, bouton pleine largeur 56 px.

### 3 · Back-office — Fiche d'un membre (`/bureau/membres/{id}`)

- **Purpose** : tout ce que le bureau sait du membre et de ses parcelles, présent et passé.
- **Layout** : `breadcrumb` « Membres › Jean et Odile Dubois ». `h1` = le nom. Sous le titre, les
  badges d'état (« Courrier uniquement », « Fiche incomplète »). Colonne unique, trois `card` :
  1. **Coordonnées** (`h3`) — en lecture : paires libellé / valeur (Adresse email, Téléphone,
     Adresse postale sur plusieurs lignes). Une valeur absente s'écrit « Non renseignée ». Bouton
     `outline` « Modifier les coordonnées » → mêmes champs qu'à l'écran 2, en place.
  2. **Accès à l'espace membre** (`h3`) — **une phrase d'état, toujours écrite** :
     - « Compte ouvert. Claire Meunier peut se connecter à son espace avec
       claire.meunier@example.fr. »
     - « Joignable par courrier uniquement. Aucun compte : ajoutez une adresse email pour lui ouvrir
       son espace. »
  3. **Parcelles** (`h3`) — bouton `outline` « Rattacher une parcelle ». Deux listes :
     - **Parcelles actuelles** : `table` — **Parcelle** (`data`, `Map` 16 px + numéro) · **Propriétaire
       depuis** (`data`) · **Action** : « Enregistrer une vente ».
     - **Anciennes parcelles** (seulement s'il y en a) : **Parcelle** · **Période** (« du 03/02/1998
       au 14/06/2026 ») · **Vendue à** (nom, en `link` vers sa fiche). **Aucune action** : une
       période close ne se modifie pas — le dire en `meta` sous le titre de la liste : « Les
       périodes closes ne se modifient pas. »
- **Retirer l'adresse email** (critère 9) : en modification des coordonnées, **vider l'email**
  affiche, **avant l'enregistrement**, un `alert` ancré sous le champ (palette `warning`, filet
  2 px, `AlertTriangle`, mot « Attention » écrit) : « Sans adresse email, Paul Ferrand ne pourra
  plus se connecter à son espace. Sa fiche, ses parcelles et son historique sont conservés. Il
  recevra les envois par courrier. » L'enregistrement suffit, pas d'`alert-dialog` (l'acte est
  réversible). Après : `alert` neutre « Coordonnées enregistrées. Accès à l'espace fermé. »
- **States** : **membre avec compte et deux parcelles** (Claire Meunier) · **vendeur** (Jean et
  Odile Dubois : aucune parcelle actuelle, une ancienne) · **fiche incomplète** (Hélène Roy :
  un `alert` palette `warning` ancré en tête — pas `destructive`, rien n'a échoué : « Cette fiche n'a ni
  adresse email ni adresse postale : aucun envoi ne peut atteindre ce membre. » + lien « Ajouter une
  adresse postale ») · **en modification** · **email retiré** (avertissement ci-dessus) · **email
  ajouté** (« Coordonnées enregistrées. Compte ouvert : … peut désormais se connecter. »).
- **Mobile (390 px)** : tables en cartes empilées, boutons pleine largeur 56 px.

### 4 · Back-office — Rattacher une parcelle (`dialog`)

- **Deux champs, la limite du `dialog`** : **Numéro de parcelle** (`input` en `data`) · **Propriétaire
  depuis le** (champ date du design system : saisie `jj/mm/aaaa` au clavier, **pré-rempli à
  aujourd'hui**, icône `Calendar` décorative, pas de calendrier déroulant).
- Boutons : `default` « Rattacher la parcelle », `outline` « Annuler ».
- **States** : **vierge** · **erreurs par champ** · **chevauchement refusé** (critère 4) — `alert`
  `destructive` ancré en tête du dialog : « La parcelle 47 appartient à Paul Ferrand depuis le
  15/06/2026. Elle ne peut pas avoir deux propriétaires en même temps. **Si elle a été vendue**,
  enregistrez la vente depuis la fiche de Paul Ferrand. » + lien vers cette fiche. **Rien n'est
  enregistré.** · **parcelle inconnue** : elle est **créée** au rattachement _(hypothèse — pas
  d'écran « Parcelles » séparé ; à confirmer au plan)_, le dire après coup : « Parcelle 52 ajoutée
  et rattachée à Hélène Roy depuis le 29/09/2026. »

### 5 · Back-office — Enregistrer une vente (page `/bureau/membres/{id}/vente/{parcelle}`)

- **Pourquoi une page et non un `dialog`** : trois informations (acquéreur, date, confirmation de ce
  qui va changer), et le choix de l'acquéreur demande une recherche.
- **Layout** : `breadcrumb` « Membres › Jean et Odile Dubois › Vendre la parcelle 47 ». `h1`
  « Enregistrer la vente de la parcelle 47 ». Colonne `max-w-[68ch]` :
  1. **Date de la vente** — champ date (pré-rempli à aujourd'hui). Aide : « Le dernier jour de
     propriété des vendeurs est la veille de cette date. » _(Convention à confirmer au plan ;
     l'écrire telle quelle.)_
  2. **Acquéreur** — recherche dans les membres de l'association (`command` dans un `popover`,
     back-office seulement) : saisie du nom, résultats avec leurs parcelles en `meta`. Sous le
     champ : lien « L'acquéreur n'a pas encore de fiche ? Ajoutez-le d'abord » → écran 2, retour
     ici ensuite _(proposition ; à annoter)_.
  3. **Ce qui va changer** — un encart `muted`, **écrit**, qui suit la saisie :
     « Jean et Odile Dubois : propriétaires du 03/02/1998 au 14/06/2026. Cette période sera close
     et ne pourra plus être modifiée. · Paul Ferrand : propriétaire à partir du 15/06/2026. ·
     Les factures, relevés et documents antérieurs au 15/06/2026 restent ceux de Jean et Odile
     Dubois. »
- **Action** : `default` « Enregistrer la vente », `outline` « Annuler ». C'est un acte qui ne se
  défait pas depuis l'écran (critère 2) : **`alert-dialog`** de confirmation, bouton nommant l'acte
  « Enregistrer la vente », texte reprenant l'encart.
- **States** : **vierge** · **rempli** (encart complet) · **date antérieure au début de la
  période** : « Jean et Odile Dubois ne sont propriétaires que depuis le 03/02/1998 : la vente ne
  peut pas être antérieure. » · **acquéreur = vendeur** refusé · **chevauchement** (une période
  existe déjà après cette date) : message explicite, rien d'enregistré · **enregistrée** → retour à
  la fiche du vendeur, `alert` neutre « Vente enregistrée. La parcelle 47 est à Paul Ferrand depuis
  le 15/06/2026. » + lien vers sa fiche.
- **Mobile (390 px)** : la recherche d'acquéreur s'ouvre en `sheet` bas d'écran, cibles 56 px.

### 6 · Espace membre — Mes parcelles (`/dashboard`, section)

- **Purpose** : un membre connecté voit **ses** parcelles, et seulement les siennes.
- **Layout** : gabarit espace membre `max-w-[1000px]`, une colonne. En haut, **le marqueur unique
  de donnée personnelle** (§3.4) : `Lock` 16 px + « Espace personnel » + « Parcelles 12 et 13 ».
  `h1` « Bonjour Claire Meunier » _(ou le titre existant de l'espace — ne pas inventer de tableau
  de bord)_. Une `card` **« Mes parcelles »** (`h2`) : une ligne par parcelle actuelle, `Map` 20 px
  + « Parcelle 12 » en `data` + « Propriétaire depuis le 3 février 1998 » (date **en clair**, public
  âgé). **Pas de tableau** : deux à trois lignes se lisent sans colonnes.
  Dessous, en `meta` : « Une erreur ? Écrivez au bureau. » + lien vers la page Contact.
- **Ancien propriétaire connecté** (vendeur sans parcelle actuelle, accès non coupé) : « Vous
  n'êtes plus propriétaire d'une parcelle du domaine depuis le 15 juin 2026. » _(Les documents
  anciens viendront avec d'autres stories — ne rien dessiner de plus.)_
- **Accès refusé** (critère 10) : l'URL de la fiche d'un autre membre ne montre **rien de cet autre
  membre** — ni nom, ni parcelle. Page simple : `h1` « Cette page ne vous est pas accessible »,
  « Elle concerne un autre membre de l'association. » + bouton `default` « Revenir à mon espace ».
  **Aucun code d'erreur, aucun « 403 » à l'écran.**
- **Mobile (390 px)** : c'est un écran souvent consulté au téléphone — texte 17 px, lignes de 56 px.

## Design system constraints (non-negotiable)

**Tokens — deux thèmes, clair et sombre (ADR 012).** Le back-office et l'espace membre reprennent
les mêmes tokens ; seule la `sidebar` a sa propre palette.

**Clair** (`:root`) :

```
--background: oklch(1 0 0)                 --foreground: oklch(0.22 0.015 250)
--card: oklch(1 0 0)                       --muted: oklch(0.972 0.005 240)
--muted-foreground: oklch(0.45 0.02 245)   --border: oklch(0.9 0.008 245)
--input: oklch(0.66 0.014 245)             --ring: oklch(0.55 0.11 235)
--primary: oklch(0.35 0.06 240)            --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.965 0.006 240)        --secondary-foreground: oklch(0.3 0.02 245)
--destructive: oklch(0.48 0.17 27)         --destructive-foreground: oklch(0.99 0.01 27)
--destructive-text: oklch(0.48 0.17 27)    --link: oklch(0.45 0.13 250)
--warning: oklch(0.94 0.06 75)             --warning-border: oklch(0.6 0.13 65)
--warning-foreground: oklch(0.3 0.08 60)
--accent-hue: 195 (démo « eau » ; teinte réelle injectée par association, six teintes possibles)
--accent: oklch(0.958 0.024 195)           --accent-foreground: oklch(0.38 0.08 195)
--accent-solid: oklch(0.55 0.1 195)        --accent-border: oklch(0.88 0.045 195)
--table-stripe: oklch(0.99 0.002 250)      --table-row-hover: = --muted
--overlay: oklch(0.22 0.015 250 / 0.5)
--sidebar: oklch(0.985 0.004 250)          --sidebar-foreground: oklch(0.26 0.015 250)
--sidebar-accent: oklch(0.93 0.012 245)    --sidebar-border: oklch(0.91 0.008 245)
--radius: 0.5rem (rounded-md 8px champs/boutons/cartes, rounded-lg 12px dialogues/feuilles,
                  rounded-full badges)
```

**Sombre** (`.dark`) :

```
--background: oklch(0.215 0.009 255)       --foreground: oklch(0.94 0.006 250)
--card: oklch(0.215 0.009 255)             --muted: oklch(0.255 0.009 250)
--muted-foreground: oklch(0.72 0.015 248)  --border: oklch(0.33 0.01 250)
--input: oklch(0.52 0.016 250)             --ring: oklch(0.7 0.12 235)
--primary: oklch(0.5 0.14 255)             --primary-foreground: oklch(0.985 0.003 240)
--secondary: oklch(0.27 0.01 250)          --secondary-foreground: oklch(0.9 0.008 250)
--destructive: oklch(0.58 0.19 27)         --destructive-text: oklch(0.68 0.17 27)
--link: oklch(0.8 0.1 250)                 --warning-border: oklch(0.6 0.11 70)
--accent: oklch(0.275 0.035 195)           --accent-foreground: oklch(0.84 0.075 195)
--accent-solid: oklch(0.64 0.11 195)       --accent-border: oklch(0.4 0.055 195)
--table-stripe: oklch(0.235 0.009 255)     --table-row-hover: oklch(0.29 0.012 250)
--overlay: oklch(0.1 0.01 255 / 0.7)
--sidebar: oklch(0.19 0.009 255)           --sidebar-foreground: oklch(0.93 0.006 250)
--sidebar-accent: oklch(0.3 0.014 250)
```

Le trio `warning` sombre est validé sans retouche (texte 11,14:1, filet 3,40:1).

**Typographie** : **Source Serif 4** — `h1` 34 px / 600, `h2` 26 px / 600. **Public Sans** — `h3`
20 px / 600, `body` 17 px, `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600,
`meta` 15 px. **JetBrains Mono** — `data` : **numéros de parcelle**, codes postaux, dates en tableau
et en champ, `tabular-nums`. Texte courant **jamais sous 17 px** · libellés toujours visibles ·
**jamais de placeholder en guise de libellé, jamais d'astérisque** (« Facultatif » écrit) · dates en
clair côté membre (« 3 février 1998 »), `03/02/1998` en tableau et en champ · typographie française.

**Espacement** : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, rien d'autre. Back-office : barre latérale
248 px, tiroir sous `lg`. Espace membre : `max-w-[1000px]`, une colonne. Ruptures `sm` 640 · `md`
768 · `lg` 1024 · `xl` 1280.

**Cibles, focus, mouvement** : 44 × 44 minimum, **56 px** pour les actions principales en mobile ·
anneau `2px solid var(--ring)` décalé de 2 px, jamais `outline: none` · aucune action au survol
seul · transitions ≤ 120 ms.

**Bordures / ombres** : 1 px `border` · 1 px `input` · 2 px `primary` sélection · **2 px
`destructive` erreur**. Aucune ombre sur cartes et tableaux ; `shadow-lg` pour dialogues, popovers
et tiroirs, voile `--overlay`.

**Icônes lucide** : 16 / 20 / 24 px, trait 1,75, `currentColor`, **icône + libellé**. Vocabulaire
figé : `Map` **parcelle** · `Lock` personnel · `AlertTriangle` alerte · `UsersRound` membres du
bureau · `Inbox` messages reçus · `Droplet` · `FileText` · `Receipt` · `Megaphone` · `GripVertical`.
`CircleCheck` = succès ancré. `Calendar` décorative dans le champ date. **Aucune icône « membre »
(propriétaire) au vocabulaire** : `UsersRound` désigne les membres **du bureau** — ne pas la
réemployer (voir Écarts).

**Composants à réutiliser tels quels** :

- **`button`** : **un seul `default` par écran**, le reste en `outline` ; libellés à l'infinitif
  explicite ; chargement = libellé remplacé, **largeur conservée**. `sm` 40 px **jamais côté
  membre**.
- **`form` `input` `label`** : une colonne, libellé au-dessus, 48 px (56 mobile), validation au
  _blur_ puis à la soumission. **Champ date** : clavier seul, `jj/mm/aaaa`, pré-rempli à aujourd'hui,
  `inputmode="numeric"`, JetBrains Mono 500, pas de calendrier déroulant.
- **`table` `pagination` `badge`** : lignes 56 px, en-tête `muted` 15 px / 600, zébrure, **une seule
  action par ligne, en clair**, 25 lignes (10 cartes sous 640 px), « Précédent / Suivant » écrits.
  `badge` = statut ; deux badges sur une ligne, gap 8 px, sous le titre en carte mobile.
- **`alert`** ancré (succès **neutre** `CircleCheck` en `primary`, **pas de vert** ; erreur
  `destructive` 2 px ; avertissement palette `warning` + `AlertTriangle` + mot écrit + filet 2 px).
  **`alert-dialog`** uniquement pour l'irréversible, bouton nommant l'acte. **`dialog`** ≤ 2 champs.
- **`command` + `popover`** : back-office seulement (recherche de l'acquéreur). **`sheet`** : tiroir
  mobile. **`breadcrumb`** dès le 2ᵉ niveau du back-office. **`card`** sans ombre. **`skeleton`**
  listes seulement.
- **Marqueur de donnée personnelle (§3.4)** : `Lock` + « Espace personnel » + parcelle, en haut de
  l'écran membre ; l'écran ne contient **que** des données du membre connecté.

**Patrons imposés** : formulaire en erreur = bordure 2 px **+** message sous le champ **+** résumé
ancré avec liens d'ancrage · quatre états (vide = ce qui manque + l'action ; chargement = `skeleton` ;
erreur = ce qui s'est passé, ce qui est perdu, l'action suivante ; succès = ce qui a eu lieu et où le
vérifier) · `primary` pour les actions, accent pour l'identité seulement, **jamais sur un bouton** ·
tableau sous 640 px = cartes empilées · vouvoiement, aucun jargon (jamais « compte utilisateur »,
« identifiant », « UUID », « période de propriété » à l'écran membre).

**Do / Don't** : ✅ « Courrier uniquement » est un état normal, écrit sans alarme · ✅ le mot porte
l'information, la couleur renforce · ✅ ce qui va changer est **écrit avant** l'acte · ❌ `tabs` ou
`sidebar` côté membre · ❌ densité de tableau de bord SaaS · ❌ accent seul porteur d'un statut ·
❌ information importante dans un toast ou un tooltip · ❌ menu d'icônes en bout de ligne · ❌
sections vides « Factures », « Relevés », « Documents » en attente d'autres stories.

Ne pas inventer de composant, de token ni de couleur hors de cette liste. Un besoin non couvert se
**signale** en marge.

## Écarts connus au design system (à signaler dans la maquette, pas à combler)

1. **Aucune icône « membre / propriétaire »** : `UsersRound` est prise par les membres du bureau.
   Les écrans se lisent sans ; toute proposition est à annoter.
2. **« Membres » et « Membres du bureau »** côte à côte dans la barre latérale : risque de confusion
   pour le bureau. Proposer un libellé (« Propriétaires » ? « Membres » vs « Fiches du bureau » ?)
   **en annotation**, sans renommer l'existant.
3. **Historique daté d'une parcelle** (qui en était propriétaire, de quand à quand) : aucun composant.
   La liste « Anciennes parcelles » de l'écran 3 est une proposition, à annoter.
4. **Retours de courrier (PND)** — le design system (§9) rattache ce manque à s28 **et s12** : où le
   bureau note qu'un courrier est revenu. **Hors critères de s12** : ne pas le dessiner, le signaler
   comme restant ouvert.
5. **Recherche d'un membre dans une liste de 400** : hors critères, proposée à l'écran 1.

## Points laissés au plan — à ne pas trancher dans la maquette

- La convention de date d'une vente (dernier jour du vendeur = veille de la vente) : l'écrire telle
  quelle, le plan confirmera.
- La création implicite d'une parcelle inconnue au rattachement.
- L'ouverture d'un compte à partir d'une adresse **déjà connue** du produit (même personne
  propriétaire dans une autre association) : aucun écran différent.
- Le changement d'adresse email d'un membre qui a déjà un compte.
- Le rattachement de la fiche des membres du bureau et de la présidence (qui ont déjà un compte).

## Out of scope

- **Import de la liste des membres** (autre story), **invitation** et **lancement** (autres stories),
  **désignation des rôles du bureau** (autre story).
- **Mise à jour de ses coordonnées par le membre lui-même** (autre story) : l'espace membre ne montre
  ici **que** ses parcelles.
- **Factures, relevés d'eau, documents, consommation** : autres stories — aucune section vide.
- **Suppression d'une fiche, fusion de doublons, export, purge, coupure d'accès** : aucun critère
  (et la coupure attend un arbitrage RGPD).
- **Écran « Parcelles »** séparé (liste de toutes les parcelles, carte, cadastre) : aucun critère.
- **Indivision / plusieurs propriétaires sur une même parcelle** : non prévu par le critère 4.

## Expected output

Un mockup HTML statique des écrans 1 à 6, basse fidélité acceptée :

- en **desktop et en mobile 390 px** pour chaque écran ;
- en **clair et en sombre**, avec une bascule (ADR 012) ;
- avec **tous les états listés**, dont la parcelle vendue vue des deux fiches, le chevauchement
  refusé, la fiche incomplète, l'email retiré et l'accès refusé côté membre ;
- en utilisant **exclusivement** les tokens et composants ci-dessus ;
- une section ancrée par écran, les écarts annotés en marge.

Il sera enregistré comme `docs/designs/s12-membres-parcelles.html`.
