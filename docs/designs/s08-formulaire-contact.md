# Design — Story s08-formulaire-contact

> Conçu le 2026-09-23 par le chemin **Claude Design**, à partir du brief
> `docs/designs/s08-formulaire-contact-brief.md`.
>
> - **Export du canevas** : `docs/designs/s08-formulaire-contact.zip`, remis par Marie-Ève le
>   2026-09-23. **L'URL du canevas n'a pas été transmise.**
> - **Reporté ici le même jour**, puis normalisé en `docs/designs/s08-formulaire-contact.html`.
> - **Source visuelle unique** : `docs/design-system.md`.
> - **Contexte de code** : `docs/research/s08-formulaire-contact.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                          | Où                                                                                                 |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1       | Envoi valide : enregistrement, confirmation à l'écran, notification email | **Écran 1** état 4 (succès ancré) + **Écran 4** (l'email) ; la persistance se voit à l'**écran 2** |
| 2       | Envoi invalide : erreurs **par champ**, rien d'enregistré, aucun email    | **Écran 1** état 2 (les trois signaux du §3.1), en desktop et en mobile                            |
| 3       | Liste des messages en back-office, triée par date, avec le détail         | **Écran 2** (tri décroissant, pagination) → **Écran 3** (page dédiée)                              |
| 4       | Changer l'adresse de notification redirige le message suivant             | **Écran 0** (extrait Réglages, `input` email) — aucun écran nouveau ; l'effet n'est pas dessinable |
| 5       | Au-delà du seuil horaire : refus avec message explicite                   | **Écran 1** état 5 (`alert` ancré, texte conservé, bouton désactivé, `{N}` = valeur du réglage)    |
| 6       | Empreinte d'IP hachée, aucune IP en clair                                 | _non dessinable_ (mécanique, aucun écran — le brief l'avait déjà écarté)                           |
| 7       | Purge des empreintes de plus de 24 h                                      | _non dessinable_ (aucune interface : ni bouton, ni page de supervision, ni compteur)               |

## Screen(s)

### Écran 0 — Repères de continuité (déjà livrés, non redessinés)

Un **extrait de deux lignes de la page « Réglages »**, qui est générée depuis le registre de
paramètres typés (ADR 016, design system §3.1) : **adresse de notification** en `input` type email,
et **« Nombre de messages par heure et par visiteur »** en `input` numérique `data` (`font-mono`,
`tabular-nums`, 112 px) avec l'unité « messages par heure » écrite à droite. Les deux types étant
déjà couverts, **aucun écran nouveau n'est nécessaire** — c'est ce que l'extrait prouve.

La barre latérale du bureau n'est montrée qu'à l'écran 2 : **« Messages reçus » s'ajoute au groupe
« Le site », après « Navigation », sans icône**, item actif sur fond `sidebar-accent` et libellé en 600. L'ordre définitif entre les entrées ajoutées en parallèle par s05, s06, s07 et s09 se règle à
l'intégration, pas ici.

Une annotation rappelle la **limite connue, hors critères** : le menu du site ne pointe que vers des
pages du CMS, donc seul le pied de page (markdown libre) peut mener à `/contact`. L'écran
« Navigation » n'est pas modifié.

### Écran 1 — Site public : « Contacter le bureau » (`/contact`)

Gabarit public, contenu en `max-w-[68ch]` : `h1` « Contacter le bureau » (34 px, Source Serif 4), un
paragraphe d'introduction en `body-lg` 18 px / 1,65, puis le formulaire dans une `card` (bordure
1 px, sans ombre), une colonne, un champ par ligne. En-tête et pied du site sont figurés par de
simples bandeaux neutres.

**Quatre champs, dans cet ordre**, libellé au-dessus et toujours visible (16 px / 500), aide en
`meta` sous le champ, champs de 48 px (56 px en mobile), texte 18 px :

1. **Votre nom** — libellé suivi de « Facultatif » **écrit en clair**, jamais d'astérisque ;
2. **Votre adresse email** — `type="email"`, `autocomplete="email"`, `inputmode="email"`, sans
   majuscule automatique ;
3. **Objet** — `input` de **texte libre**, jamais une liste déroulante (voir « Arbitrage tenu ») ;
4. **Votre message** — `textarea` de 8 lignes, redimensionnable verticalement.

Un **seul** bouton `default`, « Envoyer le message » (48 px, 232 px de large ; pleine largeur 56 px
en mobile). Aucun second bouton, pas de « Réinitialiser ».

Les cinq états demandés sont dessinés :

1. **Vierge** — formulaire vide, dans le cadre complet de la page publique.
2. **Erreurs par champ** — l'état central du critère 2, **en desktop et en mobile 390 px**. Les
   trois signaux du §3.1 sont présents ensemble : un `alert` `destructive` ancré en tête de
   formulaire (`role="alert"`, `tabindex="-1"`, `AlertTriangle` 20 px, titre « Le message n'a pas
   été envoyé. », **liste de liens d'ancrage** vers chaque champ fautif, phrase « Votre texte est
   conservé. ») ; une **bordure `destructive` de 2 px** sur les champs fautifs ; un message sous
   chaque champ fautif. Le champ **Objet**, valide, garde sa bordure 1 px `input` — le contraste se
   voit.
3. **Envoi en cours** — bouton désactivé, libellé remplacé par « Envoi en cours… », **largeur
   conservée** (232 px), champs lisibles, aucun `skeleton`.
4. **Succès** — le formulaire est remplacé par un `alert` **neutre** ancré (`role="status"`,
   `CircleCheck` 20 px en `primary`, fond `card`, bordure `border`) : « Message envoyé. Le bureau de
   l'association l'a reçu et vous répondra à l'adresse claire.meunier@example.fr. » Dessous, un
   bouton `outline` « Écrire un autre message ». **Ni vert, ni fond coloré, ni toast.** Une
   annotation rappelle que **le même écran s'affiche si la notification au bureau n'est pas partie**.
5. **Refus au-delà du seuil** — `alert` `destructive` ancré en tête de formulaire, **le texte saisi
   reste à l'écran**, bouton d'envoi désactivé. Le seuil est écrit comme une **valeur variable**
   (« 3 », souligné en pointillé et annoté « valeur du réglage »), jamais comme une constante.
   **Aucun captcha, aucune case, aucune énigme.**

### Écran 2 — Bureau : « Messages reçus » (`/bureau/messages`)

`h1` « Messages reçus », ligne `meta` « 2 messages non lus », **aucun bouton `default`** (le bureau
ne crée pas de message). Un `table` dans une `card` pleine largeur, **trié par date décroissante**,
cinq colonnes :

- **Objet** — colonne d'identité, en 600 pour une ligne non lue ;
- **De** — le nom s'il est renseigné, l'adresse en seconde ligne en `meta` ; sans nom, l'adresse
  seule tient lieu d'expéditeur ;
- **Reçu le** — `02/09/2026` en `data` (`font-mono`, `tabular-nums`) ;
- **État** — `badge` à **point + libellé écrit** (« Non lu » / « Lu »), jamais la couleur seule. Sur
  la ligne concernée, un **second `badge`** dessous : `AlertTriangle` 16 px + « Notification non
  envoyée » ;
- **Action** — une seule, en clair : « Ouvrir le message ». Pas de menu d'icônes.

Pagination sous le tableau : « Précédent » / « Page 1 sur 2 » / « Suivant », écrits, 25 lignes par
page, jamais de défilement infini. Ni recherche, ni filtre, ni tri par colonne, ni sélection
multiple.

États : **succès** (les 4 messages d'exemple, les deux états de lecture et le badge de notification
non envoyée), **vide** (« Aucun message pour l'instant. Les messages envoyés depuis la page Contact
du site apparaissent ici. » + lien « Voir la page Contact du site »), **chargement** (`skeleton` sur
les lignes, en-tête de tableau déjà en place). Aucun état d'erreur.

**Mobile 390 px** : patron « tableau → cartes empilées ». Objet en titre, puis De · Reçu le · État
en paires libellé / valeur **dans l'ordre des colonnes**, « Ouvrir le message » en pleine largeur
56 px, 10 cartes par page, barre latérale en tiroir via « Menu ». Les deux badges tiennent empilés
dans la paire « État ».

### Écran 3 — Bureau : détail d'un message (`/bureau/messages/{id}`)

Colonne unique en `max-w-[68ch]` : « ← Messages reçus », `h1` = **l'objet du message** (34 px), une
ligne `meta` « Reçu le 2 septembre 2026 à 14 h 32 », un bloc **expéditeur** entre deux filets
(« De : Claire Meunier » en `body-strong`, puis l'adresse en lien `mailto:`), enfin le **message en
17 px avec les retours à la ligne conservés**, sans troncature ni « lire la suite ».

Une seule action, en `outline` : « Marquer comme non lu », suivie de la ligne `meta` « Marqué comme
lu à l'ouverture. » **Pas de suppression, pas d'archivage.**

Trois planches : **message lu, nom renseigné, long** (15 lignes, pour vérifier la longueur de ligne)
en desktop ; **notification non envoyée + expéditeur sans nom** en desktop et en mobile 390 px. Dans
ce dernier cas, un `alert` `destructive` est ancré **au-dessus de l'expéditeur** : « Ce message est
bien enregistré, mais l'email d'avertissement au bureau n'est pas parti. **Rien n'est perdu** : le
message est là, et l'adresse de notification se vérifie dans Réglages. » + lien « Ouvrir les
Réglages ». C'est l'erreur du design system dans sa forme complète : ce qui s'est passé, ce qui est
perdu (rien), l'action suivante.

### Écran 4 — Email : notification d'un message au bureau

Objet « Les Amis de l'Étang — Nouveau message depuis le site » (**53 caractères**, préfixé du nom de
l'association) et pré-en-tête « Claire Meunier écrit au sujet de l'analyse d'eau du forage. », tous
deux écrits en clair au-dessus des rendus.

Structure, en tables imbriquées et styles en ligne, 600 px, une colonne, `Georgia, serif` pour les
titres et `Helvetica, Arial, sans-serif` pour le texte, corps 17 px / 1,6, titre 24 px :

1. **En-tête** — monogramme 36 px (figurant le logo PNG) + nom de l'association, fond `accent`
   `#E8F5F8`, filet `accent-solid` `#17849B` ;
