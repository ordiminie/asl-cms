---
validated: yes
---

# Plan — Story s11-seo

Branch: `feature/s11-seo`, à créer depuis `main` **à jour** (s10 génère aussi des migrations : voir
tâche 2).

> **Sources** :
>
> - recherche : `docs/research/s11-seo.md` ;
> - design : `docs/designs/s11-seo.md`, maquette `docs/designs/s11-seo.html`, brief
>   `docs/designs/s11-seo-brief.md` ;
> - design system : `docs/design-system.md` §1.2 (six teintes précalculées), §3.1, §3.9, §4
>   (champs obligatoires pour publier), §9 ;
> - décisions : ADR 008 (locale unique, **non appliqué** — voir décision B), ADR 016 (registre des
>   paramètres en code), ADR 020 (pages à la racine), ADR 023 (fichiers de contenu), ADR 024
>   (redimensionnement à l'écriture) ;
> - règles : `rule-architecture`, `rule-service`, `rule-services-tests`, `rule-persistence`,
>   `rule-safe-server-action`, `rule-form-front-and-back`, `rule-react-cache-next-cache`,
>   `rule-upload-file`, `rule-logger`.

## Target story

**En tant que** visiteur **je veux** trouver le site de l'association dans un moteur de recherche
**afin d'**accéder à ses informations sans en connaître l'adresse. Complexité 2, dépend de s02, s04,
s05, s09 (livrées).

1. Le sitemap liste toutes les pages publiées du tenant et aucune page en brouillon ; publier une
   page l'y ajoute.
2. Chaque page publique expose un titre, une description et des métadonnées de partage renseignés
   par le bureau, avec un repli sur les valeurs du tenant si le champ est vide.
3. `robots.txt` autorise l'indexation des pages publiques et exclut toute route authentifiée,
   back-office compris, par un préfixe qui couvre aussi les routes ajoutées ensuite.
4. Le code de vérification Search Console est un paramètre de tenant, saisissable en back-office.
5. Chaque association sert son propre sitemap et ses propres métadonnées sur son propre domaine.

### Décisions rendues par l'utilisatrice (30/09/2026)

- **L'image de partage par page est dans s11** (écran 2 du design, planches `2e`, `2f`, `2h`), bien
  qu'elle porte le plan à dix tâches pour une story cotée 2. **Écart de cote assumé**, à reporter
  dans le PR : la story est plus proche d'un 3.
- **ADR 008 contourné, pas appliqué** : sitemap limité aux adresses sans préfixe, adresse canonique
  sans préfixe sur chaque page publique. L'application est portée par la nouvelle story
  **s43-locale-unique** (`docs/stories.md`, ajoutée le 30/09), qui dépend de s11.

### Décisions tranchées par ce plan

**A. Ce qui entre au sitemap** : `/` ; les pages CMS **publiées** (`/{slug}`) ; les actualités
publiées (`/actualites/{slug}`) ; les pages à adresse fixe du site public **dont le module est actif**
pour l'association (`/actualites`, `/analyses-eau`, `/le-bureau`, `/contact`, et `/signaler` si s10
est mergée avant — sinon c'est la seconde des deux stories qui l'ajoute). `lastModified` =
`updated_at` pour une page, date de publication pour une actualité. **Sortent** : le blog hérité, ses
catégories, `/pricing`, `/faq`, `/terms`, `/privacy` — le produit de la plateforme, pas le site de
l'association. `docs/architecture.md` cite nommément `sitemap.ts` parmi les lecteurs hors scope du
blog : la phrase est corrigée (tâche 10).

