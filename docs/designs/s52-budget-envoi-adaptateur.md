# Design — Story s52-budget-envoi-adaptateur

> Conçu le 2026-11-14 par le chemin **agent** (`/ks-design s52 --agent`), sans outil externe ni canevas.
> Source visuelle unique : `docs/design-system.md` (tokens §1, composants §2, formes §3.5, §3.10 et §3.13).
> Contexte de code : `docs/research/s52-budget-envoi-adaptateur.md`. Story la plus proche, reprise pour
> les formes : `docs/designs/s26-envoi-echelonne.md`.
>
> **Web : mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). Aucun email nouveau
> dans cette story : pas de jumelle « sombre forcé » (§5.2) à produire.
>
> **Non validé par Marie-Ève à ce jour.**
>
> Contrôle visuel : voir la dernière ligne de ce document.

## Périmètre du design

Seuls deux critères de la story ont une face visible. Les autres (atomicité, isolation, purge, emails
de plateforme, frontière de jour) ne se dessinent pas.

| Critère    | Ce qu'il demande                                                                | Où                                                                                    |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1          | Budget quotidien, paramètre de tenant (300 par défaut), sans redéploiement      | **Écran 2** : champ « Limite d'envoi quotidienne de la messagerie »                   |
| 3          | Réserve pour les emails de connexion (100 par défaut), paramètre de tenant      | **Écran 2** : champ « Envois gardés pour la connexion » ; **Écran 1** : carte du jour |
| 4          | Un envoi reporté n'est ni refusé ni perdu ; le bureau voit sa nature et sa date | **Écran 1** : carte « En attente » (Nature, État « Programmée pour le … »)            |
| 6          | Une part de campagne qui dépasse le reliquat est reportée, pas écartée          | **Écran 3** : bandeau `warning` et part « Programmée pour le 15/11 »                  |
| 2, 5, 7-10 | Atomicité, rejeu unique, purge, plateforme, isolation, frontière de jour        | non dessinables                                                                       |

## Screen(s)

Trois écrans, chacun en **bureau (1 280 px) et mobile (390 px)**. Données fictives : « ASL Les Pins »
(monogramme « LP », teinte 195), samedi 14/11/2026, limite 300 envois par jour dont 100 gardés pour la
connexion, campagne « Convocation à l'assemblée générale » de s26 (296 destinataires, plafond 100).

| Écran | Route                    | Nouveau ou changé                                                  |
| ----- | ------------------------ | ------------------------------------------------------------------ |
| 1     | `/bureau/envois`         | **nouveau** : ce qui est parti aujourd'hui, ce qui attend demain   |
| 2     | `/bureau/reglages`       | deux champs en tête de la carte « Envois » (créée par s26)         |
| 3     | `/bureau/campagnes/{id}` | bandeau et état de part quand la limite du jour reporte une partie |

### Écran 1 — Envois d'emails (`/bureau/envois`)

- **Barre latérale** : nouvelle entrée « Envois » dans le groupe « L'association », **après
  « Campagnes »**, sans icône (comme les autres entrées du groupe). Active selon la route.
  `breadcrumb` « L'association › Envois ».
- `h1` « Envois d'emails », puis une phrase : « Votre messagerie envoie au plus 300 emails par jour. Ce
  qui dépasse part le lendemain, sans action de votre part. » Le nombre vient du réglage.
- **Bandeau d'état** (`alert`, un seul à la fois, voir États) — sous le titre.
- **Carte « Aujourd'hui, samedi 14/11/2026 »** (jour de Paris) :
  - `progress` déterminée « 222 sur 300 emails envoyés aujourd'hui », **sans pourcentage écrit** : la
    source compte vraiment (§2.1) ;
  - compteur à quatre paires, forme de §3.13 : « Envoyés aujourd'hui » · « Dont emails de connexion » ·
    « Autres envois encore possibles » (`budget − réserve − envois reportables du jour`, jamais négatif)
    · « Limite remise à zéro : à minuit » ;
  - phrase en `meta` : « 100 envois sont gardés chaque jour pour les emails de connexion. Ils partent
    toujours, même quand les autres envois attendent demain. »