2. **Titre** « Nouveau message depuis le site » ;
3. **Table de deux colonnes** (libellé `#52565E` / valeur `#1B1E26`) : De · Adresse email · Objet ·
   Reçu le. **L'adresse email du visiteur y est écrite en clair** et cliquable en `mailto:` ;
4. **Le message** dans un encart `muted` `#F6F7F8` bordé `#DFE1E5`, retours à la ligne conservés ;
5. **Un bouton en table** (48 px, fond `#2C3F63`) « Ouvrir le message dans le back-office »,
   **doublé de l'URL en clair juste dessous** en `#2B57A8` ;
6. **Pied de page** `muted` / `muted-foreground` qui dit **pourquoi l'email arrive**, sans lien de
   désinscription.

Quatre rendus : **600 px et 390 px en clair**, puis **600 px et 390 px en mode sombre forcé**
(simulation Outlook / Gmail Android). En sombre restent lisibles le corps, le libellé du bouton,
l'URL en clair et le pied ; sont sacrifiés le fond de l'en-tête et le filet teinté. Une **version
texte brut** complète accompagne les rendus, avec l'URL en clair et sans art ASCII.

## Mockup

`docs/designs/s08-formulaire-contact.html` est la **référence visuelle**, normalisée depuis l'export
Claude Design :

