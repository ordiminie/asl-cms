---
validated: yes
---

# Plan — Story s06-presentation-bureau

Branch: `feature/s06-presentation-bureau`, à créer depuis `main` (`03277fe`).

> Validé par Marie-Ève le 2026-09-24, au point de contrôle de `/ks-plan`.
>
> **Sources** :
>
> - recherche : `docs/research/s06-presentation-bureau.md` ;
> - design : `docs/designs/s06-presentation-bureau.md`, maquette `.html` ;
> - design system : `docs/design-system.md` §1.7, §1.9, §3.9 (manques de s06 tranchés le 23/09/2026) ;
> - décision structurante de cette story : **ADR 024**
>   (`docs/decisions/024-redimensionnement-des-images-a-l-ecriture.md`) ;
> - décisions héritées : ADR 002 (RLS), ADR 007 (champs fixes), ADR 010 (rien en dur), ADR 016
>   (registre des paramètres), ADR 018 (registre d'actions), ADR 020 (slugs réservés), ADR 023
>   (chaîne de fichiers de contenu).

## Target story

**En tant que** membre du bureau **je veux** tenir à jour l'organigramme et les fiches du bureau
**afin que** la page de présentation reste juste après chaque renouvellement. Complexité 2.

1. Le bureau crée, modifie, réordonne et supprime des fiches (nom, rôle, photo, biographie courte)
   depuis le back-office.
2. La page publique affiche les fiches dans l'ordre défini par le bureau, avec la photo
   redimensionnée et un texte alternatif.
3. Retirer une fiche la fait disparaître de la page publique ; les fiches restantes se renumérotent
   sans trou dans l'ordre d'affichage.
4. Une fiche sans photo affiche un visuel de repli, pas une image cassée.

### Dépendance : s05 est mergée, la question 1 de la recherche est close

La recherche avertissait que s06 dépend réellement de s05 (chaîne de fichiers partagée), pas
seulement de s04. **C'est réglé** : `93d32f4` a mergé s05 sur `main`, et
`src/services/types/domain/content-file-types.ts`, `src/app/api/files/[...key]/route.ts` et
`renderRestrictedMarkdown` existent. s06 **déclare sa portée et sa colonne `…_key`**, et n'écrit ni
validation de clé ni route de lecture (ADR 023).

### Décisions tranchées pour ce plan

Elles répondent aux treize questions ouvertes de la recherche et aux hypothèses du design.

- **Table `board_member`**, à champs fixes, `organization_id` direct, RLS forcée. Le nom est celui
  déjà annoncé par `docs/architecture.md` l. 228. **Aucune FK vers `user` ni `member`** : une fiche
  n'est pas un compte (piège 11).
- **« Rôle » affiché = texte libre** (ADR 010 : une liste fermée serait une catégorie en dur), et
  **jamais** confondu avec le rôle d'autorisation `board`. La colonne s'appelle `role_label`, pas
  `role` : l'homonymie des deux « rôle » est la même que celle des deux « admin ».
- **Aucun statut, aucun brouillon.** Les critères n'en demandent pas ; toute fiche existante est
  publique (question 7). Conséquence assumée : nom et rôle sont **obligatoires**, il n'existe donc pas
  de fiche à moitié remplie.
- **Adresses** : page publique `/le-bureau`, back-office `/bureau/le-bureau` (+ `/nouveau`, `/[id]`).
  `le-bureau` entre dans `RESERVED_PAGE_SLUGS` **dans le même commit** (ADR 020). `bureau` y est déjà
  et reste pris par le back-office.
- **Redimensionnement** (question 3) : à l'écriture, par `sharp`, en WebP carré de 512 px — **ADR 024**,
  avec ses trois options rejetées. C'est la seule décision de ce plan qui engage les stories suivantes.
- **Plafond de téléversement** (question 6) : `serverActions.bodySizeLimit` passe de `'2mb'` à
  `'6mb'`. Aujourd'hui l'interface annonce « 5 Mo au plus » alors que Next rejette au-delà de 2 Mo
  **avant** toute validation — défaut latent hérité de s04 et de s05, que s06 est la première story à
  rencontrer pour de bon (portraits pris au téléphone). Relever le plafond rend vraie la consigne déjà
  écrite partout, plutôt que d'abaisser trois consignes. Une garde mécanique interdit qu'ils
  redivergent.
- **Repli de photo** (question 4) : **les initiales de la personne**, rendues **côté serveur**, jamais
  `<Avatar />` de Radix (composant client : il ferait clignoter le repli avant l'hydratation dans une
  page cachée). Règle complète : design system §3.9. Résidu assumé : si la clé existe mais que le
  fichier a disparu du disque, le navigateur montre une image cassée. Le critère 4 porte sur une fiche
  **sans photo**, et une clé n'est écrite qu'après une écriture réussie.
- **Texte alternatif** (question 5) : **déduit du nom**, « Portrait de {nom} », libellé dans
  `messages/fr.json`. Aucun champ à saisir, l'écran 2 le dit en clair.
- **Biographie** : **texte brut**, 500 caractères, rendue échappée (question 16). Pas de markdown : la
  seule chaîne riche du produit est celle de s04/s05 et rien dans les critères ne demande de mise en
  forme ici.
- **Renumérotation sans trou** (critère 3, question 13) : suppression **et** réécriture des rangs
  depuis la position, **dans une seule transaction**, sur le patron de `reorderPageBlocksTxnDao` —
  `removeMenuItemDao` ne renumérote pas. **Pas de contrainte d'unicité `(organization_id, rank)`** :
  la réécriture rang par rang la violerait transitoirement, et `menu_item` ne l'a pas non plus. La
  garantie est applicative, et elle est **prouvée en e2e sur les rangs en base**, pas sur l'ordre
  affiché.
- **Réordonnancement appliqué immédiatement**, avec annulation de 10 s (patron de s04b).
  **Suppression irréversible**, `alert-dialog` avant, pas de bande après : la photo part avec la fiche.
- **Nombre de membres** (questions 10 et 13 du design) : un **paramètre d'association** du registre
  typé (ADR 016), clé `association.member_count`, type `number`, entier, **sans valeur par défaut**.
  Modifié sur la page « Réglages » déjà générée, rappelé en lecture seule sur l'écran 1, affiché sur
  l'écran 3. **Non renseigné, la phrase est omise** — jamais « 0 membres ».
- **Hors périmètre** : lien vers `/le-bureau` depuis le menu du site (question 12 — `menu_item.page_id`
  est `NOT NULL`, l'étendre est une autre story), groupes / organigramme en cases, dates de mandat,
  recadrage, SEO (s11), consentement RGPD (question 11 : signalé, le texte de la mention de bas de page
  est une rédaction de travail à valider par le bureau — É8 du design).

### Écarts au design, assumés et à relire en revue

1. **Le token `body-strong-public` n'entre pas dans `src/app/globals.css`.** Le design le demande,
   mais **aucun token typographique n'existe dans cette feuille** : `globals.css` ne porte que des
   couleurs, et toute la typographie du produit est écrite en utilitaires Tailwind littéraux
   (`text-[18px] leading-[1.65]`, vérifié dans `(public)/actualites/page.tsx`). Inventer une variable
   CSS pour ce seul token créerait une deuxième manière d'écrire la typographie. s06 applique donc la
   **valeur** — Public Sans 18 px / 600 / 1,5 — sur le rôle de l'écran 3, comme ses voisines. Le rendu
   est celui du design ; c'est le véhicule qui diffère.
2. **La photo est transmise avec le formulaire, en un seul enregistrement**, sur les deux écrans, là
   où s05 téléverse dès la sélection. Raison : la clé d'un fichier de contenu est
   `{org}/{portée}/{ownerId}/…` et **une fiche neuve n'a pas encore d'identifiant**. Téléverser tout de
   suite obligerait soit à une clé provisoire, soit à un écran 2 qui se comporte différemment selon
   qu'on crée ou qu'on modifie. Effet de bord favorable : aucun fichier orphelin quand une fiche
   commencée est abandonnée. L'état « téléversement en cours » du design devient l'état
   « enregistrement en cours », avec la `progress` indéterminée et le nom du fichier ; « le reste de la
   fiche est conservé » reste vrai, le formulaire garde ses valeurs.
3. **Pas d'icône `UsersRound` sur l'entrée de barre latérale.** §1.7 l'a fixée au vocabulaire figé et
   le design demande de la poser — mais **la barre latérale du bureau ne porte aucune icône
   aujourd'hui** (`bureau-sidebar.tsx` : cinq entrées, aucune `lucide`). Poser une icône sur la seule
   entrée de s06 produirait une barre dépareillée. Le choix d'icône reste acquis au design system pour
   le jour où la barre en portera ; l'habiller entièrement n'est pas le travail de cette story.
4. **Le compteur de caractères applique la règle complète de §3.9**, dépassement compris
   (`--destructive-text`, graisse 600, bordure 2 px, message écrit) — c'est l'ajout que le design
   signale au point É4, postérieur à la maquette. Le token `--destructive-text` est porté par s07 : si
   s07 n'est pas mergée au moment de l'exécution, s06 le pose.

## Tasks (ordered)

1. [x] **Modèle `board_member`, RLS, registre d'actions, portée de fichier, slug réservé, paramètre
       « nombre de membres ».**
   - `src/db/models/board-member-model.ts` : `id`, `organization_id` (FK `cascade`), `name`,
     `role_label`, `photo_key` (nullable, convention `_key` de l'inventaire de s12c), `biography`
     (`text`, défaut `''`), `rank` (`integer`, `NOT NULL`), `created_at` / `updated_at` avec fuseau.
     Index `(organization_id, rank)`. **Pas de contrainte d'unicité sur le rang** (voir les décisions).
     Enregistré dans `src/db/models/db.ts`.
   - Migration du modèle par `pnpm db:generate`, puis policy par `drizzle-kit generate --custom` sur le
     patron de `0017_news_rls.sql` : `ENABLE` + `FORCE ROW LEVEL SECURITY`, policy `tenant_isolation`.
     Jamais de SQL ni de journal écrit à la main. Numéros attendus `0018` / `0019`, à recaler si une
     story parallèle merge avant.
   - `ActionIdConst.BOARD_MEMBER_MANAGE = 'board.member.manage'` et son entrée dans `ACTION_REGISTRY`,
     `['owner', 'board']`, une seule entrée pour les quatre verbes (patron de `PAGE_MANAGE`).
   - `ContentFileScopeConst.BOARD = 'board'` ajouté à `content-file-types.ts` et à
     `CONTENT_FILE_SCOPES`. Aucune route, aucune validation de clé nouvelle.
   - `'le-bureau'` ajouté à `RESERVED_PAGE_SLUGS`.
   - `ASSOCIATION_MEMBER_COUNT_SETTING_KEY = 'association.member_count'` dans
     `ASSOCIATION_SETTINGS_REGISTRY` : type `number`, `required: false`, `integer: true`, `min: 0`,
     **sans `default`**, `page: 'settings'`, libellés et unité dans `messages/fr.json`.
   - `src/services/types/domain/board-member-types.ts` : DTO, longueurs maximales,
     `getPersonInitials(name)` et `buildPortraitAlt(name)`.
   - **Tests** :
     - `board.member.manage` autorise `owner` et `board`, refuse `member` et un rôle inconnu ;
     - `isPageSlugReserved('le-bureau')` est vrai ;
     - une clé de portée `board` est construite puis acceptée par `isContentFileKeyAllowed`, et une
       clé `board` d'une **autre** association est refusée ;
     - `getPersonInitials` : « Jean-Pierre Vasseur » → `JV`, « Claire Besson » → `CB`, un nom d'un seul
       mot → ses deux premières lettres, accents conservés, espaces multiples tolérés ;
     - le paramètre non renseigné se résout en valeur absente, pas en `0` ;
     - `pnpm db:generate` ne produit plus de diff après la migration.

2. [x] **Redimensionnement à l'écriture (ADR 024).**
   - `sharp` en dépendance directe de `package.json` (déjà présent en transitif de `next`, 0.35.3).
   - `src/lib/files/resize-image.ts` : `resizeToSquareWebp(content, size)` → octets WebP,
     `fit: 'cover'`, position centrée, métadonnées EXIF retirées. Module sans dépendance métier.
   - `PORTRAIT_STORED_SIZE = 512` dans `board-member-types.ts`.
   - **Tests** (Vitest, projet `node`) : un PNG de 800×600 rend un WebP de 512×512 ; un PNG déjà carré
     de 400 px rend 512×512 ; des octets qui ne sont pas une image lèvent ; la sortie est strictement
     plus petite qu'une entrée volumineuse.

3. [x] **Validation, repository, service `board-member`, plafond de téléversement.**
   - `src/services/validation/board-member-validation.ts` : nom 1–120 non vide après trim, rôle 1–120,
     biographie ≤ 500, identifiants UUID, liste d'identifiants non vide pour le réordonnancement.
   - `src/db/repositories/board-member-repository.ts`, **toujours `getDb()`** :
     - `getBoardMembersByOrganizationDao` (tri `asc(rank)`) ;
     - `addBoardMemberDao` (`rank` = nombre de fiches existantes) ;
     - `updateBoardMemberDao` (champs + `photo_key` + `updated_at`) ;
     - `reorderBoardMembersTxnDao(organizationId, orderedIds)` — rang = position dans le tableau ;
     - `removeBoardMemberAndRenumberTxnDao(organizationId, id)` — **une seule transaction** :
       suppression, puis réécriture des rangs des fiches restantes depuis leur position ; rend la clé
       de photo supprimée pour que le service efface le fichier.
   - `src/services/board-member-service.ts`, dans l'ordre `safeParse` → `canPerformAction(BOARD_MEMBER_MANAGE)`
     → `withTenant` :
     - `createBoardMemberService` / `updateBoardMemberService` — acceptent une photo facultative :
       validation par **signature binaire** (`validateContentFile('image', …)`), puis
       `resizeToSquareWebp`, puis `buildContentFileKey(org, BOARD, memberId, 'photo', 'webp')` et
       `upload`. Une photo refusée est **un résultat**, pas une exception, et rien n'est écrit ;
     - le **remplacement** et le **retrait** d'une photo effacent l'ancien fichier **après** l'écriture
       en base, et un échec d'effacement est journalisé sans faire échouer l'opération (seul précédent :
       `association-identity-service.ts:85-169`) ;
     - `removeBoardMemberService` — supprime, renumérote, puis efface la photo ;
     - `reorderBoardMembersService` ;
     - `getBoardMembersService` (lecture publique, **sans autorisation, délibérément**, comme
       `getPublicSiteNavigationService`) et `getBoardMembersForBureauService` ;
     - `canManageBoardMembersService`.
   - Façade et intercepteur (`shouldLogDetails: () => false`, comme les pages et les actualités).
   - `next.config.ts` : `serverActions.bodySizeLimit` à `'6mb'`, avec le commentaire disant **pourquoi**
     (il doit dépasser `CONTENT_FILE_MAX_BYTES.image`, sinon Next refuse avant toute validation et le
     message « Il pèse… » n'est jamais rendu).
   - **Tests** dans `src/services/__tests__/board-member-service.test.ts`, repository et stockage mockés :
     - `[ORGANIZATION OWNER]` et `[ORGANIZATION ADMIN]` (board) autorisés sur les quatre verbes ;
     - `[ORGANIZATION MEMBER]`, `[USER NOT IN ORGANIZATION]` et `[PUBLIC]` refusés avec
       `AuthorizationError`, **aucun DAO appelé, aucun fichier écrit** ;
     - création sans photo acceptée ; création avec une photo appelle le redimensionnement puis
       l'écriture, dans cet ordre ;
     - un fichier refusé par signature ne déclenche ni redimensionnement ni écriture ;
     - le remplacement d'une photo efface l'ancienne clé, **après** la mise à jour en base ; un échec
       d'effacement ne fait pas échouer l'opération ;
     - la suppression appelle la transaction de renumérotation **une seule fois** et efface la photo ;
     - le réordonnancement transmet les identifiants **dans l'ordre reçu**, et un identifiant étranger
       à l'association est refusé ;
     - la lecture publique ne demande aucune autorisation ;
     - **garde mécanique** : `serverActions.bodySizeLimit` de `next.config.ts` est ≥
       `CONTENT_FILE_MAX_BYTES.image`. Ce test protège aussi s04 et s05.

4. [x] **DAL `board-member-dal.ts`.**
   - `boardMembersTag(organizationId)` = `board-members:{org}` — un seul tag, la liste n'est ni paginée
     ni filtrée.
   - Lecture publique **interne** en `'use cache'` + `cacheLife('hours')` + `cacheTag`, appelée par un
     export `cache()`. **Aucun `logger`, aucune horloge dans le scope caché** (piège du logger,
     `rule-react-cache-next-cache`).
   - Lecture du bureau **non cachée**, `canManageCurrentBoardMembersDal`,
     `boardMemberPhotoUrl(key)` = `contentFileUrl(key)`.
   - Le nombre de membres est lu par le DAL des paramètres existant, pas par un accès neuf.
   - **Tests** : l'ordre rendu est celui des rangs ; une association sans fiche rend une liste vide, pas
     une erreur ; le patron de `news-dal.test.ts` est suivi.

5. [x] **Bureau : écran 1 (liste ordonnée) et écran 2 (créer / modifier).**
   - Routes `src/app/[locale]/(bureau)/bureau/le-bureau/page.tsx`, `…/nouveau/page.tsx` et
     `…/[id]/page.tsx`, chacune derrière `<Suspense>` avec le contrôle d'accès répété
     (`BureauAccessDenied`). `[id]` refuse un identifiant qui n'est pas un UUID.
   - `…/actions.ts` : `createBoardMemberAction`, `updateBoardMemberAction`, `reorderBoardMembersAction`,
     `removeBoardMemberAction`. Chacune appelle `requireActionAuth()` **en premier** et
     `updateTag(boardMembersTag(tenant.id))` **après** le succès, jamais avant.
   - `src/components/features/board/board-member-list.tsx` : **`<SortableList />` repris tel quel**,
     rang **écrit** (« 2 sur 5 », `tabular-nums`), photo 56 px ou initiales, quatre boutons `outline` de
     44 px **toujours visibles** (« Monter », « Descendre », « Modifier », « Supprimer »), « Monter » sur
     la première ligne et « Descendre » sur la dernière en **`aria-disabled="true"`, jamais `disabled`**
     (écart 3 du design : ils restent focusables). Écriture immédiate au déplacement, bande d'annulation
     10 s avec la mention de délai, `alert` d'erreur **ancrée** (« Les fiches sont restées dans leur
     ordre précédent. Rien n'est perdu. »), `alert-dialog` de suppression nommant l'acte, `alert` de
     succès après suppression annonçant la renumérotation. Cartes empilées sous 640 px, rang en `<dl>`.
     État vide « Aucune fiche pour l'instant. → Ajouter le premier membre du bureau ».
   - `src/components/features/board/board-member-form.tsx` : une colonne `max-w-[68ch]`, quatre champs,
     photo avec `file-upload` (zone de dépôt **et** bouton ; zone masquée sous `pointer: coarse`),
     consignes **avant** l'échec portant la limite **réellement appliquée**, aperçu carré 128 px,
     « Remplacer » / « Retirer », ligne `meta` annonçant le texte alternatif déduit, `textarea` 6 lignes
     avec compteur `tabular-nums` et la règle de dépassement de §3.9. Succès et erreurs **ancrés**,
     résumé d'erreurs avec liens d'ancrage, jamais de toast.
   - Entrée « Membres du bureau » dans `NAV_GROUPS`, groupe `siteGroup`, **après « Navigation »**
     (écart 3 du plan : sans icône).
   - Libellés dans `messages/fr.json` (`BureauBoardPage`, `BureauIdentityPage.nav.board`).
   - **Tests** (jsdom) :
     - liste : état vide avec son lien ; les rangs écrits suivent l'ordre ; « Monter » de la première
       ligne porte `aria-disabled` et **pas** `disabled` ; la 4ᵉ fiche sans photo rend ses initiales ;
       le dialogue de suppression nomme la personne ;
     - formulaire : nom et rôle obligatoires, biographie au-delà de 500 caractères rend le message et la
       bordure d'erreur, aucun champ de texte alternatif n'existe, la consigne affiche la limite
       appliquée ;
     - actions : `updateTag` appelé après succès, **pas** après échec (patron de
       `bureau/navigation/actions.test.ts`), façade mockée.

6. [x] **Site public : `/le-bureau` (écran 3).**
   - `src/app/[locale]/(public)/le-bureau/page.tsx` : `h1` « Le bureau » (34 px), la phrase du nombre de
     membres **seulement si le paramètre est renseigné**, puis la phrase de composition ; `<ol>` de
     fiches, filet `border`, 32 px d'intervalle ; photo carrée **128 px** (96 px sous 640 px, exception
     §3.9 : elle ne passe pas en pleine largeur) ou **initiales** dans le même carré, rayon 8 px ; nom en
     `h2` 26 px ; rôle en **Public Sans 18 px / 600 / 1,5** (écart 1 du plan) ; biographie en `body-lg`,
     absente si vide ; `alt` = « Portrait de {nom} » ; mention RGPD **unique**, en pied, après un
     `separator`.
   - État vide : « La composition du bureau sera publiée prochainement. », sans action. **Ni chargement
     ni erreur** : la page est rendue côté serveur et ne montre jamais son propre échec.
   - Rendu **entièrement serveur** : aucun composant client, donc aucun clignotement du repli dans une
     page cachée.
   - **Tests** (jsdom, DAL mocké) : l'ordre rendu est l'ordre reçu ; une fiche sans photo rend les
     initiales et **aucune balise `img`** ; une fiche sans biographie s'arrête au rôle ; la phrase du
     nombre de membres disparaît quand le paramètre est absent ; l'`alt` porte le nom ; la mention RGPD
     apparaît **une fois**.

7. [x] **Preuve e2e : `e2e/board-members.spec.ts`**, sur le patron de `e2e/site-navigation.spec.ts`
       (tenants A = `localhost`, B = `127.0.0.1` ; `user-owner@gmail.com`, `user@gmail.com`,
       mot de passe `Azerty123`).
   - La Présidente A crée cinq fiches, dont une sans photo et une sans biographie : elles paraissent sur
     `/le-bureau` dans l'ordre, la fiche sans photo montre ses initiales.
   - « Monter » puis « Descendre » changent l'ordre public ; l'annulation revient à l'ordre précédent.
   - **Critère 3, la preuve qui compte** : supprimer la 2ᵉ fiche de cinq la fait disparaître du public,
     et une **lecture SQL directe** des rangs restants rend `0,1,2,3` — **sans trou**. L'ordre affiché
     seul ne prouverait rien.
   - Une photo déposée est servie par `/api/files/…` en `image/webp` et mesure **512 px de côté**
     (critère 2 : c'est là que le redimensionnement se prouve).
   - Supprimer une fiche efface sa photo : son URL répond **404**.
   - Un membre simple n'atteint pas `/bureau/le-bureau`.
   - Les fiches de A sont absentes de `/le-bureau` sur B.
   - La RLS refuse, **en SQL direct sous le rôle applicatif**, de lire une fiche de A depuis le scope de
     B (test d'accès croisé exigé par la règle transverse).

8. [x] **Documentation d'architecture et de règles.**
   - `docs/architecture.md` : `board_member` ajoutée au classement RLS (tables scopées) et au Data
     model, décompte des tables porté de 26 à **27** ; portée `board` ajoutée au paragraphe des fichiers
     de contenu. **`src/db/rls-inventory.test.ts` échoue tant que ce n'est pas fait** — c'est la garde,
     pas une relecture.
   - `.claude/rules/01-presentation/rule-upload-file.md` : la chaîne partagée gagne la portée `board` et
     la mention du redimensionnement à l'écriture (ADR 024).
   - `docs/design-system.md` §9 : la ligne « Photo manquante sur une fiche du bureau » est déjà marquée
     tranchée — **rien à y réécrire**. Ne pas la retoucher.
   - **Vérifié** par `pnpm check:rules` et par les tâches 1 à 7, qui échouent si le code contredit ces
     documents.

## Files touched

**Créés** :

- modèle et migrations : `src/db/models/board-member-model.ts`, `drizzle/migrations/0018_*.sql`
  (modèle) et `drizzle/migrations/0019_board_member_rls.sql` (policy, `--custom`), plus leurs
  snapshots générés ;
- domaine et services : `src/services/types/domain/board-member-types.ts`,
  `src/services/validation/board-member-validation.ts`,
  `src/db/repositories/board-member-repository.ts`, `src/services/board-member-service.ts`,
  `src/services/facades/board-member-service-facade.ts`,
  `src/services/facades/interceptors/board-member-service-logger-interceptor.ts`,
  `src/services/__tests__/board-member-service.test.ts` ;
- image : `src/lib/files/resize-image.ts` (+ test) ;
- DAL et routes : `src/app/dal/board-member-dal.ts` (+ test),
  `src/app/[locale]/(bureau)/bureau/le-bureau/{page.tsx,actions.ts}` (+ test de `actions.ts`),
  `…/le-bureau/nouveau/page.tsx`, `…/le-bureau/[id]/page.tsx`,
  `src/app/[locale]/(public)/le-bureau/page.tsx` (+ test) ;
- composants : `src/components/features/board/board-member-list.tsx` et `board-member-form.tsx`
  (+ tests) ;
- e2e : `e2e/board-members.spec.ts` ;
- **documents de la story** : `docs/research/s06-presentation-bureau.md`,
  `docs/designs/s06-presentation-bureau{-brief.md,.md,.html}`, `docs/plans/s06-presentation-bureau.md`,
  **ADR 024**.

**Modifiés** :

- `src/db/models/db.ts` ;
- `src/services/types/domain/action-registry-types.ts` ;
- `src/services/types/domain/content-file-types.ts` (portée `board`) ;
- `src/services/types/domain/page-block-types.ts` (`RESERVED_PAGE_SLUGS`) ;
- `src/services/types/domain/association-settings-types.ts` (paramètre du nombre de membres) ;
- `src/components/features/association/bureau-sidebar.tsx` ;
- `next.config.ts` (`bodySizeLimit`) ;
- `package.json` / `pnpm-lock.yaml` (`sharp`) ;
- `messages/fr.json` ;
- `docs/architecture.md` ;
- `.claude/rules/01-presentation/rule-upload-file.md`.

**Non commité** : `docs/designs/s06-presentation-bureau.zip`, l'export brut du canevas, n'entre pas
dans le commit.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run` — jamais `pnpm test` seul, qui reste en mode veille)** :
  - services : trois rôles globaux **plus** les rôles d'organisation, DAO et stockage mockés, ordre
    validation → autorisation → écriture, et **aucun effet de bord sur un refus** ;
  - domaine : initiales, texte alternatif, clé de portée `board`, plafond de téléversement ;
  - image : redimensionnement réel sur de vrais octets, pas un `sharp` mocké — sinon le test ne prouve
    rien du critère 2 ;
  - DAL : ordre des rangs ;
  - composants et actions : états du design, `aria-disabled` plutôt que `disabled`, `updateTag` après
    succès seulement.
- **e2e (Playwright, build de production, Postgres éphémère)** : les quatre critères de bout en bout.
  **Trois choses ne sont prouvables que là** : la RLS et l'accès croisé (`db.ts` refuse toute connexion
  en test), les **rangs contigus en base** après suppression, et les **dimensions réelles** du fichier
  servi.
- **Non-régression** : les suites de s04, s04b et s05 (`page-*`, `news-*`, `content-file`,
  `e2e/page-cms.spec.ts`, `e2e/news.spec.ts`, `e2e/site-navigation.spec.ts`) restent vertes **sans
  modification de leurs attentes** — c'est la preuve que l'ajout d'une portée de fichier et le
  relèvement du plafond de corps n'ont rien changé pour elles.
- `pnpm lint`, `pnpm tsc --noEmit` (mémoire : supprimer `.next/types/routes.d.ts` si `tsc` ne se plaint
  que de `.next/`), `pnpm check:rules`. **Pas de `pnpm build` automatique** (AGENTS.md), sauf pour
  lancer l'e2e contre le build de production, comme l'exige la règle CI.

## Definition of Done

- Un seul commit de story sur `feature/s06-presentation-bureau`, plus un second pour les migrations si
  l'implémenteur les juge à isoler. Il porte la recherche, le design, le plan, l'ADR 024 et le code.
- Les quatre critères sont couverts par des tests verts, unitaires et `e2e/board-members.spec.ts` ; le
  critère 3 est prouvé **sur les rangs en base**, le critère 2 **sur les octets servis**.
- RLS forcée sur `board_member`, avec preuve d'accès croisé en e2e, et `src/db/rls-inventory.test.ts`
  vert.
- L'action `board.member.manage` est déclarée au registre ; `le-bureau` est réservé ; aucun
  `withRlsBypass` nouveau hors des e2e.
- Aucune valeur métier en dur (ADR 010) : le nombre de membres est un paramètre, les libellés sont dans
  `messages/fr.json`.
- Aucune régression sur s04, s04b et s05 ; lint et types propres.
- Revue `/ks-review` passée : `Ship allowed: yes`.
