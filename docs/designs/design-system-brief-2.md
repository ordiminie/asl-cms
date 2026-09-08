# Brief n° 2 pour Claude Design — Médias transverses et manques

> **Usage** : à coller dans Claude Design. Fait suite au brief n° 1 et à sa livraison, capturée
> dans `docs/design-system.md`. La sortie sera capturée au même endroit.
>
> Ce brief **ne rouvre rien** de ce qui a été livré. Il comble ce qui manque : deux médias
> entiers (email, papier), deux bandeaux persistants, et quatre points laissés ouverts.

---

## 0. À lire avant tout — le périmètre interdit

Le brief n° 1 ne mentionnait pas cette liste, et la livraison a proposé de bonne foi un écran
qui a dû être écarté. Voici donc, explicitement, **ce que le produit a délibérément choisi de
ne pas faire**. Une proposition qui entre dans cette liste ne peut pas être retenue, même
excellente.

- ⛔ **Aucun plan B de connexion pour les membres sans adresse email.** Ils n'ont **aucun
  compte**, aucun code d'activation, aucun identifiant de secours. C'est une décision produite
  et contractuelle. La réponse à leur situation est le **publipostage papier** — objet du lot 2
  de ce brief.
- ⛔ **Aucun mot de passe, nulle part.** La connexion se fait **uniquement par lien magique**
  envoyé par email, valable 4 heures. Pas de mot de passe à choisir, pas de mot de passe oublié.
- ⛔ **Aucun paiement dans le produit.** Le paiement est une simple redirection sortante ;
  aucune donnée bancaire n'existe côté site.
- ⛔ **Aucune logique de vote** (dépouillement, quorum, procurations) : externalisée.
- ⛔ **Aucune messagerie entre membres**, aucun assistant IA, aucun tableau de tâches, aucune
  carte interactive (le plan des parcelles est une image téléversée).

## 1. Ce qui est déjà acquis — à respecter, pas à redéfinir

La livraison n° 1 a fixé le système et il fait autorité. Rappel de ce qui contraint ce lot :

**Tokens** (thème clair unique, mode sombre abandonné) :

```
--background oklch(1 0 0)              --foreground oklch(0.22 0.015 250)
--muted oklch(0.972 0.005 240)         --muted-foreground oklch(0.45 0.02 245)
--border oklch(0.90 0.008 245)         --input oklch(0.66 0.014 245)
--ring oklch(0.55 0.11 235)            --primary oklch(0.35 0.06 240)
--primary-foreground oklch(0.985 0.003 240)
--secondary oklch(0.965 0.006 240)     --secondary-foreground oklch(0.30 0.02 245)
--destructive oklch(0.48 0.17 27)      --link oklch(0.45 0.13 250)
--accent      oklch(0.958 0.024 var(--accent-hue))
--accent-foreground oklch(0.38 0.08 var(--accent-hue))
--accent-solid      oklch(0.55 0.10 var(--accent-hue))
--radius 0.5rem
```

**Accent** : `--accent-hue` est la **seule** variable d'association. Six teintes validées —
195 eau · 150 pins · 255 lac · 40 tuile · 300 bruyère · 95 genêt. Lightness et chroma figés.
Jamais sur un bouton, jamais porteur unique d'une information.

**Typographie** : *Source Serif 4* (titres) · *Public Sans* (texte et interface) ·
*JetBrains Mono* (index de compteur, parcelles, montants). Texte courant 17 px en privé,
18 px en public. Plancher 15 px pour les métadonnées.

**Règles** : aucune information portée par la seule couleur · icône + libellé, jamais l'icône
seule · cible 44 × 44 · focus `outline 2px var(--ring)` + offset 2px · vouvoiement, phrases
courtes, aucun jargon · unités écrites (m³, €) · typographie française.

**Public** : propriétaires souvent âgés, peu à l'aise avec l'informatique, se connectant
rarement. Bureau de 3 à 8 bénévoles non techniciens.