- **Retiré** : le runtime du canevas (script de support, élément racine du canevas, gabarits `{{ }}`,
  boucles et conditions de rendu), ainsi que le script de logique du composant.
- **Remplacé** : les listes par leurs données fictives (4 messages, 2 largeurs d'email, 4 lignes de
  `skeleton`), la bascule clair / sombre par du JS natif (`data-theme` sur `#root`, comme s05), les
  attributs React (`defaultValue`, `readOnly`, `style-hover`) par leurs équivalents HTML.
- **Conservé** : le lien Google Fonts (seule ressource distante), les icônes lucide, déjà en SVG en
  ligne dans l'export.
- **Vérifié avec jsdom** : cinq sections ancrées (`#ecran-0` à `#ecran-4`), la bascule change bien de
  thème dans les deux sens, aucun script distant, aucun gabarit résiduel. Le rendu dans un vrai
  navigateur n'a pas été vérifié (pas de Chromium utilisable dans le conteneur).

**NE PAS copier en production** : l'Execute construit les écrans avec les vrais composants du socle
(`form`, `label`, `input`, `textarea`, `button`, `alert`, `table`, `badge`, `pagination`, `skeleton`,
`sheet`, `sidebar`) et le gabarit email sur le patron de `MagicLinkMail` + `src/lib/emails/theme.ts`.
La maquette a ses propres styles en ligne (largeur de bouton figée à 232 px, hauteurs de badge,
rayons de l'email à 4 px, couleurs de point de statut) : ils ne remplacent ni les tokens ni les
tailles du design system.

**Données fictives** : association « Les Amis de l'Étang », teinte « eau » (195), et les quatre
messages du brief (Claire Meunier / analyse d'eau ; M. Dubois sans nom / vente de parcelle, avec
notification non envoyée ; Paul Ferrand / branche cassée, lu ; Hélène Roy / compte rendu d'AG, lu).

## Reused components (from the design system)

- **`form`, `label`, `input`, `textarea`** : une colonne, un champ par ligne, libellé au-dessus,
  « Facultatif » écrit, 48 px (56 px en mobile).
- **`button`** : un seul `default` sur tout le produit ici (« Envoyer le message ») ; « Écrire un
  autre message » et « Marquer comme non lu » en `outline`. Chargement : libellé remplacé, bouton
  désactivé, largeur conservée.
- **`alert`** : erreur **et** succès **ancrés dans la page** — résumé d'erreurs, refus au-delà du
  seuil, succès neutre, notification non envoyée. Rien d'important dans un toast.
- **`table`, `badge`, `pagination`** : liste du bureau, et « tableau → cartes empilées » sous 640 px.
  `badge` = statut, jamais une action.
- **`skeleton`** : lignes du tableau seulement, **jamais le formulaire**.
- **`card`** : bordure 1 px, sans ombre. **`sheet`** : tiroir mobile du bureau. **`sidebar`** : item
  « Messages reçus » actif.
- **Icônes** : `AlertTriangle` (résumé d'erreurs, refus, badge et alerte de notification non
  envoyée) et `CircleCheck` (succès ancré) — **les deux seules du produit ici**, toutes deux au
  vocabulaire figé §1.7. Aucune icône « message » n'est inventée, y compris dans la barre latérale.
- **Email** : couleurs hexadécimales de `src/lib/emails/theme.ts` (`EMAIL_COLORS` + `getEmailAccent(195)`),
  polices de repli, bouton en table doublé de l'URL, pied qui dit pourquoi l'email arrive.

## States

**Écran 1** : vierge · erreurs par champ (desktop **et** mobile) · envoi en cours · succès · refus au
seuil. Le succès sert aussi au cas « notification non partie » — c'est explicitement le même écran.

**Écran 2** : succès (4 messages, deux états de lecture, badge de notification non envoyée) · vide ·
chargement · mobile en cartes empilées. Aucun état d'erreur.

**Écran 3** : message lu avec nom et texte long · notification non envoyée avec expéditeur sans nom
(desktop et mobile). Pas d'état de chargement ni d'erreur : rendu côté serveur.

**Écran 4** : clair 600 px · clair 390 px · sombre forcé 600 px · sombre forcé 390 px · version texte
brut.

## Arbitrage tenu — l'objet reste un champ de texte libre

**L'objet du message est un `input` de texte libre.** La liste d'objets administrable a été
envisagée puis **écartée par arbitrage** avant le brief : la maquette ne comporte **aucun `select`,
aucune liste déroulante, aucun écran d'administration des objets** (vérifié : zéro `<select>` dans le
fichier).

La note de la story interdit de ramener ici le modèle du formulaire « Questions au bureau » de
l'espace membre (**s22**), routé par catégorie et réservé aux membres identifiés : autre story, autre
modèle, à ne pas fusionner ni imiter. La **catégorisation et le routage par sujet sont la machinerie
de s10**, pas de s08. Ce point ne se rouvre pas au plan.

## Écarts constatés entre la maquette et le brief

Ils sont écrits tels quels, sans lissage. Aucun n'est à reproduire en l'état.

1. **Écran 1 : un seul état est fourni en mobile.** Le brief demandait desktop **et** mobile 390 px
   pour tous les états des écrans 1 à 3 ; seule la planche « erreurs par champ » existe en 390 px.
   **Vierge, envoi en cours, succès et refus au seuil n'ont pas de version mobile.** Le mobile de ces
   états est implicite : même formulaire, gouttière 18 px, champs 56 px, bouton pleine largeur 56 px,
   `alert` toujours en tête de formulaire.
2. **États 3 et 4 recadrés sur le formulaire**, sans le cadre de la page publique (en-tête, pied).
   Lisible, mais la position du succès dans la page n'est pas montrée : le `h1` est conservé,
   l'`alert` prend la place du formulaire.
3. **Le résumé d'erreurs porte une bordure de 1 px, pas 2 px.** §3.1 n'impose les 2 px `destructive`
   que sur le **champ** — les champs les ont bien. L'`alert`, lui, n'a pas de spécification
   d'épaisseur : à fixer une fois pour toutes en versant la forme au design system (gap 1).
4. **Ordre erreur / aide inversé par rapport aux vrais composants.** Sous le champ email fautif, la
   maquette écrit d'abord le message d'erreur, puis l'aide. Le socle rend `FormDescription` avant
   `FormMessage`. À l'Execute, c'est l'ordre du composant qui l'emporte, sauf décision contraire.
5. **`tabindex="-1"` seulement sur la planche desktop** du résumé d'erreurs. La cible de focus après
   soumission doit exister dans les deux versions.
6. **Le souligné pointillé sous le « 3 » du refus est un marqueur de maquette**, pas de l'interface :
   il figure « valeur du réglage ». À ne pas porter à l'écran.
7. **Pagination incohérente entre les deux planches de l'écran 2** : « Page 1 sur 2 » en desktop
   (avec 4 lignes affichées) et « Page 1 sur 1 » avec les deux boutons désactivés en mobile. Le
   desktop illustre le composant, il ne décrit pas l'état réel du jeu de données.
8. **`aria-sort="descending"` sur l'en-tête « Reçu le »** alors que le tri par colonne est
   explicitement hors périmètre : cet attribut annonce une colonne triable. À retirer à l'Execute —
   le tri est fixe, il n'est pas une commande.
9. **Le libellé du bouton de l'email est en `#FDFDFE`** (jumelle de `primary-foreground`), repris du
   brief. Le design system §5.2 et `theme.ts` prévoient pour ce cas précis
   `EMAIL_COLORS.buttonForeground = '#FFFFFF'`, **forcé** (`color:#ffffff !important`), justement
   pour survivre au mode sombre imposé. C'est `theme.ts` qui fait foi.
10. **L'écart 4 du brief est plus étroit qu'annoncé.** Le brief présente le pied « qui dit pourquoi
    l'email arrive » comme un **troisième cas** à créer, §5.4 n'en prévoyant que deux. Or §5.4 nomme
    déjà un troisième cas — **le transactionnel** (lien de connexion, s03) — avec exactement cette
    forme et cette phrase d'ouverture. Ce que la maquette propose n'est donc pas une forme nouvelle
    mais une **quatrième nature d'envoi** (notification interne, non sollicitée par son destinataire)
    qui **réutilise telle quelle** la forme du pied transactionnel. Le gap à verser au design system
    est la nature, pas le gabarit (gap 3).
11. **L'écart 5 du brief est résolu par empilement, pas « sur une même ligne ».** Les deux `badge`
    (« Non lu » et « Notification non envoyée ») sont empilés verticalement dans la cellule « État »,
    en desktop comme en carte mobile. Conséquence à assumer : **cette ligne dépasse la hauteur de
    56 px** du §3.5 (deux badges de 28 px + espacement + rembourrage ≈ 88 px). La proposition reste à
    trancher (gap 2).
12. **La maquette introduit un token qui n'existe pas** : `--zebra`, avec une valeur sombre
    provisoire `oklch(0.235 0.009 255)`. Le design system ne donne la zébrure qu'en clair
    (`oklch(0.99 0.002 250)`). La maquette l'annote elle-même « à trancher » — c'est un gap, pas une
    licence (gap 4).
13. **Les couleurs du rendu « sombre forcé » de l'email sont hors `theme.ts`** (neuf valeurs :
    `#1D2027`, `#262A31`, `#3A3F48`, `#E9EBEF`, `#B3B8C2`, `#2E6F7D`, `#B9DDE4`, `#9DB8F0`,
    `#5A6E96`). La maquette les présente à juste titre comme **imposées par le client de messagerie,
    simulées pour vérifier la lisibilité** — elles ne sont pas à écrire dans le gabarit. Le gabarit
    ne pose que les couleurs claires de `theme.ts` et le `!important` du libellé de bouton (gap 5).
