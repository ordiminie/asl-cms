# Brief pour Claude Design — Design system global ASL-CMS

> **Usage** : à coller dans Claude Design (ou Gemini). La sortie revient ensuite ici et est
> capturée dans `docs/design-system.md` par `/ks-design-system`. Ce brief ne conçoit rien :
> il cadre.
>
> **Deux hypothèses à valider avant de coller** — elles sont signalées 🔸 dans le texte :
> la personnalisation par association, et le mode sombre.

---

## 1. Le produit

**ASL-CMS** (nom commercial provisoire : *Lp*) — plateforme SaaS multi-tenant pour les
**associations syndicales libres de terrains de vacances** en France. Un client signé
(ASL La Fourche, 400 propriétaires), cinq prospects au profil identique. Chaque association
a **son propre nom de domaine et son propre site**.

Ce sont des associations de propriétaires de parcelles qui gèrent en commun l'eau (compteurs
individuels, analyses, fuites), la voirie et les cotisations. Le bureau est **bénévole**.
Aujourd'hui, elles fonctionnent au courrier, au tableur et au bouche-à-oreille.

Le produit a **deux faces** :

- un **site public** — vitrine éditable et référencée : accueil, actualités, présentation du
  bureau, page « je viens d'acquérir un terrain », résultats d'analyses d'eau, contacts utiles,
  contact, signalement de fuite. **Consultable sans compte.**
- un **espace privé** — espace membre (ses factures, sa consommation d'eau, ses documents
  nominatifs) et back-office du bureau (édition du site, communication par email, gestion des
  membres et des signalements).

## 2. Les gens

| Qui | Combien | Ce qu'il faut retenir |
| --- | --- | --- |
| **Visiteur** | — | Futur acquéreur, riverain, curieux. Aucun compte. Cherche une information précise. |
| **Membre propriétaire** | jusqu'à 400 | **Souvent âgé, peu à l'aise avec l'informatique.** Présent une partie de l'année seulement. Se connecte **rarement**, pour une raison précise : sa facture, sa consommation, un document. Environ un quart n'a **aucune adresse email**. |
| **Bureau** | 3 à 8 | Bénévoles élus, **non techniciens**, qui changent tous les quelques années. Ce sont eux qui font vivre le site. **Leur temps est la ressource la plus rare du projet.** |
| **Présidente** | 1 | Membre du bureau avec quelques actions réservées. |
| **SuperAdmin** | interne | Support et débogage. Non exposé aux associations, ergonomie non prioritaire. |

## 3. Ce que le design doit rendre vrai

Quatre exigences, par ordre d'importance. Les deux premières sont contractuelles.

1. **Le bureau publie sans le prestataire.** Critère de recette, mesuré en conditions réelles :
   un membre du bureau, **seul devant l'écran**, crée et publie une page, une actualité et une
   analyse d'eau. S'il n'y arrive pas, le produit a échoué, quel que soit le reste.
   La référence d'ergonomie visée est celle d'un éditeur de pages type **WordPress / Payload**.
2. **Un membre accède à ses données, et à rien qui appartienne à un autre.** Ce qui est
   personnel doit se *voir* comme personnel.
3. **La lisibilité prime sur l'élégance.** Public âgé : contrastes francs, corps de texte
   généreux, cibles cliquables larges, libellés explicites, aucun jargon. Pas d'interaction au
   survol seul, pas d'information portée par la seule couleur.
4. **La saisie d'une analyse d'eau est fréquente** — au moins mensuelle. Elle demande une
   saisie rapide, pas un formulaire lourd.

## 4. Le ton

Une **association syndicale**, pas une startup. Institutionnel, sobre, rassurant, clair.
Le registre est celui d'un service public local de proximité : on informe, on rend des comptes,
on met à disposition. Le contexte est un domaine de terrains de vacances — nature, eau, chemins —
sans que cela vire au décoratif.

- ✅ Sobre, aéré, très lisible, hiérarchie évidente, vocabulaire courant
- ❌ Dégradés spectaculaires, animations d'apparition, verre dépoli, ombres portées lourdes
- ❌ Densité type tableau de bord SaaS — surtout côté membre, qui vient chercher une chose
- ❌ Illustrations génériques de banque d'images

## 5. Contraintes techniques — le format de sortie

Le produit est bâti sur **Tailwind CSS 4** et **shadcn/ui (style `new-york`)**, avec des
variables CSS en **OKLCH** et un mode clair et sombre. La sortie doit s'exprimer **dans ce
vocabulaire**, sinon elle n'est pas implémentable.

### Tokens de couleur — noms imposés

Ne pas inventer de nouveaux noms. Fournir une valeur pour chacun, **en clair et en sombre** :

```
background / foreground        card / card-foreground
popover / popover-foreground   primary / primary-foreground
secondary / secondary-foreground   muted / muted-foreground
accent / accent-foreground     destructive / destructive-foreground
border   input   ring   link
chart-1 … chart-5
sidebar / sidebar-foreground / sidebar-primary / sidebar-primary-foreground /
sidebar-accent / sidebar-accent-foreground / sidebar-border / sidebar-ring
```

