# Design Brief — Story s13-import-initial-membres

> À coller dans Claude Design (`/design docs/designs/s13-import-initial-membres-brief.md`). Brief
> autonome : story, écrans, contraintes du design system, sortie attendue.

## Story

**En tant que** SuperAdmin Zourite Studio **je veux** importer la liste des propriétaires fournie par
l'association **afin d'**ouvrir le service sans saisie manuelle de plusieurs centaines de fiches.

Critères d'acceptation touchant l'interface :

1. L'import se fait depuis le back-office, **par téléversement du fichier** : le parcours complet
   (choisir l'association, déposer le fichier, lire le rapport) s'accomplit à l'écran, sans ligne de
   commande ni accès à la base.
2. Importer le fichier crée les membres, leurs coordonnées et leurs rattachements de parcelle dans
   l'association visée.
3. Une ligne sans adresse postale ni email est **rejetée et signalée** dans le rapport.
4. Plusieurs lignes du même propriétaire donnent **un seul** membre avec plusieurs parcelles.
5. Une ligne sans email crée le membre et sa parcelle, **sans compte de connexion**, marqué « courrier
   uniquement ».
6. Les lignes invalides sont rejetées **une à une**, listées dans un rapport, et n'empêchent pas
   l'import des lignes valides.
7. **Relancer le même import ne duplique rien.**

Contexte utile au design (fichier réel de La Fourche, ~413 lignes, sur le modèle d'un export Pennylane) :
~19 lignes rejetées sans adresse ni email, ~106 membres « courrier uniquement », quelques dizaines de
remarques non bloquantes (cellule à plusieurs emails : seule la première adresse est gardée ; code postal
à 4 chiffres complété d'un zéro). Prévoir un rapport qui reste lisible avec **0, quelques-unes ou plusieurs
dizaines** de lignes rejetées.

## Mode : clair seul

**Une seule version de thème : clair.** Le produit ne s'affiche qu'en clair (ADR 033, qui remplace
l'ADR 012) ; une livraison de conception ne fournit plus de jeu sombre. Chaque écran est en revanche
livré en **deux versions : bureau (≥ 1 024 px) et mobile (390 px)**, mêmes contenus, mêmes états.

## Écrans à produire

Données fictives uniquement : association « Rives Vertes » (monogramme « RV », teinte 195), noms
inventés. Aucune donnée réelle dans la maquette.

### Écran 1 — Déposer le fichier

- Page : `/admin/membres-import` (back-office SuperAdmin, barre latérale 248 px → tiroir sous `lg`).
  Fil d'Ariane : « Administration › Importer des membres ». Un seul `h1` : « Importer des membres ».
- Point d'entrée supplémentaire : sur la page d'édition d'une association, un bouton `outline`
  « Importer des membres » (icône `Upload`) ouvre cette page avec l'association déjà choisie. Montrer
  ce bouton dans la carte « Membres » (bureau et mobile).
- Mise en page : une colonne, `max-w-[720px]`, deux cartes.
  - **Carte « 1 · Association »** : `select` libellé « Association » (liste des associations par nom),
    aide « Les membres seront créés dans cette association. » Pré-rempli quand on arrive depuis la fiche
    d'une association ; sinon placeholder neutre « Choisir une association » (le libellé reste visible).
  - **Carte « 2 · Fichier »** : `file-upload` (zone de dépôt **et** bouton « Choisir un fichier » ; au
    tactile, la zone de dépôt est masquée, il reste le bouton et les consignes). Consignes écrites **avant**
    tout échec : « Fichier CSV (.csv), 16 Mo au plus. » Une ligne par client. Une fois choisi : nom du
    fichier, poids en `data`, lien « Choisir un autre fichier ».
  - **Encart « Ce qui va se passer »** (carte `muted`, texte 17 px, liste de 4 puces, pas de `collapsible`) :
    - « Chaque ligne devient un membre, avec sa ou ses parcelles. Plusieurs lignes du même propriétaire
      donnent un seul membre. »
    - « Une ligne sans adresse postale ni email est ignorée : nous ne saurions pas comment joindre cette
      personne. Elle apparaît dans le rapport. »
    - « Une ligne sans email crée un membre sans compte de connexion : il reçoit ses documents par
      courrier. »
    - « Aucun email n'est envoyé. Vous pouvez relancer le même fichier sans rien créer en double. »
- Actions : bouton `default` « Importer les membres » (48 px, 56 mobile). **Désactivé tant que
  l'association et le fichier ne sont pas choisis, avec la phrase qui dit ce qui manque juste au-dessus**
  (« Choisissez une association et un fichier pour continuer. ») — jamais un bouton grisé seul. Lien
  secondaire « Annuler » vers la liste des associations.
- États :
  - **Vide** : tel que décrit ci-dessus (rien choisi).
  - **Prêt** : association et fichier choisis, bouton actif.
  - **Chargement** : `progress` **indéterminée** + « Import de {nom du fichier} en cours… », bouton au
    libellé « Import en cours… » (largeur conservée, désactivé), formulaire figé. Pas de pourcentage inventé.
  - **Erreur — fichier illisible** (rien n'a été importé) : `alert` `destructive` ancré sous le titre,
    `role="alert"`, 2 px : « Le fichier n'a pas pu être lu. **Rien n'a été importé.** » + la cause en clair
    parmi : « Ce n'est pas un fichier CSV. » · « Le fichier est vide. » · « Il manque la colonne
    « {nom de la colonne} ». » · « Les accents sont mal enregistrés : réenregistrez le fichier en UTF-8. » ·
    « Le fichier dépasse 16 Mo. » Puis l'action : « Choisissez un autre fichier. » Le fichier choisi reste
    affiché.
  - **Erreur — association** : « Cette association n'existe plus. Rien n'a été importé. »
  - **Erreur inattendue** : « L'import s'est arrêté. Les lignes déjà traitées sont enregistrées ; relancer le
    même fichier termine le travail sans rien doubler. » + bouton « Réessayer » (`outline`).

### Écran 2 — Lire le rapport

- Même route, après l'import (le rapport remplace le formulaire). `h1` : « Rapport d'import ».
  Sous le titre : « {nom du fichier} · {association} · {jj/mm/aaaa hh:mm} » (heure en `data`).
- **Alerte de résultat en tête**, ancrée, `role="status"` : `alert` neutre `CircleCheck` en `primary` :
  « Import terminé. {n} membres créés, {m} lignes à relire. » S'il n'y a aucune ligne rejetée :
  « Import terminé. Aucune ligne n'a été rejetée. » Si **toutes** les lignes sont rejetées : `alert`
  `destructive` « Aucun membre n'a été créé. Toutes les lignes ont été rejetées. » (c'est l'écran 2d).
- **Bilan** : une grille de 6 chiffres (cartes sans ombre, chiffre en JetBrains Mono 22 px / 24 mobile,
  libellé dessous en `meta`). **Le chiffre est toujours accompagné de son libellé écrit.**
  1. Lignes lues
  2. Membres créés
  3. Comptes de connexion ouverts
  4. Membres « courrier uniquement »
  5. Parcelles rattachées
  6. Lignes rejetées
  Cas **relance du même fichier** (écran 2c) : « Membres créés » = 0, et une septième mention
  « Déjà présents : {n} » apparaît ; l'alerte dit « Rien de nouveau : ce fichier avait déjà été importé. »
- **Section « Lignes rejetées » (h2)** : introduction « Ces lignes n'ont pas été importées. Les autres
  l'ont été. » Tableau : colonnes **Ligne** (numéro dans le fichier, `data`) · **Client** (nom lu dans la
  ligne, `body-strong`) · **Motif** (phrase écrite). Lignes 56 px, zébrure, en-tête sur `muted` 15 px / 600,
  **aucune action par ligne**. 25 lignes par page (10 sous 640 px), « Précédent / Suivant » écrits.
  Motifs à montrer (écrits, sans jargon) :
  - « Ni adresse postale ni email : personne ne pourrait la joindre. »
  - « Cet email est déjà utilisé par un autre membre. »
  - « Le code postal n'est pas valide. »
  - « Le nom est manquant. »
  Un `badge` n'est jamais l'unique porteur du motif : la phrase écrite est la donnée.
  Vide (0 rejet) : « Aucune ligne rejetée. » sans tableau.
- **Section « Lignes importées avec une remarque » (h2)** : introduction « Ces lignes ont été importées.
  Vérifiez-les si besoin. » Même tableau, colonne **Remarque** à la place de **Motif** :
  - « Plusieurs adresses email : seule la première a été gardée. »
  - « Code postal complété d'un zéro au début. »
  Section absente s'il n'y a aucune remarque.
- **Mobile (390 px)** : tableaux en **cartes empilées** (§3.5) : « Ligne {n} » en `data`, nom en titre,
  motif en dessous ; 10 cartes par page ; bilan en 2 colonnes.
- **Mention de confidentialité**, sous le titre de la section « Lignes rejetées » : icône `Lock` + « Ce
  rapport contient des données personnelles. Il n'est pas conservé : en quittant cette page, vous ne le
  retrouvez qu'en relançant le même fichier. » (pas de téléchargement du rapport dans cette version.)
- Actions en bas : `default` « Retour à l'association » (48 px, 56 mobile) — un seul `default` ; `outline`
  « Importer un autre fichier ».
- États : chargement du tableau (`skeleton` de tableau, pas de formulaire), erreur de page (`alert`
  `destructive` : « Le rapport n'a pas pu s'afficher. L'import, lui, est terminé. »), pagination.

## Contraintes du design system (non négociables)

### Tokens (thème clair unique)

- Surfaces et texte : `background` oklch(1 0 0) · `foreground` oklch(0.22 0.015 250) · `card` identique à
  `background` · `muted` oklch(0.972 0.005 240) · `muted-foreground` oklch(0.45 0.02 245) ·
  `border` oklch(0.9 0.008 245) · `input` oklch(0.66 0.014 245) · `ring` oklch(0.55 0.11 235).
- Actions : `primary` oklch(0.35 0.06 240) · `primary-foreground` oklch(0.985 0.003 240) · `secondary`
  oklch(0.965 0.006 240) · `destructive` oklch(0.48 0.17 27) (texte d'erreur : `destructive-text`, même
  valeur en clair) · `link` oklch(0.45 0.13 250) (toujours souligné).
- Avertissement : `warning` oklch(0.94 0.06 75) · `warning-border` oklch(0.6 0.13 65) ·
  `warning-foreground` oklch(0.3 0.08 60). **Pas de couleur « succès » ni de vert** : le succès est un
  `alert` neutre avec `CircleCheck` en `primary`.
- Zébrure de tableau oklch(0.99 0.002 250) ; survol de ligne = `muted`.
- **Accent de l'association** (teinte 195 par défaut) : identité seulement (monogramme, filet de
  navigation active). **Jamais sur un bouton, jamais seul porteur d'un statut.**
- Polices : titres Source Serif 4 (`h1` 34 px / 600, `h2` 26 px / 600) ; interface Public Sans (`h3`
  20 px / 600, `body` 17 px, `body-strong` 17 px / 600, `label` 16 px / 500, `button` 16-17 px / 600,
  `meta` 15 px) ; chiffres, numéros de ligne, heures, poids de fichier en JetBrains Mono (`data`,
  `tabular-nums`). Aucun texte courant sous 17 px, aucune métadonnée sous 15 px.
- Espacement : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px, **rien hors échelle**. Rayon : 4 px puces, 8 px
  champs, boutons, cartes, 12 px dialogues. Bordures : 1 px `border` ; 2 px `destructive` pour l'erreur ;
  2 px `primary` pour une sélection. **Ombres : aucune** sur cartes et tableaux.
- Focus : `outline: 2px solid var(--ring); outline-offset: 2px`, jamais `outline: none`. Cibles 44 × 44
  minimum, 56 px pour les actions principales sur mobile. Aucune action au survol seul. Mouvement ≤ 200 ms.
- Points de rupture : `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280. Back-office : barre latérale 248 px
  fixe → tiroir (`sheet`) sous `lg`.

### Composants à réutiliser

- `button` : `default` 48 px (56 mobile), `outline`, `destructive`. **Un seul `default` par écran.**
  Libellés à l'infinitif explicite. Chargement : libellé remplacé, bouton désactivé, largeur conservée.
- `form` `label` `select` : libellé au-dessus, toujours visible, champ 48 px (56 mobile), aide sous le
  champ en `muted-foreground`, « Facultatif » écrit, jamais d'astérisque, jamais de placeholder en guise
  de libellé. Erreur : bordure 2 px + message sous le champ + résumé ancré en tête.
- `file-upload` : zone de dépôt **et** bouton « Choisir un fichier » ; types et poids annoncés avant
  l'échec ; au tactile (`pointer: coarse`) pas de zone de dépôt.
- `progress` : **indéterminée** pour un téléversement par Server Action, accompagnée du nom du fichier.
- `table` + `pagination` : lignes 56 px, en-tête sur `muted` 15 px / 600, 25 lignes par page (10 sous
  640 px), « Précédent / Suivant » écrits, jamais de défilement infini. Sous 640 px : cartes empilées.
- `card` : bordure 1 px, sans ombre. `badge` = statut, jamais une action.
- `alert` : ancré dans la page, jamais un toast. Succès : neutre + `CircleCheck` en `primary`,
  `role="status"`. Échec : `destructive`, 2 px, `role="alert"`. Une erreur dit ce qui s'est passé, **ce qui
  est perdu** (ici : rien), et l'action suivante.
- `skeleton` pour listes et tableaux uniquement, jamais un formulaire.
- `breadcrumb` dès le 2ᵉ niveau du back-office. `sidebar` : item actif = fond `sidebar-accent` + libellé
  en 600.
- Icônes lucide, trait 1.75, tailles 16 / 20 / 24, `currentColor`. **Jamais d'icône seule** comme action :
  icône + libellé. Vocabulaire : `Upload`, `FileText`, `Lock`, `CircleCheck`, `AlertTriangle`,
  `UsersRound`, `Map` (parcelle).

### Do / Don't

- ✅ Sobre, aéré, très lisible. **Le mot porte l'information ; la couleur ne fait que renforcer.**
- ✅ Vouvoiement, phrases courtes, typographie française (espace insécable avant `: ; ! ?`, guillemets « »,
  apostrophe courbe). Dates `02/09/2026` en tableau, heures `hh:mm`, unités écrites (Mo).
- ✅ Un message d'erreur dit ce qui est perdu — ici, le plus souvent, que **rien** n'est perdu.
- ❌ Jamais « CSV encodé », « parser », « token », « tenant », « RLS », « dédoublonnage », « idempotent » à
  l'écran. Écrire « relancer le même fichier ne crée rien en double ».
- ❌ Aucune information importante dans un toast, un tooltip ou un `collapsible`.
- ❌ Dégradés, verre dépoli, ombres lourdes, animations d'apparition, densité de tableau de bord SaaS.
- ❌ Aucune donnée bancaire, aucun IBAN : l'import ne les lit pas et l'écran n'en parle pas.

Ne pas inventer de composant, de token ni de couleur hors de cette liste.

## Hors périmètre

- Choix des colonnes à la souris (« mapping » de colonnes), aperçu des lignes avant import, bouton « Contrôler
  sans importer » : non demandés par les critères.
- Téléchargement ou conservation du rapport (données personnelles) ; historique des imports passés.
- Annulation d'un import.
- Résolution des cas ambigus (homonymes, même email pour deux personnes) : ils sont signalés au rapport,
  pas arbitrés à l'écran.
- Plusieurs adresses email par membre, adresse principale / secondaires : autre story.
- Envoi des invitations aux membres importés : s42.
- Import des relevés d'eau (s17), qui réutilisera ce motif d'écran : ne pas en dessiner les colonnes.
- Mode sombre.

## Sortie attendue

Une maquette HTML statique, basse fidélité, des **deux écrans** (déposer le fichier ; lire le rapport), **en
bureau et en mobile (390 px)**, en thème clair, avec les états : écran 1 — vide, prêt, chargement, erreur
fichier illisible ; écran 2 — import avec rejets et remarques (2a), import sans rejet (2b), relance du même
fichier (2c), tout rejeté (2d). Elle n'utilise que les tokens ci-dessus. Rapporter l'export : il sera
enregistré sous `docs/designs/s13-import-initial-membres.html`. Consigner en fin de livraison tout besoin
que le design system ne couvre pas.
