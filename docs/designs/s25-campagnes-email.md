# Design — Story s25-campagnes-email

> Conçu le 2026-11-10, chemin **Claude Design** : brief `docs/designs/s25-campagnes-email-brief.md`,
> livraison rapportée par Marie-Ève le 2026-11-10 (export `s25.zip`, fichier
> `s25 Campagnes email.dc.html`), puis figée ici. Canevas :
> `https://claude.ai/design/p/0fedf332-1358-4b10-aa0a-8ab7828797a8?file=s25+Campagnes+email.dc.html`.
> Source visuelle unique : `docs/design-system.md`. Contexte de code :
> `docs/research/s25-campagnes-email.md`. Validé par Marie-Ève le 2026-11-10.
>
> **Web : mode clair uniquement** ([ADR 033](../decisions/033-mode-clair-seul.md)). **Email : clair et
> « sombre forcé »** (design system §5.2) — certains clients de messagerie imposent le mode sombre.

## Screen(s)

Sept écrans et l'email, chacun en **bureau (1 280 px) et mobile (390 px)**. Données fictives :
« ASL Les Pins » (monogramme « LP », teinte 195), 382 membres dont **296 joignables, 71 sans email, 15
désinscrits** (296 + 71 + 15 = 382).

| Écran | Route                               | Contenu                                                  |
| ----- | ----------------------------------- | -------------------------------------------------------- |
| 0     | barre latérale du back-office       | entrée « Campagnes » dans « L'association »              |
| 1     | `/bureau/campagnes`                 | archive : tableau (cartes sous 640 px), pagination       |
| 2     | `/bureau/campagnes/nouvelle`        | composer : 1 · Modèle, 2 · Message, 3 · Destinataires    |
| 3     | `/bureau/campagnes/nouvelle/apercu` | aperçu avec un membre réel, confirmation, envoi          |
| 4     | `/bureau/campagnes/{id}`            | une campagne archivée, en lecture seule                  |
| 5     | `/bureau/proprietaires/{id}`        | mention « désinscrit » sur la fiche                      |
| 6     | `/desinscription/{jeton}` (public)  | demande, confirmation, déjà fait, lien invalide, échec   |
| E     | l'email reçu                        | habillage commun, 600 px, libre (E1) et convocation (E2) |

- **Écran 0** — « Campagnes » dans « L'association », **après « Propriétaires », sans icône**, actif sur
  toutes les routes `/bureau/campagnes…` ; pas de troisième groupe. Mobile : tiroir « Menu » / « Fermer ».