**B. Une seule adresse par page, sans préfixe** (contournement de l'ADR 008) : le sitemap n'émet ni
`alternates.languages` ni `/fr/…` ; `generateMetadata` pose `alternates.canonical` = l'adresse sans
préfixe sur toutes les pages publiques. `/fr/x` et `/es/x` restent servies jusqu'à s43, mais
déclarent `/x` comme canonique.

**C. Lecture non cachée, donc « publier l'ajoute » sans invalidation** : `sitemap.ts` et `robots.ts`
lisent le tenant par `headers()` — donc dynamiques (la doc Next le dit : un route handler spécial
qui utilise une API de requête n'est pas caché). La liste des pages publiées est lue par une DAL
**sans `'use cache'`** : un sitemap est demandé quelques fois par jour par les moteurs, le cache ne
rapporterait rien et coûterait une invalidation de plus à chaque publication.

**D. Critère 3 — préfixes + `noindex`, deux protections qui se complètent** :

- `robots.txt` interdit **chaque préfixe authentifié** tiré de la **même constante** que le proxy —
  `AUTHENTICATED_SEGMENTS`, exportée de `src/proxy.ts` vers un module partagé
  `src/lib/routing/authenticated-segments.ts` — plus les routes de connexion (`/login`, `/register`,
  `/verify-request`, `/reset-password`, `/logout`, `/auth-error`) et `/api/`. Une route ajoutée sous un
  segment existant (`/bureau/…`) est couverte par le préfixe ; un **nouveau segment** authentifié doit
  être déclaré au proxy pour être protégé, et l'est alors dans `robots.txt` du même geste.
- `robots: {index: false, follow: false}` dans les métadonnées des layouts `(app)`, `(bureau)`,
  `(auth)` et `admin` : toute route créée **sous** ces layouts, quel que soit son segment, est
  `noindex` par construction.
- La ligne actuelle `/(app)/` (un groupe de route, qui n'exclut rien) disparaît.

**E. Domaine qui ne sert aucune association** : sitemap **vide**, `robots.txt` `Disallow: /`, et
aucune ligne `Sitemap:`. Rien d'une association ne doit fuir sur un hôte inconnu.

**F. Chaîne de repli** (design, section « Chaîne de repli ») :

| Champ | Page CMS | Actualité | Pages fixes et `/` |
| --- | --- | --- | --- |
| Titre | titre moteur → titre de la page | titre de l'actualité | libellé de la page (messages) |
| Description | description → description de l'association → aucune | description → début du texte (160, coupé au mot) | description de l'association → aucune |
| Image | image de partage → image de repli générée | image de l'actualité → image de repli | image de repli |
| Texte alternatif | celui de l'image de partage → nom de l'association | celui de l'image de l'actualité | nom de l'association |

Le titre de chaque page est suivi du nom de l'association (`template: '%s · {association}'`), la
page d'accueil porte le nom seul. « Aucune » = pas de balise `description` : Google choisit un
extrait, ce que l'aide des Réglages dit (`1a`).

**G. Image de repli générée** (design écran 3, gap 2) : route `GET /api/identity/share-image`, rendue
par `ImageResponse` de `next/og` (**livré avec Next, aucune dépendance ajoutée**), 1200 × 630, marges
64 px, logo 240 × 240 ou monogramme, nom en Source Serif 4 600 à 72 px, deux lignes au plus, couleurs
**surface + encre** de la teinte de l'association (hex du §1.2 : c'est une image, pas du CSS, les
tokens ne s'y appliquent pas). Deux pièges, traités :

- **Police** : `next/font/google` ne fournit pas le fichier TTF à `ImageResponse`. Le TTF de Source
  Serif 4 (licence OFL) est **versé au dépôt** sous `src/assets/fonts/` avec sa licence, et lu depuis
  le disque — pas de téléchargement à l'exécution sur le VPS.
- **Logo WebP** : Satori ne lit pas le WebP. Le logo est converti en PNG par `sharp` (déjà en
  dépendance, ADR 024) avant d'être passé à l'image.
- Cache HTTP public, clé = version d'identité + teinte dans la query (`?v=…&h=…`), comme
  `/api/identity/logo` : l'image change quand le logo ou la teinte change, pas avant.

**H. Image de partage d'une page** : colonnes `share_image_key` / `share_image_alt` sur `page`, dépôt
par un service dédié qui réemploie la chaîne des fichiers de contenu de s04 (portée `pages`,
emplacement fixe `share`, validation par signature, redimensionnement à l'écriture de l'ADR 024).
PNG, JPEG ou WebP, 5 Mo. **Texte alternatif obligatoire pour publier** dès qu'une image est déposée :
`publishPageService` ajoute ce cas à ses refus, rendus dans la `PreviewBar` comme ceux des blocs
(`2f`). L'image n'est **pas recadrée** : la consigne « Idéalement 1200 × 630 px » est une aide, les
plateformes recadrent elles-mêmes.

**I. Registre des paramètres : un type `text`** (gap 1 du design) — `maxLength`, `multiline`, et un
`format` facultatif `'verification-code'` (lettres, chiffres, `-`, `_`). Deux clés :

- `association.description` — texte long, 160, facultatif, page `settings` ;
- `search.google_verification` — code, facultatif, page `settings`. Une balise
  `<meta name="google-site-verification" content="…">` collée entière est **réduite à son code**, au
  _blur_ côté client (`1d`) **et** dans la validation serveur (on ne fait jamais confiance au seul
  client).

Les deux vivent dans une **carte « Référencement »** de l'écran Réglages : le registre gagne un
`section` facultatif (ou l'équivalent le plus simple que le formulaire actuel permet), sans toucher
à la présentation des clés existantes.

**J. Plafonds** : titre moteur 60, descriptions 160 — valeurs d'usage des moteurs, portées par des
constantes de domaine, pas par une saisie. Au dépassement, le compteur passe en erreur (§3.9) et
l'enregistrement est refusé avec « N caractères de trop. ».

**K. Hors périmètre, dit et non comblé** : application de l'ADR 008 (s43) ; remplacement de la page
d'accueil du boilerplate (elle reçoit seulement les métadonnées de l'association) ; titre et image de
partage propres aux pages fixes ; écran de supervision ; exclusion d'une page publiée du sitemap ;
icônes d'application et page 404 (§9) ; recadrage de l'image de partage.

## Tasks (ordered)

1. [x] **Registre des paramètres : type `text` et deux clés** (critère 4 ; design écran 1 ; décision I).
   - `association-settings-types.ts` : `TextSettingDefinition` (`maxLength`, `multiline`, `format?`),
     clés `ASSOCIATION_DESCRIPTION_SETTING_KEY` et `GOOGLE_VERIFICATION_SETTING_KEY` au registre,
     rattachement à la carte « Référencement ».
   - Validation serveur (`validateSettingsChanges` / `parseSettingValue`) : longueur, jeu de
     caractères du code, extraction d'une balise collée (fonction pure `extractGoogleVerificationCode`).
   - `association-settings-form.tsx` : rendu `textarea` 3 lignes + compteur, et `input` en `data`
     (`font-mono`) ; extraction au _blur_ avec la phrase « Nous avons gardé le code seul : … » ;
     phrases « Vide : … » du design ; succès « Réglages enregistrés. Google en tiendra compte à son
     prochain passage sur le site. ». Libellés dans `messages/fr.json`.
   - **Tests** : extraction (balise complète, guillemets simples, code nu, balise sans `content` →
     refus) ; 161 caractères refusés ; code à caractère interdit refusé ; valeur vide = absente ; le
     formulaire rend les deux champs dans la carte ; les clés existantes ne bougent pas (tests de s02
     verts sans modification).

2. [x] **Colonnes SEO sur `page` et `news`, types de domaine.**
   - `page` : `seo_title`, `seo_description`, `share_image_key`, `share_image_alt` ; `news` :
     `seo_description` — toutes nullables. Migration par `pnpm db:generate` ; **aucune nouvelle
     table**, les policies de `0013` et `0017` couvrent déjà ces lignes, l'inventaire RLS ne bouge pas.
   - ⚠️ **Rebaser sur `main` à jour avant de générer** (s10 génère `0026`/`0027`) ; régénérer après
     rebase, jamais recoudre le journal.
   - DTO de page et d'actualité étendus, constantes `SEO_TITLE_MAX = 60`, `SEO_DESCRIPTION_MAX = 160`.
   - **Tests** : `pnpm db:generate` sans diff ; `rls-inventory.test.ts` inchangé et vert.

3. [x] **Services : champs SEO, image de partage, refus de publication** (critère 2 ; décision H).
   - `updatePageService` accepte `seoTitle`, `seoDescription`, `shareImageKey`, `shareImageAlt` ;
     `''` → `NULL` ; plafonds J ; la clé d'image doit être **sous la portée `pages` de cette page**
     (même contrôle que les clés de blocs).
   - `uploadPageShareImageService` : `requirePageManager` → page de l'association → signature →
     redimensionnement ADR 024 → clé `…/pages/{pageId}/share-{uuid}.{ext}`.
   - `publishPageService` : image déposée sans texte alternatif → issue `shareImageAltMissing`,
     refus comme pour un bloc image.
   - Actualités : `seoDescription` dans le service de création / modification, plafond 160.
   - **Tests** (`rule-services-tests`) : rôles (bureau passe, membre et hors association refusés
     sans DAO) ; `''` stocké absent ; 61 / 161 caractères refusés ; clé d'une autre page ou d'une
     autre association refusée ; publication refusée avec image sans alt, acceptée avec alt ou sans
     image.

4. [x] **Résolution des métadonnées : fonctions pures** (critère 2 ; décision F).
   - `src/lib/seo/resolve-metadata.ts` : `resolvePageSeo`, `resolveNewsSeo`, `resolveFixedPageSeo`
     prenant les données déjà lues (page / actualité, association : nom, description, version
     d'identité, teinte, origine) et rendant `{title, description?, image: {url, alt}, canonical}`.
     `excerptOf(markdown, 160)` : texte brut, coupé au mot, sans balise ni syntaxe markdown.
   - **Tests** : chaque ligne du tableau F, repli par repli ; la description absente n'est **jamais**
     une chaîne vide ; l'extrait ne coupe pas un mot et ne laisse ni `#` ni `**`.

5. [x] **Image de repli générée** (critère 2 ; design écran 3 ; décision G).
   - `src/app/api/identity/share-image/route.tsx` : tenant du domaine (`getCurrentTenantDal`, 404 si
     inconnu), logo (PNG, ou WebP converti par `sharp`) sinon monogramme, teinte, `ImageResponse`
     1200 × 630. Police lue depuis `src/assets/fonts/SourceSerif4-SemiBold.ttf` (+ `OFL.txt`).
   - Table des couleurs surface / encre des six teintes dans un module de domaine unique, **reprise du
     §1.2** (comme `src/lib/emails/theme.ts` pour les emails : une image ne lit pas les variables
     CSS).
   - **Tests** : la route rend `image/png` et des en-têtes de cache public ; logo WebP → conversion
     appelée ; sans logo → monogramme ; domaine inconnu → 404 ; couleurs = celles de la teinte
     réglée.

6. [x] **`generateMetadata` des pages publiques** (critères 2, 4, 5 ; décision B).
   - `src/app/[locale]/layout.tsx` : `metadataBase` = origine de l'association
     (`associationOriginOf(tenant.domain)`), `title.template`, `verification: {google}` si le réglage
     est renseigné (**absent sinon : pas de balise vide**), `openGraph` par défaut (`siteName`,
     `locale: 'fr_FR'`, image de repli).
   - Pages : `[slug]` (CMS), `actualites/[slug]`, `actualites`, `analyses-eau`, `le-bureau`, `contact`
     (et `signaler` si présente), et `/` — chacune via les fonctions de la tâche 4, avec
     `alternates.canonical` sans préfixe et `openGraph` / `twitter` (`summary_large_image`) complets.
   - Layouts `(app)`, `(bureau)`, `(auth)`, `admin` : `robots: {index: false, follow: false}`
     (décision D).
   - **Tests** (`layout-metadata.test.ts` étendu, tests de `generateMetadata` par page, DAL mockée) :
     titre et description du bureau quand renseignés, repli sinon ; `verification` présent / absent ;
     canonique sans préfixe même appelée sous `/fr` ; image absolue sur l'origine de l'association ;
     `noindex` sur chaque layout authentifié.

7. [x] **Éditeurs : section « Référencement et partage »** (design écran 2).
   - `page-editor.tsx` : section dans le panneau « Paramètres » (296 px), en bas du `sheet` en mobile :
     titre moteur (compteur 60), description (compteur 160, phrases de repli dont la variante « comme
     la description de l'association » + lien « Renseigner la description de l'association »), image
     de partage (`file-upload`, pas de zone de dépôt au tactile, « Remplacer » / « Retirer »), texte
     alternatif « Obligatoire avec une image », **aperçu « Dans Google »** qui suit la saisie et montre
     toujours la valeur de repli. Refus de publication dans la `PreviewBar` avec « Décrire l'image ».
     Action de dépôt dans `bureau/pages/[id]/actions.ts` (`requireActionAuth()` → façade).
   - `news-editor.tsx` : description (160) + aperçu, avec la phrase sur le titre et l'image de
     l'actualité.
   - L'aperçu est un composant de présentation unique (`search-preview.tsx`), encadré `muted`, sans
     logo ni couleur de marque (gap 3).
   - Libellés dans `messages/fr.json` — **sans jargon** à l'écran : ni « SEO », ni « meta », ni « Open
     Graph », ni « sitemap » (brief).
   - **Tests** (jsdom) : l'aperçu reprend la saisie et bascule sur le repli quand le champ est vidé ;
     compteur en erreur au dépassement avec « N caractères de trop. » ; texte alternatif requis
     affiché seulement avec une image ; `PreviewBar` montre le refus et son lien ; aucune chaîne
     interdite du brief dans les libellés rendus.

8. [x] **Sitemap par association** (critères 1, 5 ; décisions A, C, E).
   - DAL publique `getPublishedSitemapEntriesDal(organizationId)` → service → DAO dans `withTenant`
     (pages `published` et actualités `published` : slug + date). **Aucune fonction du bureau
     réemployée** (elles sont gardées par `PAGE_MANAGE`).
   - `src/app/sitemap.ts` réécrit : tenant du domaine appelé ; base = origine de l'association ;
     entrées de la décision A, filtrées par `enabledModules` ; aucun import du blog. Domaine inconnu →
     `[]`.
   - **Tests** : brouillon et page dépubliée absents, publiée présente ; aucune adresse préfixée ; blog
     et `/pricing` absents ; module inactif → page fixe absente ; domaine inconnu → vide ; la lecture
     passe par `withTenant` (un oubli de scope rendrait un sitemap vide sans erreur).

9. [x] **`robots.txt`** (critère 3 ; décisions D, E).
   - `src/lib/routing/authenticated-segments.ts` : la liste, déplacée de `src/proxy.ts`, qui
     l'importe (comportement du proxy inchangé).
   - `src/app/robots.ts` : `Allow: /`, `Disallow` = segments authentifiés + routes de connexion +
     `/api/`, `Sitemap:` absolu sur le domaine appelé ; domaine inconnu → `Disallow: /`, sans
     `Sitemap:`.
   - **Tests** : chaque segment de la constante apparaît en `Disallow` (un segment ajouté à la
     constante apparaît sans toucher à `robots.ts`) ; `/(app)/` a disparu ; la ligne `Sitemap:` porte
     le domaine appelé ; tests du proxy existants verts.

10. [x] **Preuve e2e et documentation.**
    - `e2e/seo.spec.ts` (tenants A et B sur leurs domaines, SQL direct) :
      - **Critère 1** : `/sitemap.xml` de A contient ses pages publiées, pas son brouillon ; publier le
        brouillon depuis le back-office → il apparaît à la requête suivante.
      - **Critère 2** : titre et description saisis dans l'éditeur → présents dans le `<head>` de la
        page publiée (`<title>`, `meta description`, `og:title`, `og:description`, `og:image`) ;
        vidés → repli sur l'association ; `/api/identity/share-image` rend une image.
      - **Critère 3** : `/robots.txt` interdit `/bureau`, `/dashboard`, `/account`, `/admin` et les
        routes de connexion ; une page du bureau porte `noindex`.
      - **Critère 4** : code saisi dans Réglages (balise entière collée) → `google-site-verification`
        au code seul sur les pages publiques de A, **absent chez B**.
      - **Critère 5** : sitemap, `Sitemap:` de robots, `og:url`, canonique et image de B portent le
        domaine de B et aucune page de A.
    - `docs/architecture.md` : `sitemap.ts` ne lit plus le blog (section « Contenu du socle ») ; les
      deux protections du critère 3 ; le contournement de l'ADR 008 et le renvoi à s43.
    - `docs/design-system.md` : versement des gaps retenus — types texte long et code du §3.1, gabarit
      de l'image de partage (§9), aperçu « Dans Google ».
    - **Vérifié par** `pnpm check:rules` et par la revue.

## Files touched

**Créés**

- `src/lib/seo/resolve-metadata.ts` (+ test) ; `src/lib/routing/authenticated-segments.ts` ;
- `src/app/api/identity/share-image/route.tsx` (+ test), `src/assets/fonts/SourceSerif4-SemiBold.ttf`
  et `OFL.txt` ;
- `src/components/features/pages/search-preview.tsx` (+ test) et la section de l'éditeur ;
- DAL et service des entrées du sitemap (+ tests) ;
- migration `drizzle/migrations/00NN_*.sql` générée et son instantané ;
- `e2e/seo.spec.ts` ;
- documents de la story : `docs/research/s11-seo.md`, `docs/designs/s11-seo*` (brief, md, html,
  zip), ce plan.

**Modifiés**

- `src/services/types/domain/association-settings-types.ts` et la validation des paramètres,
  `src/components/features/association/association-settings-form.tsx` (+ validation client) ;
- `src/db/models/page-model.ts`, `news-model.ts`, repositories et services de page et d'actualité,
  types de domaine ;
- `src/components/features/pages/page-editor.tsx`, `src/components/features/news/news-editor.tsx`,
  `bureau/pages/[id]/actions.ts`, `bureau/actualites/[id]/actions.ts` ;
- `src/app/[locale]/layout.tsx`, les `generateMetadata` des pages publiques et de `/`, les layouts
  `(app)`, `(bureau)`, `(auth)`, `admin` ;
- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/proxy.ts` (import de la constante) ;
- `messages/fr.json`, `docs/architecture.md`, `docs/design-system.md`.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : fonctions pures (repli, extrait, extraction du code),
  services par rôle, registre et formulaire des Réglages, éditeurs en jsdom, `generateMetadata`,
  `sitemap.ts` et `robots.ts` avec tenant et DAL mockés, route de l'image. ⚠️ Montage 9p lent : un
  timeout de worker se relance sur une copie en disque local, il ne compte pas comme vert.
- **E2E (build de prod)** : `e2e/seo.spec.ts` couvre les cinq critères sur deux domaines — la
  différence de domaine et la RLS ne se prouvent qu'ainsi. Les specs `page-cms`, `news` et
  `association-settings` restent verts.

## Definition of Done

- Les cinq critères couverts par des tests verts, unitaires et `e2e/seo.spec.ts`, sur deux
  associations.
- Aucune URL préfixée dans le sitemap, canonique sans préfixe partout ; s43 inscrite pour la suite.
- Aucune valeur en dur : description et code en paramètres d'association, plafonds en constantes de
  domaine, libellés dans `messages/fr.json`, couleurs de l'image tirées du §1.2 en un seul module.
- Aucune lecture de table métier hors `withTenant` ; aucun `withRlsBypass()` nouveau.
- Aucune dépendance npm ajoutée (police versée au dépôt, `next/og` et `sharp` déjà présents).
- Aucune régression sur le proxy, les Réglages de s02, les éditeurs de s04 / s05. Lint et types
  propres ; `pnpm db:generate` sans diff.
- Un seul commit de story, PR unique (écart de cote signalé) ; `/ks-review` : `Ship allowed: yes`.

## Points à arbitrer avant validation

1. **Pages fixes au sitemap selon les modules actifs** (décision A) : proposé ; l'alternative est de
   ne lister que les pages CMS et les actualités, comme le critère 1 le dit à la lettre.
2. **Police versée au dépôt** (décision G) : un fichier binaire sous licence OFL. L'alternative
   « police système » rendrait le nom de l'association dans une police différente selon le serveur.
3. **La page d'accueil du boilerplate** reçoit les métadonnées de l'association mais reste telle
   quelle : aucune story ne la remplace encore.
