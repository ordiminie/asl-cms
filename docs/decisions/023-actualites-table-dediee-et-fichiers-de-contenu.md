# ADR 023 — Actualités : une table `news` dédiée, et une chaîne de fichiers de contenu partagée

- Status: accepted
- Date: 2026-09-22
- Scope: story s05-actualites
- Précise l'ADR 009 sur un point : `post` n'est **pas** la base des actualités.

## Context

s05 livre le deuxième modèle de contenu du produit, après les pages de s04, et le premier des
trois **modèles répétables** : actualités (s05), fiches du bureau (s06), analyses d'eau (s09). La
story demande de factoriser **maintenant** tout motif commun, avant que s09 ne fige une troisième
implémentation divergente. La recherche (`docs/research/s05-actualites.md`, pièges 1 à 4) a relevé
quatre contradictions ou manques.

**Les documents se contredisent sur le support des actualités.**

- L'ADR 009 (l. 104, 130) et le classement RLS de `docs/architecture.md` désignent `posts` comme
  « base des actualités ».
- L'ADR 007 et `docs/architecture.md` (Data model) décrivent un modèle `news` à **champs fixes**.

Le code tranche :

- **La forme de `posts` ne correspond pas.** Elle est multilingue (`posts_translation`), alors que
  l'ADR 008 fixe `fr` seule. Son slug est **unique globalement**, l'anti-patron que s04 a refusé pour
  `page`. Catégories et hashtags sont uniques globalement. Il n'y a **ni date de publication ni
  image**, soit deux des quatre champs du critère 1 de s05.
- **Le blog hérité est vivant.** `/blog`, `/admin/blog` (SuperAdmin), `sitemap.ts`, le seed et les
  articles MDX de `content/blog/` lisent `posts` **hors de tout scope de tenant**. Sous RLS forcée,
  tous deviendraient vides, sans erreur.

**Le contenu d'une actualité** n'a pas à être une liste de blocs : l'ADR 007 réserve les blocs aux
pages. `content_block.page_id` est `NOT NULL` et sa policy joint `page`. Y loger une actualité
modifierait le schéma de s04.

**La chaîne de fichiers de s04 est liée à la page.**

- La clé est `{org}/pages/{pageId}/…`, et `isPageBlockFileKeyAllowed` n'accepte que ce préfixe.
- La route est `/api/pages/files`.
- `uploadPageBlockFileService` vérifie l'existence d'une page.

Seule la validation par **signature binaire** (`validatePageBlockFile`) est déjà générique. s06
(photo d'une fiche) et s09 (PDF d'analyse) auront le même besoin.

## Decision

1. **Une table `news` dédiée, à champs fixes**, scopée par `organization_id` sous RLS forcée
   (ADR 002), avec :
   - `slug`, nullable. Il est fixé au **premier enregistrement qui porte un titre**, puis **jamais
     recalculé** : c'est l'URL stable du critère 2. L'unicité porte sur `(organization_id, slug)`.
   - `title` et `published_on` (`date`, sans heure ni fuseau).
   - `image_key`, suffixe `_key`, qui suit la seule convention de colonne de clé de fichier déjà en
     base (`identity_logo_key`) et que l'inventaire de s12c lira. S'y ajoute `image_alt`.
   - `content` : un **seul champ markdown**, rendu par la **même** chaîne sanitisée que le bloc texte
     de s04 (ADR 019).
   - `status` : `draft | published | unpublished`, dans son propre enum `news_status`.
   - `created_at` et `updated_at`.

   Tri public : `published_on desc, created_at desc, id desc`. Le départage est stable, pour que la
   pagination ne saute ni ne répète une ligne.

2. **`posts` et le blog hérité ne sont pas touchés.** Ils restent au classement RLS « exemptées »,
   mais avec une justification réécrite : c'est le blog du boilerplate, sans usage dans le produit,
   **pas** une table en attente de scoping. Leur retrait ou leur désactivation est l'affaire d'une
   story dédiée. Sur ce point, cette décision **remplace** la phrase de l'ADR 009 « `post` (base des
   actualités s05) ».
