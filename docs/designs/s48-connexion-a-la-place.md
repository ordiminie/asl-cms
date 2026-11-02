# Design — Story s48-connexion-a-la-place

> Conçu le 2026-11-02, chemin **Claude Design** : brief `docs/designs/s48-connexion-a-la-place-brief.md`,
> livraison remise par Marie-Ève le 2026-11-02 (export `s48.zip`, fichier
> `S48 Connexion a la place.dc.html`) et prise comme validée. Canevas :
> `https://claude.ai/design/p/6178d9d4-beca-40e3-93c2-fb4c8fa048b6?file=S48+Connexion+a+la+place.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s48-connexion-a-la-place.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Screen(s)

Cinq écrans, en **bureau (1 280 px) et mobile (390 px)**. Données fictives : association « Rives
Vertes » (monogramme « RV », teinte 195), compte visé « Claire Montel », Présidente.

| Écran | Route                                        | Planches             |
| ----- | -------------------------------------------- | -------------------- |
| 1     | `/admin/organizations/[id]/edit` (existante) | 1a, 1b, 1c à 1h      |
| 2     | boîte de confirmation (`dialog`)             | 2a à 2f, 2g à 2i     |
| 3     | bannière, sur toutes les pages               | 3a à 3c, 3d, 3e à 3g |
| 4     | sortie et fin de session                     | 4a, 4b, 4c, 4d       |
| 5     | `/account` (existante)                       | 5a, 5b               |

### Écran 1 — Tableau des membres (point d'entrée)

Carte « Membres » du back-office SuperAdmin : colonnes avatar · nom · email · rôle · date · action.
Chaque ligne avec compte porte un bouton `outline` **« Agir à sa place »** (icône `UserRoundCog` 20 px

- libellé, 44 px) et, à sa suite, « Retirer » en texte `destructive`. Lignes **sans bouton** :
  `super_admin` (« Compte SuperAdmin : impossible ») et invitation en attente (« Pas encore de
  compte »). Mobile : cartes empilées, « Agir à sa place » 56 px pleine largeur, « Retirer » 44 px,
  10 cartes par page. États : chargement (`skeleton`), vide (« Aucun membre avec un compte pour
  l'instant. »), erreur (`alert` `destructive` + « Recharger la liste »).

### Écran 2 — Confirmer l'ouverture

`dialog` : titre « Agir à la place de {nom} ? », phrase d'attribution (« Vous verrez et ferez
exactement ce que {nom} voit et fait ({rôle}, {association}). Vos actions seront enregistrées à votre
nom, avec la mention « pour le compte de {nom} ». »), durée écrite, champ **Motif** facultatif,
« Annuler » (`outline`) et bouton principal `default`. Variante **autre domaine** (2b, 2h) : un
encart `muted` dit l'adresse du site à ouvrir et le bouton devient « Ouvrir le site de {association} »
(c'est un lien). Mobile : ancré en bas, boutons 56 px empilés, principal d'abord, pas de croix. Erreurs
dans la boîte : compte suspendu, compte SuperAdmin, session SuperAdmin expirée.

### Écran 3 — La bannière « à la place de »

`<ImpersonationBar />` rayée magenta, `sticky top-0`, z-index 60, **au-dessus** du bandeau d'alerte
de l'association. Montrée sur le site public (3a), l'espace membre (3b) et le bureau (3c). Bureau :
icône + « Vous agissez à la place de {nom} », détail « {rôle} · {association} · fin de la session à
{hh:mm} », bouton plein blanc « Revenir à mon compte ». Deux dernières minutes (3d) : la ligne de
détail devient « La session se termine dans 1 min 45 s » (`aria-live="polite"`). Mobile (3e à 3g) :
texte sur deux lignes puis bouton pleine largeur 56 px, **sans icône**.

### Écran 4 — Sortie et fin de session

Sortie explicite (4a bureau, 4b mobile) : retour au tableau des membres avec un `alert` neutre
`CircleCheck` « Vous êtes revenu à votre compte SuperAdmin. » (`role="status"`). Expiration (4c, 4d) :
page de connexion prestataire avec un `alert` neutre `Clock` « La session à la place de {nom} s'est
terminée. Reconnectez-vous pour continuer. »

### Écran 5 — Mon compte pendant la session

Page `/account`, bannière en tête. « Nom et coordonnées » reste éditable. Les trois sections
**Mot de passe**, **Adresse email**, **Double vérification à la connexion** sont remplacées chacune
par une note `muted` avec `Lock` : « Indisponible pendant que vous agissez à la place de {nom}.
Revenez à votre compte pour y accéder. » et le bouton `outline` « Revenir à mon compte » (48 px
bureau, 56 px mobile).

## Mockup

`docs/designs/s48-connexion-a-la-place.html` — visuel de référence. **Ne pas copier en production** :
Execute construit avec les vrais composants.

Ce fichier est **figé en HTML statique** (comme s16) : le canevas a été rendu dans jsdom, puis son DOM
enregistré sans script. Il s'ouvre dans n'importe quel navigateur, sans réseau ni moteur de rendu ; seule la
police Google Fonts se charge en ligne, avec repli sur les polices système. Le moteur du canevas
(`s48-support.js`) n'est pas versionné : il reste dans `s48.zip`, non commité.

## Reused components (from the design system)

- `<ImpersonationBar />` (§2.6) — bannière des écrans 3 et 5 ; entrée et sortie annoncées en
  `aria-live="assertive"`, jamais refermable, bouton plein blanc.
- `<AlertBanner />` (§2.3) — montré sous la barre magenta pour prouver l'empilement.
- `table` + cartes empilées sous 640 px (§3.5) — écran 1 ; `badge` pour le rôle.
- `dialog` ancré en bas sous 640 px (§3.11) — écran 2.
- `alert` neutre (succès, expiration) et `destructive` (erreurs) ; `skeleton` du tableau.
- `button` `default` / `outline` ; `input` et `label` (champ « Motif »).
- Icônes lucide : `UserRoundCog`, `LogOut`, `CircleCheck`, `CircleAlert`, `Clock`, `Lock`, `Menu`.
- `breadcrumb` (écran 1), `<AssociationMark />` (écrans 3 et 5).

## States

- **Tableau** : chargement, vide, erreur (1c à 1h) ; succès sans objet (l'action ouvre la boîte).
- **Boîte** : défaut, autre domaine, envoi (« Ouverture… », largeur conservée, opacité 0,6), trois
  erreurs (2d à 2f).
- **Bannière** : normale, compte à rebours (2 dernières minutes), mobile.
- **Sortie** : succès (retour au tableau), expiration (connexion prestataire).
- **Compte** : sections sensibles verrouillées.

## Décisions de design à reporter dans le plan

- **Motif facultatif** : gardé dans la boîte (question 14 de la recherche). S'il est saisi, il va dans
  la trace d'ouverture ; sinon la colonne reste vide.
- **Durée affichée** : 30 minutes dans la maquette, valeur fictive. La durée réelle est le paramètre
  de plateforme à trancher au plan (questions 1 et 10 de la recherche) ; la boîte et la bannière la
  lisent, jamais de chiffre en dur.
- **Destination** : à la sortie, retour au tableau des membres de l'association (4a). À l'entrée, la
  destination du compte visé (`postLoginPathOf`), non dessinée.
- **Autre domaine** (question 12) : la boîte 2b/2h est le parcours retenu : lien vers le domaine de
  l'association visée, où le SuperAdmin se connecte s'il ne l'est pas.
- **Bannière partout** (question 11) : trois espaces montrés ; `/admin` n'en a pas besoin, il est
  inaccessible pendant la session.
- **Notification du compte visé** : non dessinée, hors périmètre.

## Design system gaps

À trancher et à inscrire au design system, **non comblés ici** :

1. **Deux actions sur une ligne de tableau.** La règle dit « une seule action par ligne ». Proposition
   des planches 1a / 1b : deux boutons `outline` alignés à droite, « Agir à sa place » en premier avec
   icône, « Retirer » en texte `destructive` ; en mobile, 56 px puis 44 px. À inscrire au §3.5.
2. **Variante `alert` « muted »** (écran 5) : non listée (seuls succès neutre et échec existent).
   Fond `muted`, bordure `border`, icône `Lock`.
3. **Valeurs du magenta de l'`ImpersonationBar`** : aucun token fourni. Supposé :
   `oklch(0.5 0.21 345)` / `oklch(0.44 0.2 345)`, rayures à 135°, pas de 12 px. Contraste du texte blanc
   à mesurer avant d'implémenter. **Mesuré à l'exécution (tâche 6)** : blanc sur `oklch(0.5 0.21 345)`
   (≈ `#ad057e`) **6,8:1**, sur `oklch(0.44 0.2 345)` (≈ `#96006b`) **8,4:1** — AA partout, AAA sur la
   bande sombre. Valeurs posées dans le composant (`impersonation-bar.tsx`), pas dans `globals.css` (D13).
4. **Bannière mobile** : titre sur deux lignes, quatre lignes de texte plus bouton (≈ 170 px, sous le
   quart de 844 px) ; icône retirée en mobile.
5. **Compte à rebours** : emplacement non spécifié ; il remplace la ligne de détail (3d).
6. **Bouton qui est un lien** (2b) : style `default` appliqué à un `<a>`, non décrit.
7. **Icônes** non spécifiées : `CircleAlert` pour l'échec, `Clock` pour l'expiration ; état désactivé
   du bouton en envoi (opacité 0,6 supposée).
8. **Page de connexion prestataire** : esquissée en 4c, absente du brief. Écran existant ; seul le
   `alert` d'expiration est nouveau.

Deux écarts de la maquette à ne pas reproduire : le **rôle « Présidente »** est en dur dans les
textes (à lire du compte visé) et la **navigation fictive** de 3c (Pages / Membres / Agenda) n'est
pas celle du bureau.