---

## Lot 1 — Le gabarit d'email · **priorité la plus haute**

C'est le manque le plus lourd : un **médium entier** non couvert. Le bureau communique
principalement par email, et la moitié des stories de communication en dépendent.

### Contraintes du médium — elles changent tout

- **Pas de Tailwind, pas de variables CSS.** Tables, styles en ligne, largeur 600 px.
  L'implémentation se fera avec `react-email`.
- ⚠️ **OKLCH n'est pas interprété par tous les clients de messagerie.** Chaque token utilisé
  dans un email doit être livré **en hexadécimal**, avec sa correspondance explicite au token
  du système. C'est un livrable à part entière de ce lot.
- Certains clients (Outlook sombre, Gmail Android) **forcent leur propre inversion**. Indiquer
  ce qui doit rester lisible dans ce cas, et ce qui peut être sacrifié.
- Beaucoup de destinataires liront sur un téléphone, en mobile, avec les images bloquées par
  défaut : **rien d'indispensable ne doit vivre dans une image**.

### Le gabarit commun

En-tête avec le **logo de l'association** et pied de page avec les mentions obligatoires. Il
enveloppe aussi bien les 4 modèles que la campagne libre — la campagne libre n'est **pas** un
cas à part dépourvu d'habillage.

### ⚠️ Deux pieds de page, pas un

Point souvent manqué, et juridiquement structurant. Les communications se divisent en deux
natures :

| Nature | Exemples | Pied de page |
| --- | --- | --- |
| **Facultative** | actualité, campagne libre | **Lien de désinscription** obligatoire |
| **Statutaire** | convocation à l'AG, mise à disposition d'une facture, relance d'impayé | **Pas de désinscription** — mais une phrase qui explique pourquoi cet envoi continue malgré une désinscription |

Un membre désinscrit cesse de recevoir les premières et **continue** de recevoir les secondes.
Le pied doit le dire clairement, sans que le membre se sente piégé.

### Les 5 envois à maquetter

1. **Convocation à l'assemblée générale** — statutaire. Date, lieu, ordre du jour, modalités de
   vote par anticipation, pièces jointes.
2. **Facture disponible dans l'espace membre** — statutaire. Doublonne volontairement un envoi
   du comptable ; ne pas donner l'impression d'un doublon d'erreur.
3. **Relance d'impayé** — statutaire, envoyée jusqu'à 3 fois. **Ton ferme mais non humiliant** :
   le destinataire est un voisin et un adhérent, pas un mauvais payeur. Les 3 relances doivent
   se distinguer sans devenir agressives.
4. **Publication de documents après l'AG** — statutaire. Liste de documents avec liens.
5. **Campagne libre** — facultative. Titre, texte riche, éventuelle image, un bouton d'action.

Prévoir aussi le **lien magique de connexion** (transactionnel, très court, une seule action —
c'est la porte d'entrée de 300 personnes âgées, il doit être impossible à rater) et
l'**invitation initiale** au lancement du service.

### Variables dynamiques

Le contenu rédactionnel des 4 modèles est encore à écrire avec le bureau : maquetter avec un
texte de remplacement crédible et signaler les variables (nom, parcelle, date, montant, échéance)
par une convention visuelle claire.

---

## Lot 2 — Publipostage papier et impression

**C'est l'angle n° 2 du produit** : sur 400 propriétaires, **100 n'ont aucune adresse email** et
sont aujourd'hui hors de tout système. Le publipostage les réintègre dans le **même flux** que
les autres, sans double saisie pour le bureau. Ce lot n'a aujourd'hui aucune existence visuelle.

### 2.1 — La lettre de publipostage

Une campagne produit un PDF prêt à imprimer et à poster, une page par destinataire.

- **A4, recto**, en noir et blanc lisible (le bureau imprime souvent sans couleur) — la couleur
  ne doit jamais porter l'information.