**Valeurs actuelles** (thème shadcn neutre `stone`, à remplacer) : `primary` vaut
`oklch(0.216 0.006 56.043)` — un quasi-noir chaud, sans couleur de marque ; `link` vaut
`oklch(0.52 0.17 255)`, un bleu ; le rayon `--radius` vaut `0.625rem`.

### Typographie — à définir entièrement

⚠️ **Aucune police n'est configurée aujourd'hui** : le `<body>` ne porte aucune classe et le
projet n'utilise pas `next/font`. La typographie tombe sur la pile par défaut du navigateur.

Attendu : une famille de titres, une famille de texte, et une **échelle typographique
complète**. Contrainte forte — le corps de texte par défaut doit être confortable pour un
lecteur âgé ; ne pas descendre sous 16 px pour le texte courant, et prévoir des libellés de
formulaire lisibles plutôt que discrets.

### Accessibilité — non négociable

Cible **WCAG 2.1 AA au minimum**, et viser AAA sur le corps de texte du site public.
Le `muted-foreground` actuel est à la limite de AA sur fond blanc : c'est précisément le genre
de token à corriger, pas à reprendre.

### Composants disponibles

Le système doit **composer avec ces 37 composants**, déjà présents. Un besoin qu'ils ne
couvrent pas est un *manque à signaler*, pas un composant à inventer.

`alert` `alert-dialog` `avatar` `badge` `breadcrumb` `button` `card` `chart` `checkbox`
`code-block` `collapsible` `command` `dialog` `dropdown-menu` `file-upload` `form` `input`
`label` `markdown-editor` `pagination` `popover` `progress` `radio-group` `scroll-area`
`select` `separator` `sheet` `sidebar` `skeleton` `sonner` (toasts) `switch` `table` `tabs`
`textarea` `toast` `tooltip`

Icônes : **lucide**.

## 6. Multi-tenant — ce qui varie d'une association à l'autre

Six associations partagent le même déploiement. Rien de propre à La Fourche ne doit être figé
dans le design.

🔸 **Hypothèse à valider** : chaque association fournit **son logo** et **une couleur
d'accent**, et rien d'autre. Le reste de la palette est commun. C'est ce qui permet à chaque
site de paraître « le sien » sans qu'aucun bureau bénévole ne puisse produire un site illisible.

**Conséquence pour la conception** : la couleur d'accent est une **variable**. Le système doit
rester lisible et cohérent quelle que soit sa teinte, et ne jamais dépendre d'elle pour porter
une information. Fournir la palette avec une couleur d'accent de référence, et indiquer les
règles d'usage qui la rendent interchangeable.

## 7. Écrans à concevoir, par ordre de priorité

1. **Back-office — éditeur de page en blocs.** *Le plus important.* Une page est une liste
   ordonnée de blocs typés (texte riche, image + légende, document PDF, galerie, encart),
   réordonnables par glisser-déposer, avec aperçu avant publication et cycle
   brouillon → publié → dépublié. C'est l'écran dont dépend le critère de recette.
2. **Back-office — saisie rapide d'une analyse d'eau.** Quatre champs (date, affiche, texte
   facultatif, PDF), saisis chaque mois. Optimiser le temps de saisie.
3. **Site public — accueil**, avec le **bandeau d'alerte global** (coupure d'eau, travaux) que
   le bureau active et désactive lui-même. Montrer la page avec et sans bandeau.
4. **Espace membre — accueil.** Ce que voit un propriétaire âgé qui se connecte deux fois par
   an : ses factures, sa consommation d'eau, ses documents. Peu d'éléments, très lisibles.
5. **Site public — liste des actualités et article.** Modèle de contenu daté et répétable.
6. **Back-office — liste des membres**, avec recherche et pagination. Modèle des écrans de
   gestion (signalements, campagnes, impayés reprendront ce patron).

## 8. Mode clair et sombre

🔸 **Hypothèse à valider** : les deux thèmes sont demandés. Le socle technique définit déjà les
deux jeux de tokens, et le rendu de documentation lit le thème actif.

Si le mode sombre est abandonné, le dire — cela réduit de moitié la vérification visuelle de
42 stories, pour un public qui ne le réclame pas.

## 9. Ce que j'attends en retour

Par ordre d'utilité :

1. **Le jeu de tokens complet** — une valeur par nom de la liste du §5, en clair et en sombre,
   en OKLCH ou en hex. C'est le livrable indispensable : sans lui, rien n'est implémentable.
2. **La typographie** — familles, échelle, graisses, hauteurs de ligne.
3. **Les maquettes** des écrans du §7, dans l'ordre.
4. **Les règles d'usage** — quand utiliser `primary` plutôt que l'accent, comment se présentent
   les états vide / chargement / erreur / succès, comment se signale une donnée personnelle.
5. **Les manques** — tout besoin que les 37 composants ne couvrent pas, signalé comme tel.

Le rayon, l'échelle d'espacement et les états de focus doivent être explicites : ils seront
traduits en tokens Tailwind, pas réinterprétés.
