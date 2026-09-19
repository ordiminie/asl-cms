# Design — Story s03-connexion-lien-magique

> Conçu le 2026-09-19, chemin **Claude Design** : brief `docs/designs/s03-connexion-lien-magique-brief.md`, canevas
> `https://claude.ai/artifact/2YC4RGWqGEoxE95ejuyp27` (version 1, privé), **validé par Marie-Ève le 2026-09-19**
> (ordinateur et mobile), puis reporté ici. Source visuelle unique : `docs/design-system.md` (§5 « L'email », §7 « La
> connexion »). Contexte de code : `docs/research/s03-connexion-lien-magique.md`.

## Périmètre du design

| Critère | Ce qu'il demande                                                                  | Où                        |
| ------- | --------------------------------------------------------------------------------- | ------------------------- |
| 1       | Adresse connue → lien à usage unique + écran d'attente explicite                  | **Écran A** → **Écran B** |
| 2, 3    | Lien réutilisé ou de plus de 20 minutes → même message, bouton pour en redemander | **Écran C**               |
| 4       | Adresse inconnue → même écran, rien d'envoyé, aucun compte créé                   | **Écran B** (identique)   |
| 5       | Envoi par l'adaptateur de l'ADR 005                                               | _non dessinable_          |
| 6       | Logo de l'association en en-tête de l'email, ou son nom                           | **Planche D**             |

**Arbitrages du 2026-09-19** (Marie-Ève) :

- Lien valable **20 minutes** (et non plus 4 heures).
- **Mot de passe conservé**, au moins pour le SuperAdmin : un lien discret **« Accès prestataire »** sous la carte de
  l'écran A mène au formulaire existant. Le lien magique est le seul chemin mis en avant ; le mot de passe n'est pas
  masqué par rôle (on ne sait pas qui se connecte avant la connexion) — c'est la solution simple retenue.

## Screen(s)

**Cadre commun des écrans A, B, C** — page de l'association, **sans** barre latérale ni menu du site : en-tête
`AssociationMark` taille `public` (carré 44 px + nom) sur fond `background` avec filet `border` ; dessous, fond `muted`
et **une seule carte** centrée (440 px sur ordinateur, pleine largeur sur mobile ; intérieur 32 px, 16 px sur mobile).
Aucune autre navigation. Le groupe `(auth)` existant n'a aujourd'hui ni en-tête ni pied : l'en-tête d'identité y est
ajouté.

### Écran A — Saisie de l'adresse (§7, écran 1)

1. `h1` « Se connecter à votre espace ».
2. « Saisissez votre adresse email : vous recevrez un lien pour ouvrir votre espace. Il n'y a **aucun mot de passe** à
   retenir. »
3. **Un seul champ** « Adresse email » (`type="email"`, `autocomplete="email"`, `inputmode="email"`,
   `autocapitalize="none"`), libellé au-dessus.
4. Bouton **`default`** pleine largeur « Recevoir mon lien de connexion ».
5. Encart `muted` : « Vous n'avez pas d'adresse email ? Les documents vous sont envoyés par **courrier** — appelez le
   bureau au [téléphone du bureau]. »
6. Sous la carte, en `meta` : lien « Accès prestataire » (connexion par mot de passe existante).

### Écran B — « Consultez votre boîte mail » (§7, écrans 2 et 4)

**Strictement identique** que l'adresse soit enregistrée ou non (texte, durée d'affichage, temps de réponse).

1. Icône `Mail` 24 px en `primary`, `h1` « Consultez votre boîte mail ».
2. « **Si l'adresse {adresse} est enregistrée**, un lien de connexion vient de lui être envoyé. Il est valable
   **20 minutes** et ne sert qu'une fois. »
3. `h2` « Rien n'arrive ? » + trois étapes numérotées : patienter quelques minutes ; regarder les courriers
   indésirables ; vérifier l'adresse saisie — lien « Corriger l'adresse » (retour à A, adresse pré-remplie).