14. **Rien n'est dessiné pour l'état d'erreur de l'écran 2**, conformément au brief. Si le chargement
    de la liste échoue, l'écran retombe sur le patron générique d'erreur du design system — aucune
    forme spécifique n'a été validée ici.

Ce que la maquette tient, en revanche, conformément au brief : la **correction** de la carte de
succès verte de l'écran existant (`alert` neutre, `CircleCheck` en `primary`, aucun vert nulle part
dans le fichier hors citation du code actuel dans une annotation) ; l'**absence totale d'icône
« message »** ; l'**absence de captcha** ; la **page dédiée** plutôt qu'un `dialog` pour le détail ;
l'**adresse du visiteur en clair** dans le corps de l'email.

## Design system gaps

Aucun n'est comblé ici. Tous sont annotés en marge de la maquette.

> **Mise à jour du 23/09/2026.** Cinq des six manques ci-dessous ont été portés sur le canevas des
> manques (brief `docs/designs/design-system-gaps-brief.md`, planches
> `docs/designs/design-system-gaps.html` — P1, P4a, P4b, P9, P11) et **tranchés**. Les règles sont
> écrites dans `docs/design-system.md` — §1.7 (icônes), §1.9 (tokens), §3.9 (formes), §5.2 (email en
> mode sombre forcé). La numérotation d'origine est conservée : le plan s'y réfère.

