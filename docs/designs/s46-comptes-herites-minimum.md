# Design — Story s46-comptes-herites-minimum

> Conçu le 2026-10-13, chemin **Claude Design** : brief `docs/designs/s46-comptes-herites-minimum-brief.md`,
> livraison remise par Marie-Ève le 2026-10-13 (export `s46-comptes-herites-minimum.zip`, fichier
> `s46 Comptes herites minimum.dc.html`), puis reportée ici. Canevas :
> `https://claude.ai/design/p/602f4d14-7200-4dfc-8020-c918e2fd3466?file=s46+Comptes+herites+minimum.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s46-comptes-herites-minimum.md`.
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucune version sombre
> n'a été dessinée, volontairement.

## Périmètre du design

| Critère | Ce qu'il demande                                                           | Où                                        |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------- |
| 1       | `/account` ne propose que la sécurité ; les autres adresses en 404         | **Écran 2** ; 404 existante, non dessinée |
| 2       | `/dashboard` = espace membre : nom de l'association + lien vers `/account` | **Écrans 0 et 1**                         |
| 3       | Lien vers `/bureau` dans le menu de `/admin`, sur un domaine d'association | **Repère 3**                              |
| 4 à 6   | Familles de pages, dates en français, règles                               | _non dessinables_                         |

## Screen(s)

Trois écrans en **ordinateur (1 280 px) et mobile (390 px)**, plus un repère de continuité en
ordinateur seul. Données fictives : « Les Amis de l'Étang », teinte 195, monogramme « AE », Claire
Meunier.

### Écran 0 — Coquille de l'espace membre (réponse au manque du design system)

Commune à `/dashboard` et `/account`. Remplace la coquille du boilerplate (barre latérale, sélecteur
d'organisation, menu utilisateur, fil d'Ariane, bouton de retour d'expérience), qui part.

1. **Deux éléments seulement** : `<AssociationMark size="public" />` à gauche, lien vers `/` ; bouton
   `outline` « **Se déconnecter** » à droite.
2. Bouton : icône `LogOut` 20 px + libellé, 48 px (56 px sur mobile). Jamais l'icône seule.
3. Aucun menu, avatar, cloche, sélecteur ni tiroir. La navigation `/dashboard` ↔ `/account` passe par
   des liens dans le contenu.
4. Fond `background`, filet 1 px `border`, sans ombre ; padding vertical 16 px (12 px sur mobile) ;
   intérieur aligné sur la colonne `max-w-[1000px]`, marges 16 px sous 1 024 px.
5. Mobile : le nom de l'association **passe à la ligne** (deux lignes au plus, puis points de
   suspension) ; le bouton garde toujours son libellé (`flex-shrink: 0`).
6. Lien d'évitement « **Aller au contenu** » : premier élément focalisable, visible au focus, cible
   `<main id="contenu">`.
7. **Pas de nom de l'utilisateur dans l'en-tête** : le « Bonjour {prénom nom} » de s12d le portera
   dans le contenu.

### Écran 1 — Espace membre (`/dashboard`)

Coquille de l'écran 0, colonne `max-w-[1000px]`. `h1` « **Votre espace membre** ». **Aucune phrase
sous le titre** (proposition du brief retirée sur le canevas : elle répétait la carte ; le « Bonjour
{prénom nom} » de s12d prendra cette place). Puis une `card` « **Sécurité du compte** » : « Votre
adresse email, votre mot de passe et les appareils connectés à votre compte. » et le lien
« **Gérer la sécurité du compte** » (icône flèche à droite) vers `/account`.

- **Action unique : un lien souligné**, pas un bouton `default` ; cible 48 px (56 px sur mobile).
- **SuperAdmin ou compte sans appartenance à l'association** : écran identique, rien n'est lu du
  membre.
- **Cadre prêt pour s12d** : la carte « Mes parcelles » s'insère **au-dessus** de « Sécurité du
  compte », espacement 32 px, sans changer l'en-tête ni la colonne.
- Aucun chiffre, graphique, tuile, activité, abonnement ni nom d'organisation ; pas de marqueur
  « Espace personnel » (il arrivera avec « Mes parcelles », §3.4).

### Écran 2 — Sécurité du compte (`/account`)