- **Bloc adresse destinataire positionné pour une enveloppe à fenêtre.** Confirmer les mesures
  retenues, c'est une contrainte physique qui ne se rattrape pas après impression.
- En-tête de l'association, coordonnées de l'expéditeur, date, objet.
- **Le contenu doit dire la même chose que l'email équivalent** : c'est la promesse du produit.
  Là où l'email a un lien, la lettre a l'information écrite ou une adresse en clair.
- Bloc de pied : coordonnées du bureau, mention de l'envoi papier.

### 2.2 — Règles d'impression du site

Trois documents seront imprimés par des membres qui classent sur papier :

- **une facture** — doit être imprimable telle quelle, sans mise en page cassée ;
- **un document nominatif ou partagé** (convocation, PV, statuts) ;
- **une analyse d'eau**.

Attendu : une feuille de règles d'impression — ce qui disparaît (navigation, boutons, bandeaux),
ce qui apparaît (URL en clair sous les liens, date d'impression), les marges, la taille du texte
et le passage en noir et blanc.

### 2.3 — Modèles de documents générés

Convocation, procès-verbal, courrier type — générés à l'unité **et en lot** pour un groupe.
Un gabarit de document institutionnel commun suffit : en-tête, titre, corps, signature.

---

## Lot 3 — Les bandeaux persistants

La livraison n° 1 a spécifié `<PreviewBar />`. Deux membres de la même famille manquent. Ils
partagent un principe : **une bande qui dit en permanence dans quel état on se trouve**, hors
palette de contenu pour ne jamais se confondre avec la page.

### 3.1 — `<ImpersonationBar />` · simulation de rôle

Le prestataire (SuperAdmin) peut consulter le site **avec les droits d'un autre rôle** pour
reproduire un incident, sans demander ses accès au bureau.

- Doit être **visible en permanence et impossible à ignorer** : tant qu'elle est là, ce qui est
  affiché n'est pas ce que voit le vrai utilisateur.
- Doit annoncer **qui est simulé** et permettre de **revenir à soi en un geste**.
- Les écritures effectuées pendant la simulation sont tracées au compte du prestataire : le
  bandeau doit **prévenir avant une action d'écriture**, pas après.
- Doit se distinguer de `<PreviewBar />` au premier coup d'œil — ce sont deux états très
  différents et les confondre serait dangereux.

### 3.2 — `<AlertBanner />` · bandeau d'alerte global

Coupure d'eau, travaux, urgence. Activé, modifié et désactivé par **n'importe quel membre du
bureau**. Il apparaît dans la maquette d'accueil de la livraison n° 1, mais n'a aucun contrat
de composant.

- Trois niveaux d'urgence au moins, **distingués autrement que par la couleur**.
- Un texte libre, une date de fin facultative, un lien facultatif.
- Pleine largeur, persistant, au-dessus de tout — y compris sur mobile, où il ne doit pas
  manger la moitié de l'écran.
- Peut-il être refermé par le visiteur ? Trancher et justifier : une alerte de coupure d'eau
  refermable trop facilement rate sa cible, une alerte non refermable gêne la navigation.

---

## Lot 4 — Le rendu public des blocs de contenu

Le système définit les 5 types de blocs **côté édition**. Il ne dit pas ce que chacun donne sur
le site public. Sans cela, chaque story de contenu réinventera sa mise en page.

Pour chacun : **Texte riche** · **Image + légende** · **Document PDF** · **Galerie** ·
**Encart** — attendu le rendu public, en ordinateur et en mobile, avec largeur, espacements,
comportement du texte long, et l'état « le fichier est absent ».

Deux cas particuliers à traiter :

- **Le bloc PDF** est le support des **analyses d'eau**, publiées au moins une fois par mois et
  consultables **sans compte**. Il doit donner envie d'être ouvert et annoncer son poids.
- **L'encart** est le seul bloc où la teinte de l'association s'exprime dans le contenu.

---

## Lot 5 — Deux composants signalés, non spécifiés

Le §14 de la livraison n° 1 signalait cinq manques ; trois ont été spécifiés. Restent deux, dont
**l'éditeur de page dépend** — donc le critère de recette contractuel avec lui.

### 5.1 — `<SortableList />` · liste réordonnable

Le glisser-déposer des blocs. À construire sur `@dnd-kit`, déjà présent.

**Contrainte majeure** : le glisser-déposer est difficile pour une main âgée ou tremblante.
Il faut donc **une alternative complète** — « Monter » / « Descendre » accessibles au clavier et
au doigt, jamais cachées derrière un survol. Prévoir aussi : la poignée (`GripVertical`),
l'emplacement de dépôt, l'état pendant le déplacement, et l'annulation.

### 5.2 — `<BlockPicker />` · insertion d'un bloc

À monter sur `command` + `popover`. Cinq types, chacun avec un nom en clair et un aperçu de ce
qu'il produit — le bureau doit comprendre « Encart » sans l'avoir essayé. Insertion **à un
endroit précis** de la page, pas seulement à la fin.

---

## Lot 6 — L'écran de connexion

Il n'existe pas : le seul écran d'authentification livré reposait sur un flux écarté (voir §0).
C'est l'une des toutes premières stories, et la première expérience de 300 personnes âgées.

**Le flux complet, et rien de plus** : le membre saisit son adresse email → il reçoit un lien →
il clique → il est connecté. Pas de mot de passe, pas d'inscription libre (les comptes sont
créés par le bureau).