4. Les deux causes possibles, en `muted-foreground` : autre adresse enregistrée par le bureau, ou aucune adresse pour
   la parcelle (« vous recevez alors vos documents par courrier, et c'est normal »).
5. Bouton `outline` pleine largeur « Renvoyer un lien ».
6. « Besoin d'aide ? Appelez le bureau au [téléphone du bureau]. »

### Écran C — Lien expiré ou déjà utilisé (§7, écran 3)

1. Icône `Clock` 24 px en `primary`, `h1` « Ce lien ne fonctionne plus ».
2. « **Vous n'avez rien fait de mal** : il suffit d'en demander un nouveau. »
3. « Un lien de connexion ne sert qu'une fois et reste valable 20 minutes. C'est ce qui protège votre espace, même si
   quelqu'un d'autre ouvre votre boîte mail. »
4. Bouton **`default`** pleine largeur « Recevoir un nouveau lien » (→ écran A).
5. « Besoin d'aide ? Appelez le bureau au [téléphone du bureau]. »

Un seul écran pour les critères 2 et 3 : Better Auth renvoie la même erreur `INVALID_TOKEN` pour un jeton déjà
consommé ou expiré (recherche). Aucun code d'erreur à l'écran.

### Planche D — L'email de connexion (§5)

Gabarit `react-email`, 600 px, une colonne, couleurs **hexadécimales** de §5.3 (fichier unique
`src/lib/emails/theme.ts` prévu par §5.3), `Georgia, serif` (titre 24 px) et `Helvetica, Arial, sans-serif` (17 px).

- **Objet** : « {nom de l'association} — votre lien de connexion » ; **pré-en-tête** : « Valable 20 minutes, pour une
  seule connexion. Aucun mot de passe à retenir. »
- **En-tête** : fond `accent`, filet bas 3 px `accent-solid`, logo **36 px** + nom en `accent-foreground` (triplet de
  la teinte de l'association, §1.2) ; `alt` du logo = nom de l'association.
- `h1` « Votre lien de connexion » ; « Bonjour, voici le lien pour ouvrir votre espace sur le site de {nom}. Il est
  valable **20 minutes** et ne sert qu'une fois. »
- **Un seul bouton** en table « Ouvrir mon espace » (fond `#2C3F63`, `color:#ffffff !important`, 19 px), puis l'**URL en
  clair** dessous.
- « Vous n'avez pas demandé ce lien ? Ignorez cet email : personne ne peut se connecter sans lui. »
- **Pied** transactionnel (`muted`) : « Cet email vous est envoyé parce qu'une connexion a été demandée avec votre
  adresse sur le site de {nom}. » Ni actualité, ni rappel, ni désinscription.
- Variantes : **sans logo** → le nom seul (pas de monogramme en image) ; **images bloquées** → le nom reste écrit ;
  **mode sombre forcé** → corps, bouton, URL et pied lisibles, la teinte de l'en-tête peut disparaître (la planche
  simule l'inversion de la messagerie, ses gris ne sont pas une palette du produit).

## Mockup

`docs/designs/s03-connexion-lien-magique.html` — référence visuelle, 11 planches (7 ordinateur, 4 mobile), bascule
clair / sombre. **NE PAS copier en production** : l'Execute construit les écrans avec les vrais composants du socle
(`src/components/ui/*`, `AssociationMark`) et l'email avec `react-email`. Données fictives : « ASL Les Pins »,
monogramme LP, `m.durand@exemple.test`.

## Reused components (from the design system)

Aucun composant nouveau au catalogue.

- **`card`**, **`form` `label` `input`**, **`button`** (`default` pleine largeur ; `outline` pour « Renvoyer un lien » ;
  libellé remplacé en chargement, largeur conservée ; désactivé avec compte à rebours écrit), **`alert`** (erreur
  ancrée ; confirmation neutre avec `CircleCheck` en `primary`).
- **`AssociationMark`** (§2.7) — en-tête des écrans A, B, C.
- Icônes lucide (trait 1.75) : `Mail`, `Clock`, `CircleAlert`, `CircleCheck`.

## States

**Écran A**

| État                         | Forme retenue                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vide**                     | L'écran ci-dessus.                                                                                                                                                                                                                    |
| **Erreur de saisie**         | Bordure 2 px `destructive` + « Cette adresse n'est pas valide. Exemple : nom@domaine.fr » sous le champ ; validation au _blur_ puis à l'envoi.                                                                                        |
| **Chargement**               | « Envoi en cours… », désactivé, largeur conservée.                                                                                                                                                                                    |
| **Service d'email en panne** | `alert` destructive ancrée dans la carte : « Le lien n'a pas pu être envoyé. **Votre adresse n'est pas en cause.** Réessayez dans quelques minutes, ou appelez le bureau au [téléphone du bureau]. » Adresse conservée dans le champ. |
| _Succès_                     | Pas d'état propre : l'envoi mène à l'écran B.                                                                                                                                                                                         |

**Écran B**

| État                    | Forme retenue                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Juste après l'envoi** | « Renvoyer un lien (disponible dans 45 s) » désactivé **60 s**, compte à rebours écrit, annoncé sans relecture à chaque seconde.              |
| **Disponible**          | Bouton actif.                                                                                                                                 |
| **Renvoyé**             | `alert` neutre : « Un nouveau lien a été envoyé, si l'adresse est enregistrée. Le précédent ne fonctionne plus. » ; compte à rebours relancé. |

**Écran C** : un seul état.

### Accessibilité — liste de §3.8

- [x] Contour du champ en `input` (3:1) ; erreur écrite, pas seulement colorée.
- [x] Tout au clavier, focus visible ; cibles ≥ 44 px (champ et boutons 48 px, 56 px sur mobile).
- [x] Un seul `h1` par écran ; `h2` pour « Rien n'arrive ? ».
- [x] Aucun jargon ni code d'erreur ; chaque échec propose une sortie (nouveau lien, téléphone du bureau).
- [ ] Zoom 200 % : à vérifier sur l'écran construit.
- [ ] Email : à vérifier dans au moins un client en mode sombre forcé.

## Design system gaps

Besoins que le système ne couvre pas, ou sur lesquels il est contredit. **Signalés, pas inventés.**

1. **Téléphone du bureau** — présent sur les écrans A, B, C (§7 le demande), mais **aucun réglage ne le porte**. À
   trancher au plan : nouvelle clé du registre de s02 (`bureau.telephone`, facultative, type à créer « téléphone » ou
   texte) livrée par s03, ou texte masqué tant que la clé n'existe pas.
2. **Logo WebP dans l'email** — §1.8 et §5.2 veulent un **PNG** (et une variante sur pastille blanche) en messagerie ;
   s01b accepte aussi le **WebP**, mal rendu par plusieurs clients. À trancher au plan : nom seul quand le logo n'est pas
   un PNG, conversion, ou refus du WebP au téléversement (retouche de s01b).
3. **Pied de page transactionnel** — §5.4 ne connaît que les pieds « facultatif » et « statutaire » ; le lien magique
   est transactionnel. La phrase retenue ici (« Cet email vous est envoyé parce qu'une connexion a été demandée… ») est
   à reporter dans §5.4.
4. **« Erreur du service d'email »** (§9, ligne « Connexion », s03) — comblé par l'état « service d'email en panne » de
   l'écran A ; à retirer de §9.
5. **Couleurs hexadécimales de la teinte** — l'email utilise le tableau de §1.2 / §5.3, qui ne coïncide pas exactement
   avec les tokens OKLCH (recherche s02, question 7). Assumé par §5.3 (« seul endroit où une couleur est dupliquée ») ;
   à garder en tête si la teinte de l'en-tête semble différente de celle du site.

## Ce que ce design ne couvre pas

- Écrans « déjà connecté » et « déconnexion » de §7.
- Le formulaire de connexion par mot de passe (existant, seul son lien d'accès est dessiné).
- Rôles, back-office, refus d'accès (s03b) ; lien et session sur le domaine de chaque association (s03c).
- Invitations (s15, s42), campagnes (s25), budget quotidien d'envoi (s26).