- **Écran 1** — `h1` « Campagnes », un seul `default` « Écrire une campagne ». Colonnes Objet (sans le
  préfixe « ASL Les Pins — ») · Envoyée le · Par · Modèle · Destinataires (décompte **figé à l'envoi**) ·
  « Consulter ». 25 lignes par page (10 cartes en mobile). Vide : l'action du haut disparaît au profit de
  « Écrire la première campagne ».
- **Écran 2** — trois cartes sur une colonne de 720 px. **Modèle** : `radio-group` de cinq choix (message
  libre présélectionné, puis relance manuelle, facture disponible, convocation à l'AG, documents après
  l'AG), une phrase d'usage chacun, `alert` `warning` « Texte provisoire » pour un modèle. **Message** :
  objet (compteur), texte d'aperçu (facultatif, compteur), `markdown-editor`, liste écrite des variables
  `{nom}` `{parcelle}` `{date}`, ligne « Les réponses arrivent à … ». **Destinataires** : « Tous les
  membres » en texte (pas un champ), trois paires (296 · 71 · 15) et « Membres au total 382 ». Un seul
  `default` « Voir l'aperçu ».
- **Écran 3** — identité de l'aperçu (« Claire Aubert », `select` « Voir avec un autre membre » limité aux
  joignables), objet et texte d'aperçu au-dessus du cadre email, rappel du décompte, « Envoyer à 296
  membres » (`default`, nombre dans le libellé) et « Modifier le message ». Confirmation par
  `alert-dialog` (bouton `destructive` qui nomme l'acte ; ancré en bas en mobile). Envoi : `progress`
  déterminée « 120 sur 296 membres », sans pourcentage écrit, boutons retirés.
- **Écran 4** — `h1` = l'objet, badge `outline` « Envoyée », cartes « Résumé » et « Contenu envoyé »
  (variables **non remplacées** visibles). Aucune action.
- **Écran 5** — badge `outline` « Désinscrit des campagnes » sur la ligne de badges sous le `h1` + phrase
  `meta` datée. Aucune action de ré-inscription.
- **Écran 6** — page publique, texte 18 px, un `h1`, aucun menu, `<AssociationMark />`. **Aucune phrase sur
  ce que le membre continuera de recevoir.**
- **Écran E** — en-tête logo + nom, corps 17 px, pied « facultatif » : mentions, motif, bouton « Ne plus
  recevoir ces campagnes » **doublé de l'URL en clair**, phrase « Se désinscrire ne vous prive d'aucune
  information obligatoire. » Quatre rendus par version : bureau/mobile × clair/sombre forcé.

## Mockup

`docs/designs/s25-campagnes-email/index.dc.html` (+ `BO.dc.html`, `Desinscription.dc.html`,
`Email.dc.html`, `support.js`) — canevas Claude Design, ouvert via le stub
`docs/designs/s25-campagnes-email.html`. **NE PAS copier en production** : l'Execute construit les écrans
avec les vrais composants.

⚠️ **Écart à la convention des maquettes précédentes** : les maquettes s04 à s24 sont des HTML statiques
autonomes (runtime `support.js` / `<x-dc>` retiré). Celle-ci est conservée **telle que livrée**, avec son
runtime, qui charge React et Babel depuis `unpkg.com` : elle ne s'ouvre qu'avec un accès réseau. Aucun
navigateur n'était disponible pour la rendre en statique. À normaliser plus tard si on y tient ; ce n'est
pas bloquant pour le plan.

## Reused components (from the design system)

- **`sidebar`** — l'entrée « Campagnes » ; **`breadcrumb`**, **`separator`**.
- **`table`** / cartes empilées (§3.5), **`pagination`**, **`badge`** (`outline`), **`skeleton`**.
- **`button`** — `default` / `outline` / `destructive` / `link` ; jamais `sm` côté public.
- **`form` `label` `input` `select` `radio-group`**, compteur de caractères (§3.9), **`markdown-editor`**
  (barre réduite).
- **`alert`** — succès neutre (`CircleCheck` `primary`), échec `destructive` 2 px (`role="alert"`),
  avertissement `warning` ; **`alert-dialog`** — remplacement du texte, confirmation d'envoi.
- **`progress`** — déterminée (envoi), **`<AssociationMark />`** — page publique et email.
- **Icônes** — `CircleCheck`, `AlertTriangle`, `ArrowLeft` ; rien d'autre.
- **Email** — charte §5 (tables, hexadécimal, `Georgia` / `Helvetica`), jumelles sombres §5.2.

## States

- **Écran 1** : a rempli · b vide · c chargement · d erreur.
- **Écran 2** : a modèle (texte provisoire) · b libre vierge · c erreurs de saisie · d compteur dépassé ·
  e variable inconnue · f modèle appliqué · g aucun destinataire · h remplacer le texte ? · i décompte en
  chargement.
- **Écran 3** : a aperçu modèle · b aperçu libre · c chargement · d variable inconnue (pas d'aperçu) ·
  e confirmation · f envoi en cours · g envoi terminé · h envoi interrompu · i aucun email parti · j échec
  avant envoi.
- **Écran 4** : a normale · b chargement · c introuvable.
- **Écran 5** : a désinscrit · b non désinscrit · c désinscrit et sans email.
- **Écran 6** : a demande · b confirmée · c déjà désinscrit · d lien invalide · e échec technique.
- **Écran E** : E1 libre · E2 convocation (avec cadre de boîte de réception).

## Design system gaps

À consigner ; **rien n'a été comblé**.

1. **Entrée « Campagnes »** — retenue dans « L'association » après « Propriétaires », sans icône. À
   inscrire au design system (§2.1, `sidebar`).
2. **`radio-group` à cinq choix** — écart à §2.1 (« `select` au-delà de trois »), assumé : un `select`
   masquerait la phrase d'usage de chaque modèle. À inscrire en §3.1.
3. **« Texte provisoire »** — `alert` `warning` à la composition + ligne en gras dans le corps du modèle.
   Aucun composant nouveau ; à verser au design system si le motif revient (autres modèles de s27b, s42).
4. **Variables** — liste écrite, pas de bouton d'insertion : des boutons `sm` (40 px) passent sous la cible
   de 44 px et `markdown-editor` n'insère pas au curseur.
5. **Adresse de réponse** — ligne `meta` en lecture seule, sans lien vers les Réglages : le design system
   ne dit pas où se montre une donnée issue des Réglages.
6. **Envoi en cours** — `progress` déterminée « n sur N membres », sans pourcentage ; à inscrire en §2.1.
7. **Mention « désinscrit »** — badge `outline` + phrase `meta`, sans carte ni action. Un refus n'est pas
   un statut de workflow (§3.10) : écart léger, à confirmer.
8. **Page de préférences d'envoi** (§9, manque bloquant) — seule la confirmation d'un refus est dessinée.
   Préférences par type d'envoi, ré-inscription par le membre, désinscription depuis l'espace membre :
   **non dessinés**, restent un manque.

## À trancher au plan

- **Plafond de l'objet** (ÉCART de la maquette) — le compteur de 60 porte sur le champ seul ; avec le
  préfixe « ASL Les Pins — » (15 caractères) l'objet reçu peut atteindre 75, au-delà des 60 de §5.6.
  Plafonner le champ à 45, ou calculer le plafond **depuis la longueur du préfixe** (le nom est un
  paramètre du tenant) — la seconde évite un chiffre en dur.
- **Ligne « [Texte provisoire — à remplacer avant l'envoi] »** — elle part réellement si le bureau ne la
  supprime pas. La traiter comme une variable inconnue (envoi bloqué) est une **règle produit** à trancher.
- **Reprise après interruption** — aucun « Réessayer » (risque de doublon) ; reprendre l'envoi aux seuls
  restants est un besoin technique non couvert. Lié au point d'interception de s26 et à la ligne d'envoi
  par destinataire (question ouverte n° 3 de la recherche).
- **Lien de désinscription** — la maquette fait **confirmer** par un bouton « Me désinscrire » (état 6a),
  puis affiche « C'est enregistré » (6b). Si le plan retient un GET qui écrit directement, seul l'état 6b
  est montré ; le choix reste celui de la question ouverte n° 2 de la recherche.
- **Adresse de réponse et expéditeur**, mentions du pied (raison sociale, adresse, SIRET : illustratives,
  clés de Réglages à créer), **syntaxe des variables** (`{nom}` retenu par la maquette) et valeur de
  `{parcelle}` pour 0 ou plusieurs parcelles : questions ouvertes n° 4, 5 et 6 de la recherche.
- **Lever le refus depuis la fiche** (ré-inscription par le bureau) : non dessiné.
- **Valeurs** : plafonds de caractères (60 / 90 de §5.6), taille de page (25 / 10), focus à l'ouverture et à
  la fermeture des `alert-dialog` (proposition : « Revenir à l'aperçu » en premier).
- **Tâches de tokens** : `--table-stripe` et `--table-row-hover` entrent dans `globals.css` avec la
  première story qui touche un tableau du bureau (§1.9) — vérifier si c'est déjà fait ; jumelles sombres
  d'email de §5.2 à porter dans `src/lib/emails/theme.ts` (la story qui envoie le premier email concerné,
  donc celle-ci).

## Ce que ce design ne couvre pas

Le ciblage (impayés, groupes), l'envoi échelonné et le plafond quotidien, les statistiques et le journal
par membre, le brouillon / la planification / la duplication / le renvoi, l'édition des modèles, le pied
« statutaire », le publipostage papier, la page de préférences à plusieurs cases, la ré-inscription, le
téléphone du bureau, la saisie des Réglages (raison sociale, adresse, mentions).