1. **Forme du résumé d'erreurs ancré — ✅ tranchée (§3.9, planche P4a).** La proposition de la maquette
   est retenue, et les deux points qu'elle laissait en suspens sont fixés : `alert` `destructive`,
   **bordure 2 px**, `role="alert"`, **cible de focus à la soumission**, `AlertTriangle` 20 px,
   **titre en 700**, puis la **liste des liens d'ancrage** vers chaque champ fautif. 2 px est désormais
   l'**épaisseur unique de « quelque chose ne va pas »** dans le produit : `alert`, champ fautif, filet
   du bandeau d'alerte (s07). Le **message sous un champ** est en **16 px / 500**, couleur
   **`--destructive-text`** — pas `--destructive`, qui reste la couleur des bordures et des fonds.
2. **Deux `badge` de statut sur une même entité — ✅ tranché (§3.9, planche P4b) : une seule ligne.**
   Les deux badges tiennent **sur une même ligne**, `gap` **8 px**, **retour à la ligne permis**, et la
   **ligne de tableau reste à 56 px**. En carte mobile, les badges passent **sous le titre**. **La
   variante empilée est écartée** : 88 px de hauteur pour la même information. Conséquence pour s08 :
   « Non lu » **et** « Notification non envoyée » restent tous deux **dans la liste**, il n'y a pas à
   renvoyer l'échec de notification à la seule page de détail.