Écrans et états attendus :

1. **Saisie de l'adresse** — un seul champ, une seule action.
2. **« Consultez votre boîte mail »** — l'écran le plus important : il faut dire quoi faire,
   combien de temps le lien reste valable (**4 heures**), et quoi faire si rien n'arrive
   (vérifier les indésirables, redemander un lien, appeler le bureau).
3. **Lien expiré** — sans culpabiliser, avec l'action de redemander.
4. **Adresse inconnue** — cas fréquent et délicat : le membre existe peut-être **sans compte**
   (il est dans les 100 sans email). Le message doit l'orienter vers le bureau **sans jamais
   révéler si l'adresse est connue**.
5. **Déjà connecté**, et **déconnexion**.

---

## Lot 7 — Deux points de détail

- **Le logo de l'association** : formats acceptés, ratio, taille maximale, rendu sur fond clair,
  et **ce qui s'affiche quand une association n'en a pas encore** — le cas au provisioning.
  Il apparaît sur le site, dans le back-office, dans les emails et sur les lettres papier : les
  quatre contextes doivent être couverts.
- **Le tableau en mobile** : le système fixe les lignes à 56 px et 25 lignes par page, mais ne
  dit pas ce que devient un tableau sous 640 px. Trancher un patron unique — cartes empilées,
  colonnes masquées par priorité, ou défilement horizontal — et le justifier.

---

## Ce que j'attends en retour

Par ordre d'utilité :

1. **Le gabarit d'email**, avec sa **table de transposition OKLCH → hexadécimal**, et les deux
   variantes de pied de page. C'est le livrable indispensable.
2. **La lettre de publipostage A4** et la feuille de règles d'impression.
3. **`<ImpersonationBar />`** et **`<AlertBanner />`**, spécifiés comme l'ont été `<PreviewBar />`
   et `<MeterInput />` : tous les états, l'API, le clavier, l'accessibilité.
4. **Le rendu public des 5 blocs**, ordinateur et mobile.
5. **`<SortableList />`** et **`<BlockPicker />`**, avec l'alternative sans glisser-déposer.
6. **Les écrans de connexion**, dans l'ordre du parcours.
7. **Logo et tableau mobile.**

Comme au premier tour : tout doit s'exprimer dans les tokens et les composants existants, et
tout manque doit être **signalé comme tel** plutôt que comblé par une invention.