Coquille de l'écran 0, colonne `max-w-[1000px]`. En tête, le lien « **Revenir à mon espace** »
(icône `ArrowLeft` + libellé) vers `/dashboard`. `h1` « **Sécurité du compte** », chapeau en
`muted-foreground` : « Votre adresse email, votre mot de passe et les appareils connectés à votre
compte. » Puis quatre `card` empilées (32 px d'écart, 24 px sur mobile), dans cet ordre :

| Carte                           | Contenu (formulaire existant, non redessiné) | Titre aujourd'hui                    |
| ------------------------------- | -------------------------------------------- | ------------------------------------ |
| **Adresse email**               | changement d'adresse                         | « Changer l'adresse email »          |
| **Mot de passe**                | changement de mot de passe                   | « Changer le mot de passe »          |
| **Vérification en deux étapes** | double authentification                      | « Authentification à deux facteurs » |
| **Appareils connectés**         | sessions ouvertes                            | sessions                             |

- Le titre unique « Sécurité du compte » remplace le `h1` « Mon Compte », le `h2` « Sécurité » et
  l'ancienne description (qui contenait « authentification »).
- Les **titres de carte** changent (colonne de gauche). Le contenu des formulaires — y compris leurs
  libellés internes « authentification à deux facteurs » — n'est pas repris ici (voir les manques).

### Repère 3 — Barre latérale de `/admin` (héritée, seule l'entrée du bas change)

- **Domaine d'une association** : l'entrée « Application (front office) » (vers `/dashboard`) est
  remplacée par « **Back-office de l'association** », icône `Landmark` (lucide), avec le **nom de
  l'association** en sous-libellé `meta` 15 px, tronqué s'il manque de place. Ouvre `/bureau` dans le
  même onglet, sans nouvelle connexion.
- **Barre repliée** : `aria-label` et `tooltip` portent libellé + nom.
- **Adresse de la plateforme** : l'entrée n'est pas rendue (pas d'état grisé) ; le groupe du bas, qui
  ne contenait qu'elle, disparaît avec son séparateur.

## Mockup

`docs/designs/s46-comptes-herites-minimum.html` — référence visuelle. DO NOT copy into production:
Execute builds with the real components. Normalisée depuis l'export du canevas : le moteur de rendu
de Claude Design (`support.js`) est retiré, les réglages du canevas sont figés à leur valeur retenue
(phrase sous le titre retirée, nom d'association en retour à la ligne, notes en marge affichées).

## Reused components (from the design system)

- `<AssociationMark size="public" />` — identité dans l'en-tête de l'espace membre (§2.7).
- `button` `outline` (48 px / 56 px mobile) — « Se déconnecter ».
- `card` — « Sécurité du compte » sur l'espace membre ; les quatre sections de `/account`.
- lien (`link`, souligné) — « Gérer la sécurité du compte », « Revenir à mon espace », « Aller au
  contenu ».
- `sidebar` de `/admin` (existante) — l'entrée « Back-office de l'association », `tooltip` en mode
  replié.
- Icônes lucide : `LogOut`, `ArrowLeft`, flèche du lien d'action, `Landmark`.

## States

- **Espace membre** : un seul état rendu ; visiteur sans session redirigé vers `/login` (pas
  d'écran) ; SuperAdmin et compte sans appartenance voient le même écran. Ni vide, ni chargement, ni
  erreur : la page ne charge aucune donnée.
- **Sécurité du compte** : chaque formulaire garde ses états actuels (non redessinés) ; la page est
  toujours remplie.
- **Barre de `/admin`** : entrée présente (domaine d'association, dépliée ou repliée) ou absente
  (adresse de la plateforme).

## Design system gaps

- **En-tête de l'espace membre — comblé par cet écran, à reporter dans `docs/design-system.md`.** Le
  système fixait le gabarit de l'espace membre (§1.6) sans en-tête ni déconnexion. La proposition de
  l'écran 0, validée sur le canevas, est la réponse ; elle entre dans le design system (§1.6 ou §2.1)
  par une mise à jour du document de cadrage sur `main`.
- **« Authentification à deux facteurs » dans les formulaires de sécurité** : mot interdit à l'écran
  (§3.6). Cette story change le **titre** de la carte (« Vérification en deux étapes ») ; les
  libellés internes du formulaire (`UserSecuritySection.*` dans `messages/fr.json`) restent à corriger,
  hors de cette story.
- **En-tête du site public** : son bouton « Connexion » ne sait pas qu'on est connecté ; aucun
  chemin du site public vers l'espace membre. Hors périmètre, noté pour s12d.