3. **Une quatrième nature d'envoi : la notification interne au bureau.** §5.4 couvre facultatif,
   statutaire et transactionnel ; §5.5 maquette sept envois, aucun de cette nature. Celui-ci n'est
   demandé par personne mais adressé à une adresse de fonction. Le pied proposé reprend la forme
   transactionnelle (« pourquoi cet email arrive », sans désinscription) ; c'est **la nature** qui
   est à ajouter au design system, pas un gabarit nouveau.
4. **Zébrure de tableau en mode sombre — ✅ tranchée (§1.9, planche P1) : la valeur proposée par s08
   est validée.** `--table-stripe` vaut `oklch(0.99 0.002 250)` en clair et **`oklch(0.235 0.009 255)`
   en sombre**. La planche a fait apparaître un **second** manque, comblé dans le même mouvement : le
   **survol** d'une ligne, qui se confondait avec la zébrure en sombre. `--table-row-hover` vaut
   **`= --muted`** en clair et **`oklch(0.29 0.012 250)`** en sombre. Ce n'est plus une décision
   locale ; et comme s08 est la **première story à poser un tableau de bureau après cette décision**,
   c'est elle qui fait entrer les deux tokens dans le code (voir ci-dessous).
5. **Jumelles sombres des couleurs d'email — ✅ tranchées (§5.2, planche P9) : sept valeurs.** Le
   constat de s08 était juste — tant qu'on subit l'inversion du client, le rendu est hors de contrôle,
   et un fond forcé en sombre sous un bouton `#193E57` tombe à ≈ 1,6:1. La réponse est de **reprendre
   la main**, par `@media (prefers-color-scheme: dark)` **et** `[data-ogsc]` (Outlook) :

   | Clé          | Clair     | Sombre    | Contraste sombre         |
   | ------------ | --------- | --------- | ------------------------ |
   | `background` | `#FFFFFF` | `#171A1E` | —                        |
   | `text`       | `#151B21` | `#E8EBEF` | 14,69:1                  |
   | `textMuted`  | `#4C5760` | `#9DA6AE` | 7,07:1                   |
   | `rule`       | `#DFE1E5` | `#32363A` | —                        |
   | `buttonBg`   | `#193E57` | `#2063B0` | —                        |
   | `buttonText` | `#FFFFFF` | `#FFFFFF` | 6,05:1 — **blanc forcé** |
   | `link`       | `#00579A` | `#8CC3FC` | 9,43:1                   |

   Elles vivent dans **`src/lib/emails/theme.ts`**, jamais retapées dans un gabarit, et le bouton reste
   **toujours doublé de l'URL en clair** — c'est ce qui sauve l'envoi quand le client réécrit les
   couleurs malgré tout. L'email de notification de l'écran 4 est le premier envoi concerné : **s08 les
   porte dans le code**.