- **Carte « En attente »** : tableau Envoi · Nature · Destinataires · État · action. La date de report
  est celle du badge d'état ; une colonne « Reporté le » (jour où le report a eu lieu) a été retirée au
  contrôle visuel : elle faisait déborder le tableau à 1 280 px et répétait « aujourd'hui » sur chaque
  ligne.
  - **Envoi** : le titre (objet de campagne entre guillemets, ou description de la notification), et
    en dessous en `meta` une précision (« Part 3 sur 3 », « À l'adresse de contact »). **Aucune adresse
    email, aucun contenu de message** : la page dit ce qui attend, pas ce qu'il contient (critère 7).
  - **Nature** : « Campagne » ou « Notification au bureau » (voir À trancher au plan, point 1).
  - **Destinataires** : un nombre en `data`. Une part de campagne est **une ligne**, pas une ligne par
    membre : le détail par membre reste sur l'écran de la campagne (s26).
  - **État** : `badge` `secondary` « Programmée pour le 15/11 », la forme de §3.13 pour « à venir ».
  - **Action**, une seule, en lien : « Voir la campagne », « Voir le message », « Voir le signalement ».
  - 25 lignes par page, « Précédent / Suivant » (« Précédent » inactif en page 1, §3.13). Sous 640 px :
    cartes empilées (§3.5), le titre de l'envoi en tête.
  - Phrase au-dessus du tableau : « Ces envois partiront seuls le jour indiqué. Vous n'avez rien à
    faire. »
- **Pas de bouton** sur cette page : il n'y a rien à déclencher (critère 5 : « sans action humaine »).
  Pas de « Envoyer maintenant » : ce serait dépasser la limite.

### Écran 2 — Réglages, carte « Envois » (`/bureau/reglages`)

Deux champs du type « Nombre » du registre (§3.1 : `input` en `data`, unité écrite à droite), **en tête**
de la carte « Envois » créée par s26, au-dessus des deux champs de s26 inchangés :

1. **« Limite d'envoi quotidienne de la messagerie »** — 300, « envois par jour ». Aide : « Nombre
   maximum d'emails envoyés par jour pour l'association, tous envois confondus : connexion, campagnes,
   notifications. Gardez-la égale à la limite de votre messagerie. Par défaut : 300. »
2. **« Envois gardés pour la connexion »** — 100, « envois par jour ». Aide : « Part de la limite
   réservée aux emails de connexion, qui partent toujours. Les autres envois s'arrêtent avant et
   reprennent le lendemain. Par défaut : 100. »
3. « Plafond quotidien des campagnes » (s26, inchangé) — l'aide de s26 parlait du « reste de la limite
   d'envoi de votre messagerie » : elle est raccourcie ici, puisque la limite a désormais son champ.
4. « Nombre de tentatives d'envoi d'une part » (s26, inchangé).

« Enregistrer les réglages » (`default`, pleine largeur sous 640 px). La description de la carte (s26)
reste : « Ces réglages s'appliquent aux prochains envois ; une campagne déjà lancée garde son plan. »

### Écran 3 — Campagne, part reportée (`/bureau/campagnes/{id}`)

Seul le changement par rapport à l'écran 2 de s26 est dessiné.

- **Bandeau** `alert` `warning` + `AlertTriangle` : « La limite d'envoi du jour est atteinte. 40 membres
  de la part du 14/11/2026 recevront la campagne demain, le 15/11/2026. Vous n'avez rien à faire. »
  C'est un report, pas un refus : `warning`, jamais `destructive` (§3.13).
- **Avancement** (s26, inchangé dans sa forme) : « 160 sur 296 membres ont reçu la campagne » ; les 40
  reportés comptent dans « Programmée ».
- **Envois par jour** : la part 2 garde son jour (14/11/2026) et son nombre (100) ; sous « Part 2 », en
  `meta` : « 60 reçues · 40 reportées au 15/11 » ; son état passe à « Programmée pour le 15/11 ». Jamais
  « Bloquée », « Interrompue » ni « En échec » : la part n'a pas échoué.
- Carte « Destinataires » (s26) : les 40 reportés portent « Programmée pour le 15/11 », l'état existant.

## Mockup

`docs/designs/s52-budget-envoi-adaptateur.html` — maquette statique, un seul fichier, sans runtime
externe hors polices Google. Chaque état est rendu deux fois par le même gabarit : un cadre bureau
(1 280 px au plus) et un cadre mobile (390 px). Les règles de mise en page suivent la largeur du
**cadre** (container queries) : réduire la fenêtre à 390 px fait aussi passer les cadres bureau en
version mobile. **NE PAS copier en production** : l'Execute construit les écrans avec les vrais
composants (`sidebar`, `card`, `table`, `badge`, `alert`, `progress`, `pagination`, champs du registre).

Le HTML est généré par un court script dans la page : sans JavaScript, la maquette est vide.

## Reused components (from the design system)

- **`sidebar`** — entrée « Envois » ajoutée au groupe « L'association » ; **`breadcrumb`**.
- **`card`**, **`table`** / cartes empilées (§3.5), **`pagination`** (état inactif de §3.13).
- **`badge`** — `secondary` « Programmée pour le … » (états d'un envoi, §3.13), `outline` texte
  `muted-foreground` « Envoyée ».
- **`progress`** — déterminée, sans pourcentage (§2.1).
- **Compteur** `dl` libellé `meta` / valeur `data` (§3.13).
- **`alert`** — `warning` + `AlertTriangle` (report, §3.13), `destructive` 2 px `role="alert"` (erreur,
  §3.9), succès neutre `CircleCheck` `primary` (§3.2).
- **Champs « Nombre » du registre des réglages** (§3.1) : `label`, `input` en `data`, unité à droite.
- **`skeleton`** — chargement des deux cartes de l'écran 1 (listes et tableaux, jamais un formulaire).
- **`button`** — `default` (enregistrer), `outline` (pagination, « Menu » du tiroir) ; 48 px, 56 px sous
  1 024 px. Jamais `sm`.
- **Icônes** — `AlertTriangle`, `CircleCheck`, et `Menu` pour l'ouverture du tiroir sous `lg`.

## States

- **Écran 1**
  - **1a — limite du jour atteinte, envois en attente** (cas courant) : bandeau `warning` « La limite
    d'envoi du jour est atteinte. 42 emails partiront demain, le 15/11/2026, sans action de votre part.
    Les emails de connexion continuent de partir. » ; 222 envoyés dont 22 de connexion, 0 autres envois
    possibles ; trois lignes en attente (une part de campagne de 40, deux notifications au bureau).
  - **1b — rien en attente** (vide) : pas de bandeau ; 87 envoyés, 122 autres envois possibles ; carte
    « En attente » : « Aucun envoi en attente. Tous les emails sont partis. » **Sans action** : il n'y a
    rien à combler (exception assumée à la règle du vide de §3.2, voir gaps).
  - **1c — réserve de connexion épuisée** : bandeau `warning` « Les 100 envois gardés pour la connexion
    sont épuisés. D'ici minuit, votre messagerie peut refuser des emails de connexion. Si cela se
    reproduit, prévenez l'équipe technique : la limite ou la réserve est peut-être à revoir. » ; 300 sur 300.
  - **1d — chargement** : `skeleton` dans les deux cartes, titres visibles.
  - **1e — erreur de lecture** : `alert` `destructive` « Les envois n'ont pas pu être lus. Rien n'est
    perdu : les envois en attente partiront quand même. Rechargez la page dans un instant. » ; les cartes
    ne s'affichent pas.
  - **Succès** : sans objet, la page ne modifie rien.
- **Écran 2**
  - **2a — valeurs par défaut** (300, 100, 100, 3).
  - **2b — erreur** : réserve à 300 pour une limite de 300 : bordure `destructive` 2 px + « Gardez moins
    d'envois que la limite quotidienne (300). » sous le champ + résumé ancré en tête avec lien vers le
    champ (§3.9).
  - **2c — enregistré** : `alert` succès neutre « Réglages enregistrés. Ils s'appliquent dès les
    prochains envois. » (message commun de la page).
  - Chargement : formulaire jamais en `skeleton` (§2.1) ; le bouton remplace son libellé, largeur
    conservée (règle existante, non redessinée).
- **Écran 3**
  - **3a — une part entamée, le reste reporté** (seul état nouveau). Les autres états sont ceux de s26.

## Design system gaps

À consigner ; **rien n'a été comblé**.

1. **`progress` pour la consommation d'un quota** — §2.1 réserve `progress` à l'envoi de campagne et au
   téléversement. La carte « Aujourd'hui » l'emploie pour la consommation de la limite du jour : même
   règle (« un pourcentage seulement quand la source compte vraiment »), usage nouveau. À acter en §2.1.
2. **Vide sans action** — §3.2 veut « ce qui manque et l'action pour le combler ». « Aucun envoi en
   attente » n'a rien à combler : c'est un bon état. À préciser en §3.2 (le vide d'une file d'attente
   n'a pas d'action).
3. **Validation croisée de deux réglages** — §3.1 décrit les erreurs champ par champ ; « la réserve doit
   être inférieure à la limite » dépend de deux champs. La maquette accroche l'erreur au champ de la
   réserve. À décrire en §3.1 si le registre l'accepte (question 14 de la recherche).
4. **« Programmée pour le … » sur une part entamée** — la part 2 a 60 reçues et 40 reportées ; son badge
   dit l'état de ce qui reste, et la sous-ligne `meta` dit le partage. §3.13 ne prévoit pas de part
   partiellement envoyée.
5. **Nature d'un envoi** — vocabulaire nouveau (« Campagne », « Notification au bureau », puis
   « Relance » en s29, « Invitation » en s42). À fixer dans `messages/fr.json` et à nommer en §3.13 pour
   que s29 et s42 le reprennent.
6. **Déclencheur du tiroir sous `lg`** — §1.6 dit « tiroir (`sheet`) sous `lg` » sans dessiner le bouton
   qui l'ouvre. La maquette met un `outline` `Menu` + libellé à droite de `<AssociationMark />` :
   reprendre la forme que l'implémentation existante utilise, pas celle de la maquette.

## À trancher au plan

1. **Quels envois sont reportables ?** La maquette suppose que les notifications au bureau (message de
   contact, signalement) le sont, et que seuls les emails de connexion ne le sont jamais. Question 3 de
   la recherche. Si les notifications sont exemptées, la colonne « Nature » ne montre plus que
   « Campagne » jusqu'à s29.
2. **Qui modifie la limite et la réserve ?** La story nomme le prestataire (SuperAdmin) **et** le bureau.
   La limite décrit le compte de messagerie, que le bureau ne connaît pas forcément. Proposé : visibles
   du bureau, modifiables par le SuperAdmin seul ; à confirmer, la maquette ne le distingue pas.
3. **Frontière de jour** — « Limite remise à zéro : à minuit » suppose minuit à Paris (critère 10). Si
   Brevo remet à zéro à minuit UTC (recherche, section « Quota Brevo »), la phrase doit changer, ou la
   règle.
4. **Une part entamée garde-t-elle son jour ?** La maquette garde « Part 2 · 14/11 » et reporte 40
   membres au 15/11, où la part 3 (96) est déjà programmée : 136 envois de campagne le 15/11, au-delà du
   plafond de 100. Le plafond de s26 s'applique-t-il au report ? Question 9 de la recherche.
   **Tranché par Marie-Ève le 2026-11-14 (après revue) : les parts glissent.** La part entamée garde son
   jour (« Part 2 · 14/11 », « 60 reçues · 40 reportées au 15/11 ») ; les 40 reportés partent **d'abord**,
   le 15/11, et la suite de la campagne glisse d'un jour : la part 3 (96) passe au 16/11. Le plafond de
   s26 s'applique au report : aucun jour ne dépasse `campaign.daily_send_cap`, toutes campagnes
   confondues (une part d'une autre campagne glisse aussi si le jour ne la tient plus). L'écran n'a pas
   changé de forme : chaque part montre son jour, glissé le cas échéant.
5. **Message de 1c** — « prévenez l'équipe technique » : qui, et comment ? Même renvoi que « À vérifier »
   en s26.
6. **Lien « Voir le message » / « Voir le signalement »** — droits : le membre du bureau qui lit cette
   page peut-il ouvrir l'objet ? Même action CASL que les pages existantes, à vérifier.

## Écarts de l'implémentation

Relevés à l'Execute de s52 ; aucun ne crée de token ni de composant.

1. **Limite et réserve en lecture seule pour le bureau** (plan, tâche 1 ; ADR 053 §7) — la maquette les
   dessinait modifiables. Pour le bureau, les deux champs sont rendus `readonly` (fond `muted`), avec la
   valeur en vigueur (défaut compris) et, sous le champ, « Réglé par l'équipe technique de la
   plateforme : vous ne pouvez pas le modifier. » Ils ne sont jamais envoyés par le formulaire du bureau.
   Le SuperAdmin, connecté sous son compte ou à la place d'un compte du bureau, les modifie ; l'état 2b
   (réserve ≥ limite) ne se voit donc que de lui. L'erreur croisée est celle de la maquette.
2. **Titre d'une notification au bureau** — « Signalement « Fuite allée des Chênes » » citait le lieu
   du signalement, un contenu ; l'écran dit « Signalement reçu depuis le site ». La sous-ligne « Au
   responsable du forage » supposait de lire l'adresse du destinataire : elle est omise pour un
   signalement ; « À l'adresse de contact » reste pour un message de contact (c'est toujours sa cible).
3. **Carte « En attente »** — n'y figurent que les **reports** : une part de campagne programmée
   normalement (s26) n'y est pas, comme dans la maquette (la part 3 de 96 n'y était pas).