3. **Une chaîne de fichiers de contenu partagée**, dont les pages de s04 deviennent le premier
   client :
   - **Un module de domaine isomorphe** (`content-file-types.ts`) décrit des **portées** (`pages`,
     `news` ; s06 et s09 y ajouteront la leur), construit la clé
     `{organizationId}/{portée}/{ownerId}/{slotId}-{uuid}.{ext}` et vérifie qu'une clé lue dans une
     requête vit sous une portée enregistrée de l'association résolue par le domaine.
     `buildPageBlockFileKey` et `isPageBlockFileKeyAllowed` deviennent des enveloppes de ce module :
     les clés déjà stockées par s04 restent valides, octet pour octet.
   - **Un seul service de lecture et une seule route publique**, `GET /api/files/[...key]`.
     `/api/pages/files/[...key]` reste servie par **le même** gestionnaire, pour ne casser aucune
     adresse déjà rendue : une implémentation, deux chemins.
   - La validation par signature binaire et les plafonds de poids sont ceux de s04, réemployés tels
     quels.
4. **Tailles de page d'affichage** (10 actualités par page côté public, 25 lignes au bureau) :
   **constantes d'affichage** dans le module de domaine, pas paramètres d'association. Ce sont des
   conventions de présentation, du même ordre que le « 25 lignes par page, 10 sous 640 px » du design
   system (§2.1), pas des valeurs métier au sens de l'ADR 010.

## Considered options

- **Réemployer `posts` en le scopant** — rejeté. La forme ne convient pas (multilingue, slug
  global, ni date ni image), et poser la RLS vide sans bruit le blog, l'admin du blog, le sitemap et
  le seed. Le « rien ne fuit, rien ne sort » de l'ADR 002 transformerait une migration en panne
  silencieuse.
- **Loger le contenu d'une actualité dans `content_block`** — rejeté. Il faudrait rendre `page_id`
  polymorphe, ou ajouter une table de jonction, pour un contenu que l'ADR 007 veut à champs fixes. Et
  le bureau hériterait de l'éditeur de blocs, beaucoup plus lourd que le formulaire validé
  (`docs/designs/s05-actualites.md`).
- **Slug modifiable par le bureau, comme pour une page** — rejeté. Le critère 2 exige une URL
  stable, et le design validé affiche l'adresse en lecture seule. Une actualité se partage par lien
  (email, affichage), puis s'oublie : la renommer casserait ces liens.
- **Slug recalculé à chaque changement de titre** — rejeté, pour la même raison.
- **Une chaîne de fichiers par modèle** (route `/api/news/files`, puis une par story) — rejeté.
  C'est exactement la divergence que la note de s05 demande d'éviter, et trois copies d'une validation
  de sécurité (préfixe, remontée de chemin, extension) sont trois endroits où l'oublier.
- **Déplacer les fichiers de pages vers `/api/files` en retirant l'ancienne route** — rejeté. Les
  URL sont calculées au rendu, mais une page déjà en cache ou un lien copié par le bureau pointerait
  dans le vide. Garder le chemin coûte un fichier de trois lignes.
- **Taille de page en paramètre d'association** — rejeté pour l'instant. Aucun critère ni aucun
  bureau ne le demande, et un réglage d'affichage de plus dans « Réglages » est du bruit pour un
  public non technicien. Si le besoin apparaît, le registre de l'ADR 016 l'accueille sans nouvel
  écran.

## Consequences

**Ce qui devient plus simple**

- s06 et s09 déclarent leur portée de fichier et leur colonne `…_key`. Ils n'écrivent ni
  validation de clé, ni route de lecture.
- Le blog hérité garde son comportement. La question de son retrait est posée à part, sans bloquer
  les actualités.
- Le rendu d'une actualité ne duplique aucun sanitiseur : une seule liste de balises autorisées
  pour tout le texte riche du produit.

**Ce qui devient plus difficile**

- Deux chemins servent désormais les fichiers de pages. L'ancien ne doit **pas** être étendu. Tout
  nouveau client passe par `/api/files`.
- Une actualité en brouillon n'a pas d'adresse tant qu'elle n'a pas de titre. L'aperçu n'est
  proposé qu'une fois le slug fixé.

**À surveiller**

- **Le blog hérité reste exposé**, sur le domaine de chaque association, tant que `blog` figure dans
  `NEXT_PUBLIC_ENABLED_PAGES`. C'est un « fil d'articles » générique à côté des actualités de
  l'association. À traiter par une story de retrait, pas en passant.
- Les fichiers d'une actualité en brouillon sont lisibles par qui connaît leur clé. C'est le
  compromis déjà accepté pour les pages de s04 : la clé contient un UUID aléatoire, non devinable.