6. **Icône « message reçu » — ✅ tranchée (§1.7, planche P11) : `Inbox`.** Le vocabulaire figé n'en
   désignait aucune ; il en porte désormais deux de plus, `Inbox` (« messages reçus », s08) et
   `UsersRound` (« membres du bureau », s06). **`Inbox` plutôt que `Mail`**, qui se confondrait avec les
   emails **envoyés**, et **plutôt que `MessageSquare`**, qui évoque une messagerie instantanée.
   L'entrée « Messages reçus » de la barre latérale la prend, à 20 px, en `currentColor` ; `Mail` et
   `Send`, employés hors vocabulaire par l'écran hérité, sortent.

**Reste ouvert** : le manque n° 3 (quatrième nature d'envoi). C'est une **règle écrite, pas une
planche** — le brief du canevas l'avait explicitement mis hors périmètre. La nature « notification
interne au bureau » reste donc à ajouter à §5.4, avec le pied de forme transactionnelle que la
maquette propose.

### Tâches de code héritées du design system

`docs/design-system.md` §1.9 le dit explicitement : **ces valeurs ne sont pas encore dans le code**, et
chaque token entre avec la story qui le consomme en premier. Un token écrit dans un document n'entre
jamais tout seul dans une feuille de style. s08 en porte trois lots.

- **`--destructive-text` dans `src/app/globals.css`** — clair **`oklch(0.48 0.17 27)`**, sombre
  **`oklch(0.68 0.17 27)`** — et **l'employer pour le texte d'erreur** : titre du résumé ancré et
  message sous un champ fautif (16 px / 500). `--destructive` reste la couleur des **bordures** et des
  **fonds**. En clair les deux valeurs coïncident ; en sombre, `--destructive` ne fait que 3,72:1 en
  texte, ce qui est la raison d'être du token.
- **`--table-stripe` en sombre** (`oklch(0.235 0.009 255)`) et **`--table-row-hover`** (clair
  `= --muted`, sombre `oklch(0.29 0.012 250)`), parce que s08 est la **première story à poser un
  tableau de bureau** après cette décision. Les deux tokens servent **tous** les tableaux du bureau,
  pas seulement « Messages reçus » : les poser ici, c'est les poser pour les suivants.
- **Les sept jumelles sombres de §5.2 dans `src/lib/emails/theme.ts`**, servies par
  `@media (prefers-color-scheme: dark)` **et** `[data-ogsc]`, pour l'email de notification de
  l'écran 4. Aucune couleur n'est écrite dans le gabarit : `theme.ts` est le seul endroit du produit où
  une couleur est dupliquée, et c'est assumé.

## Hypothèses de conception à confirmer au plan

- **Détail en page dédiée, pas en `dialog`** (`/bureau/messages/{id}`) : un message peut être long et
  le `dialog` du design system est réservé aux formulaires de deux champs au plus ; une page se lit,
  s'imprime et se partage par URL. Décision de conception, à confirmer.
- **Marqué lu à l'ouverture**, avec « Marquer comme non lu » en `outline` et la ligne `meta` qui le
  dit. Le `read` existe déjà dans la persistance héritée ; ni archivage ni suppression ne sont
  dessinés (réponse partielle à la question ouverte 11 de la recherche).
- **`mailto:` sur l'adresse du visiteur** (liste, détail et email) comme chemin de réponse : le
  produit ne rédige aucune réponse. C'est aussi ce qui rend l'email fonctionnel **quelle que soit**
  la décision sur `replyTo` dans le contrat `EmailTransport` (question ouverte 8) : l'adresse est en
  clair dans le corps.
- **État « notification non envoyée » visible côté bureau** (badge dans la liste, `alert` avec lien
  vers les Réglages sur le détail) alors que le visiteur voit un succès ordinaire. Cela suppose que
  l'échec d'envoi soit **persisté** avec le message — à trancher au plan (question ouverte 9 de la
  recherche : le stockage de cet indicateur n'est décidé nulle part).
- **Seuil et adresse de notification entièrement en paramètres d'association** (ADR 010) : la
  maquette n'affiche aucun chiffre en dur et annote « 3 » comme valeur de réglage. La clé, son défaut
  et ses bornes restent à fixer au plan (question ouverte 5).
- **Empty state de l'écran 2** : « Voir la page Contact du site » comme seule action, parce que le
  bureau ne peut pas créer de message. Proposition annotée, à confirmer.
- **Le nom du visiteur est un champ facultatif nouveau** ; « Objet » reste obligatoire comme
  aujourd'hui en base. La question ouverte 6 de la recherche (garder `subject` ? longueur minimale du
  message ?) n'est pas tranchée par la maquette : elle montre seulement « Écrivez votre message avant
  de l'envoyer. » pour un message vide.

## Ce que ce design ne couvre pas

- **Sélecteur d'objets, catégories, routage par sujet, administration des objets** : écartés par
  arbitrage (voir plus haut). La catégorisation est la machinerie de s10, le formulaire routé de s22.
- **Archivage, suppression, recherche, filtres, tri par colonne, sélection multiple**, réponse
  rédigée depuis le produit, accusé de réception au visiteur : hors critères.
- **Mention RGPD ou case de consentement** sous le formulaire : aucune durée de conservation des
  messages n'est fixée à ce jour, donc rien à afficher. À rouvrir quand la rétention sera décidée.
- **Écrans de supervision de la limitation** (compteurs, empreintes, journal des refus) et **purge
  des empreintes** : aucune interface, ni bouton, ni page.
- **La page « Réglages » complète** : générée depuis le registre, seul un extrait de deux lignes est
  fourni.
- **La page SuperAdmin `/admin/submissions`** et le bouton de retour rapide hérités du boilerplate :
  ils existent, ils ne sont pas redessinés. Leur sort (conservation, filtrage) est une question du
  plan, pas du design.
- **L'en-tête, le pied et le menu du site public, la barre latérale du bureau, la page 404** : déjà
  livrés.
- **Un lien vers `/contact` ailleurs que dans le pied de page écrit à la main** : le menu du site ne
  peut pointer que vers des pages du CMS. Limite connue, hors critères — signalée en marge de la
  maquette, non comblée.
