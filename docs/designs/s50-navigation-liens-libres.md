# Design — Story s50-navigation-liens-libres

> Conçu le 2026-11-27, chemin **agent**. Source visuelle unique : `docs/design-system.md`. Contexte de
> code : `docs/research/s50-navigation-liens-libres.md`. Écran d'ancrage : l'écran 1 de s04b
> (`docs/designs/s04b-navigation-publique.md`), **tel qu'il a été livré** —
> `src/components/features/navigation/site-navigation-manager.tsx` (`SortableList`, `MenuItemRow`,
> `AddMenuEntry` en `Popover` + `Command` ; le `sheet` mobile prévu par s04b n'a pas été livré et n'est
> pas réintroduit ici).
>
> **Mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)).
>
> Contrôle visuel : non fait — Chromium de Playwright (`chromium_headless_shell-1234`) ne démarre pas :
> 14 bibliothèques système absentes du conteneur (`libnspr4.so`, `libnss3.so`, `libatk-1.0.so.0`,
> `libdbus-1.so.3`, `libXcomposite.so.1`…), sans `sudo` pour les installer (vérifié le 2026-11-27).
> Contrôle en lecture seule à la place : aucune couleur hors des tokens de `:root` (seule l'ombre
> `shadow-lg` du socle, `rgb(0 0 0 / 0.1)`), marges dans l'échelle 4/8/12/16/24/32/48/64 (plus le
> 2 px interne de l'interrupteur, repris de s04b), tailles de texte du §1.3 seulement (12, 15, 16, 17,
> 18, 20, 26, 34), dix planches de l'écran A en deux versions (ordinateur et mobile 390 px, mise en page
> mobile par requêtes de conteneur), états présents, HTML bien formé.

## Périmètre du design

Arbitrages appliqués (décidés, non rouverts) :

1. **Piège s34** : rien en s50. Une entrée libre visible s'affiche toujours ; aucun avertissement,
   aucun masquage, aucune annotation sur la ligne.
2. **Modifier ne change jamais le type** : une entrée libre modifie son libellé et son adresse ; une
   entrée de page reste une entrée de page (pour changer : retirer, puis ajouter).
3. **Une entrée de page garde le titre de la page** comme libellé. Le champ « Libellé » n'existe que
   pour l'entrée libre.

Hors périmètre (story) : aucune vérification qu'un chemin interne existe, aucun nouvel onglet pour un
lien externe (pas de `target="_blank"`), pied de page inchangé, pas de sous-menu.

| Critère | Ce qu'il demande                                           | Où                                               |
| ------- | ---------------------------------------------------------- | ------------------------------------------------ |
| 1       | Ajouter « libellé + adresse » ; ordonner, retirer, masquer | A1, A3, A7 (mêmes gestes que s04b)               |
| 2       | Rendu public à sa place, `rel="noopener noreferrer"`       | B (note : rendu inchangé)                        |
| 3       | Adresse refusée = rien d'enregistré, erreur sur le champ   | A4, A6                                           |
| 4       | Entrées de page inchangées ; jamais page **et** adresse    | A1 (les deux types côte à côte) ; base           |
| 5       | Scopé au tenant                                            | _non dessinable_                                 |
| 6       | Ajouter, modifier, retirer → menu à jour sans délai        | A3, A5, A7 ; cache, _non dessinable_             |
| 7       | Membre non-bureau ne peut ni ajouter ni modifier           | _non dessinable_ (`BureauAccessDenied` existant) |

Données fictives, reprises de s04b : « Les Amis de l'Étang » (teinte 195) ; entrées « Qualité de
l'eau » (page publiée), « Nous contacter » (`/contact`), « Compte-rendu AG 2025 » (page en brouillon),
« Mairie de Saint-Étang » (`https://www.saint-etang.fr`, masquée par son interrupteur).

## Screen(s)

### Écran A — Bureau : Navigation du site, carte « Menu du site »