4. **Bandeau 1a sans envoi en attente** — la limite peut être atteinte sans rien en attente : la phrase
   devient « Les prochains envois partiront demain, sans action de votre part. »
5. **Chargement (1d)** — le titre de la carte du jour est « Aujourd'hui », sans la date, que le
   squelette ne connaît pas encore.
6. **Description de la carte « Envois » des Réglages** — celle de s26 est gardée telle quelle, comme
   le dit l'écran 2 (la maquette HTML en montrait une autre).

## Contrôle visuel

Rendu par Chromium (Playwright 1.62, sans écran), captures de chaque état dans son cadre bureau à 1 280 px et
son cadre mobile à 390 px, relues une à une, plus une mesure automatique des débordements. Deux passes
de correction :

1. tableau qui débordait de la carte et écrasait la colonne « Envoi » (largeur minimale de la colonne
   principale) ; en-têtes et libellés mobiles hérités de la police mono ; « à minuit » en mono alors que
   c'est du texte ; sous-ligne en gras dans les cartes mobiles ;
2. colonne « Reporté le » retirée (le tableau débordait encore) ; en-tête de tableau masqué qui débordait
   de 4 px en mobile ; chemins longs des planches rendus sécables.

Après la seconde passe : aucun débordement à 1 280 ni à 390 px (mesuré), aucune erreur de script.
**Restent, non corrigés** (limite de deux passes) : l'espace avant « : » n'est pas insécable dans les
aides des réglages (« Par défaut : 300 » se coupe avant les deux-points en mobile) ; le lien d'action
du tableau passe sur deux lignes en bureau. Captures non versionnées. Polices Google chargées, donc le
rendu montre les vraies familles.

Contrôle visuel : fait le 2026-11-14 à 1280 et 390 px