Même page, même `h1`, mêmes deux cartes que s04b. Seule la carte « Menu du site » change ; la carte
« Pied de page » n'est pas touchée.

**La liste** — `<SortableList />` inchangé (poignée, pastille « n sur N », « Monter / Descendre »
toujours visibles). Les deux types d'entrée se mêlent dans un seul ordre. `getLabel` lit le titre de
la page ou le libellé de l'entrée libre (annonces `aria-live`, bande de retrait).

- **Entrée de page** : rien ne change (titre + `badge` de statut, annotation « Masquée sur le site
  public — la page n'est pas publiée », `switch` « Visible », « Retirer du menu »).
- **Entrée libre** : libellé en 17 px / 500, **sans badge** (un `badge` est un statut ; une entrée
  libre n'en a pas). En dessous, une ligne `meta` (15 px, `muted-foreground`) qui **écrit** le type et
  l'adresse — c'est le mot qui distingue, pas une couleur :
  - chemin interne : « Adresse du site : `/contact` » ;
  - adresse externe : icône `ExternalLink` 16 px (vocabulaire figé §1.7 : « lien qui quitte le site »)
    - « Autre site : `https://www.saint-etang.fr` ».
  - L'adresse est en `data` (JetBrains Mono 15 px), coupée n'importe où si elle est longue
    (`overflow-wrap: anywhere`) : aucun défilement horizontal à 390 px.
  - Pied de ligne : `switch` « Visible » (inchangé), puis **« Modifier »** (`outline`, texte seul) et
    « Retirer du menu » (`outline`, icône `X`, comme livré). En mobile, les deux boutons passent en
    pleine largeur 56 px, l'un sous l'autre, sous l'interrupteur.
- Aucune annotation de module (arbitrage 1).

**L'ajout — popover livré, étendu** — le bouton `outline` « + Ajouter une entrée » ouvre le même
`Popover` (largeur portée de 22 rem à 26 rem pour loger les champs ; pleine largeur de la carte en
mobile). Il commence par un `radio-group` (§2.1 : 2 options courtes) sous la légende « Ajouter au
menu » :

1. **« Une page »** — « Une page créée dans « Pages ». » — **valeur par défaut** : le geste de s04b
   reste le premier. Révèle le `command` existant (recherche + pages pas encore au menu, avec leur
   statut) ; choisir une page l'ajoute aussitôt, comme aujourd'hui.
2. **« Une adresse »** — « Un chemin du site, comme /contact, ou un autre site. » Révèle, dans cet
   ordre :
   - **Libellé** — aide « Le texte affiché dans le menu du site. » ; compteur `meta` aligné à droite
     (§3.9), plafond à fixer au plan (la maquette écrit `/ 40` à titre d'exemple) ;
   - **Adresse** — saisie en `data` ; aide « Un chemin du site, qui commence par « / » (par exemple
     /contact), ou l'adresse d'un autre site, qui commence par https://. » ;
   - bouton `default` **« Ajouter au menu »** (le seul de la couche ouverte ; la page garde son
     « Enregistrer » du pied de page, masqué derrière la couche). Pendant l'envoi : « Ajout… »,
     largeur conservée.

Le contenu révélé suit la forme du §3.14 : retrait de 48 px en bureau, pleine largeur sous 640 px,
juste après son option dans l'ordre de tabulation. Changer d'option garde ce qui était saisi dans
l'autre (pas de perte silencieuse). Après un ajout réussi, le popover se ferme et l'entrée paraît en
**dernier rang** de la liste, annoncée en `aria-live` (« Nous contacter, position 5 sur 5 »).

**La modification — `dialog`** — « Modifier » (entrée libre seulement) ouvre un `dialog` « Modifier
l'entrée » : deux champs, Libellé et Adresse, pré-remplis, mêmes aides et compteur qu'à l'ajout
(§2.1 : `dialog` ≤ 2 champs). Une phrase `meta` sous le titre rappelle l'arbitrage 2 : « Une entrée
vers une adresse reste une adresse. Pour viser une page, retirez l'entrée puis ajoutez la page. »
Pas de `radio-group` ici. Actions : « Annuler » (`outline`) et « Enregistrer l'entrée » (`default`) ;
en mobile, pleine largeur 56 px, « Enregistrer l'entrée » au-dessus. Succès : le dialog se ferme, la
ligne montre les nouvelles valeurs à sa place, le focus revient sur « Modifier ».

**Le retrait** — même bande `warning` ancrée sous la liste, 10 s : « Entrée « Mairie de Saint-Étang »
retirée du menu. » + « Annuler ». Annuler recrée l'entrée **avec son libellé et son adresse**, à sa
place (piège 3 de la recherche) — même rendu que pour une page.

**Les erreurs de champ** (critère 3) — §3.1 et §3.9 : bordure 2 px `destructive`, message 16 px / 500
en `--destructive-text` sous le champ, résumé ancré en tête du formulaire (« 2 champs à corriger »,
liens vers chaque champ, `role="alert"`, focus à la soumission). Validation au _blur_, puis à la
soumission ; le serveur rend les mêmes erreurs **par champ**, posées au même endroit. Rien n'est
enregistré et la saisie reste dans les champs. Messages proposés (libellés dans `messages/fr.json`) :

| Cas                                                                      | Message sous le champ                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Libellé vide                                                             | « Écrivez le libellé affiché dans le menu. »                                                                              |
| Libellé au-delà du plafond                                               | compteur en faute + « {n} caractères de trop. » (§3.9)                                                                    |
| Adresse vide                                                             | « Écrivez l'adresse de l'entrée. »                                                                                        |
| Adresse en `http://`                                                     | « Cette adresse commence par http:// : seules les adresses en https:// sont acceptées. »                                  |
| Tout autre refus (`javascript:`, `data:`, `//hôte`, `\hôte`, `mailto:`…) | « Adresse refusée : écrivez un chemin qui commence par une seule barre « / », ou une adresse qui commence par https://. » |

Le cas `http://` a son propre message parce que c'est la faute la plus probable et qu'elle se corrige
d'une lettre ; tous les autres refus partagent un message qui dit **ce qui est accepté** (liste
blanche), jamais la liste de ce qui est refusé. Une erreur de serveur sans champ (droit refusé, échec
d'enregistrement) reste l'`alert` en tête de la carte, comme s04b ; si elle survient dans le dialog,
elle s'écrit en tête du dialog, qui reste ouvert.

**Mobile (390 px)** — gouttière 16 px, carte en `p-4`, champs 56 px en 18 px, boutons d'action
pleine largeur 56 px, contenu révélé sans retrait. Le popover garde sa forme (pas de `sheet`, voir
gap 1).

### Écran B — Site public : menu rendu (note, pas de forme nouvelle)

Rendu **visuellement inchangé**. Les entrées visibles s'affichent dans leur ordre, en liens texte,
dans la `nav` d'ordinateur et dans le tiroir `PublicMobileMenu` ; une entrée libre se lit comme une
entrée de page (même lien, sans icône). L'externe s'ouvre dans le même onglet et porte
`rel="noopener noreferrer"`. Une entrée masquée, une page non publiée ou une adresse que la validation
au rendu refuserait sont **omises**, sans trou ni lien cassé (Do/Don't §8). La planche B de la maquette
montre l'en-tête avec deux entrées visibles.

## Mockup

`docs/designs/s50-navigation-liens-libres.html` — référence visuelle, DO NOT copy into production :
l'Execute construit avec les vrais composants (`SortableList`, `Popover`, `Command`, `RadioGroup`,
`Input`, `Label`, `Dialog`, `Switch`, `Badge`, `Alert`, `Button`, `Skeleton`). Onze planches ancrées :
A1 à A10 (écran A, chacune en ordinateur puis en mobile 390 px) et B (note publique). Les planches A2
à A4 ne redessinent que la fin de la liste, sous laquelle s'ouvre le popover.

## Reused components (from the design system)

- `<SortableList />` (P0, §2.4) — inchangé ; seul son `getLabel` lit le libellé de l'entrée libre.
- `popover` + `command` — le sélecteur livré par s04b, désormais révélé par l'option « Une page ».
- `radio-group` (§2.1) et **option à contenu révélé** (§3.14) — choix « Une page / Une adresse ».
- `label` + `input` (§2.1, §3.1), compteur de caractères (§3.9) — Libellé et Adresse.
- `dialog` (§2.1, ≤ 2 champs) — modification d'une entrée libre.
- `alert` `destructive` 2 px — résumé d'erreurs (§3.9) et échec d'action (s04b).
- `switch`, `badge`, `button` (`outline`, `default`), bande d'annulation `warning`, `skeleton` — tels
  que livrés par s04b.
- Icône `ExternalLink` (§1.7, vocabulaire figé) — seule icône ajoutée, sur la ligne d'une adresse
  externe côté bureau.

## States

- **Vide (A8)** : « Aucune entrée dans le menu. » puis « + Ajouter une entrée », qui ouvre le même
  popover (les deux choix y sont offerts, même sans page à ajouter : « Aucune page à ajouter. » sous
  « Une page »).
- **Chargement (A9)** : `skeleton` de la page, inchangé ; jamais de `skeleton` dans le formulaire.
  Envoi : libellé du bouton remplacé (« Ajout… », « Enregistrement… »), largeur conservée.
- **Erreur** : de champ à l'ajout (A4 : libellé vide + `http://`) et à la modification (A6 :
  `//www.saint-etang.fr`) ; d'action sur la liste (A10 : `alert` ancrée en tête de carte, « Rien
  n'est perdu : réessayez. »).
- **Succès** : A1 (liste mêlée), A3 (popover « Une adresse » rempli, avant envoi), A5 (dialog de
  modification), A7 (retrait + annulation). Comme toutes les actions du menu de s04b, l'effet est
  immédiat et se lit dans la liste elle-même, annoncé en `aria-live` : pas d'`alert` de succès
  supplémentaire.

## Design system gaps

1. **Des champs de saisie dans un `popover`** — le §2.1 ne décrit le `popover` qu'avec un `command` ;
   un formulaire court y est logé ici parce que c'est le conteneur livré par s04b et que le choix
   « Une page / Une adresse » doit rester au même endroit. Le `dialog` (≤ 2 champs) ne convient pas
   tel quel (`radio-group` + 2 champs) et le `sheet` mobile prévu par s04b n'a pas été livré. À
   trancher : popover accepté pour un formulaire de 2 champs, ou bascule vers `dialog`/`sheet`.
2. **Deux boutons sur une ligne de liste** — « Modifier » + « Retirer du menu » sur une entrée libre.
   La règle « une seule action par ligne » vise le tableau (§2.1) ; le même manque est déjà ouvert pour
   s48 (§9, « Deux actions sur une ligne »). Composé ici comme s48 le propose (deux `outline`, empilés
   en 56 px en mobile) ; à trancher avec lui.
3. **Indice « lien externe » dans le menu public** — le §1.7 attache `ExternalLink` au « lien qui
   quitte le site », mais le menu public n'a pas de forme pour un lien externe et la story le veut
   inchangé : non dessiné. À décider (avec l'annonce éventuelle pour les lecteurs d'écran).
4. **Plafond de longueur du libellé** (et de l'adresse) — aucun plafond déclaré ; une `nav` d'ordinateur
   sans retour à la ligne s'élargit avec des libellés libres longs (piège 11 de la recherche). Le
   compteur du §3.9 est prêt à le porter ; la valeur est à fixer au plan.
