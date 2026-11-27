---
validated: yes
---

# Plan — Story s50-navigation-liens-libres

Branch: `feature/s50-navigation-liens-libres`

Sources : `docs/research/s50-navigation-liens-libres.md`, `docs/designs/s50-navigation-liens-libres.md`
(+ `.html`, référence visuelle seulement), [ADR 078](../decisions/078-menu-entree-page-ou-adresse-liste-blanche.md)
(complète l'ADR 021).

## Questions pour l'utilisatrice

**Tranchée le 2026-11-27 : (a) `dialog`, retenue par l'utilisatrice.**

1. **Où se saisit une entrée libre à l'ajout ?** (manque 1 du design : des champs dans un `popover`, forme
   que le design system ne décrit pas.) Le design loge un `radio-group` « Une page / Une adresse » et les
   deux champs dans le `popover` de s04b.
   - **Recommandé — (a) `dialog`** : sous la liste, deux boutons `outline` : « Ajouter une page » (le
     `popover` + `command` de s04b, inchangé) et « Ajouter une adresse », qui ouvre **le même `dialog`**
     que « Modifier » (Libellé, Adresse : deux champs, la limite du `dialog` au §2.1). Aucune forme
     nouvelle, un seul formulaire pour l'ajout et la modification, et le patron existe déjà
     (`report-categories-manager.tsx` : « Ajouter une catégorie » et « Modifier » ouvrent le même
     `dialog`). Le libellé « Ajouter une entrée » devient « Ajouter une page » (deux sélecteurs e2e de
     s04b à renommer).
   - (b) La maquette telle quelle (planches A2 à A4) : `radio-group` à contenu révélé (§3.14) dans le
     `popover` élargi à 26 rem ; il faudrait inscrire au design system « un `popover` peut porter un
     formulaire de deux champs au plus ».

   Le plan est écrit avec **(a)** ; si (b) est retenue, seule la tâche 7 change (et la tâche 9 inscrit la
   règle du `popover`).

## Target story

Le bureau ajoute au menu public une entrée « libellé + adresse » — chemin du site ou autre site en
`https://` — sans fabriquer de page ; elle se range, se masque, se retire et se modifie comme une entrée de
page.

1. Ajout d'une entrée « libellé + adresse » : chemin interne (commence par `/`) ou adresse externe en
   `https://` ; ordonnée, retirée, masquée comme une entrée de page (s04b, critères 1 et 6).
2. Le menu public l'affiche à sa place ; l'externe porte `rel="noopener noreferrer"`.
3. Adresse refusée = rien d'enregistré, erreur **sur le champ** : schéma autre que `https` (`javascript:`,
   `data:`, `http:`…), adresse relative au protocole (`//hôte`), libellé vide. Testé **y compris côté
   serveur**.
4. Entrées de page inchangées par la migration et toujours affichées ; jamais page **et** adresse —
   **contrainte en base**.
5. Scopée au tenant, prouvée par un test d'accès croisé entre deux tenants.
6. Ajouter, **modifier**, retirer une entrée libre met le menu à jour sans délai (invalidation de s04b).
7. Un membre non-bureau ne peut ni ajouter ni modifier.

## Arbitrages

**Arbitrages de l'utilisatrice du 27/11/2026** (non rouverts) :

1. **Piège s34 : rien dans s50.** Un lien libre visible s'affiche toujours, quelle que soit la route visée ;
   aucun avertissement, aucun masquage. Sujet à rouvrir quand un module aura une route publique (noté dans
   l'ADR 078, « À surveiller »).
2. **Modifier ne change jamais le type d'une entrée.** Une entrée libre modifie son libellé et son adresse ;
   une entrée de page reste une page (pour changer : retirer, puis ajouter). La requête de modification
   filtre `page_id is null`.
3. **Une entrée de page garde le titre de sa page** comme libellé ; le libellé propre n'existe que pour
   l'entrée libre (`CHECK` : libellé présent **si et seulement si** adresse présente).

**Décisions techniques du plan** (révisables à la validation) :

4. **Liste blanche** — un seul prédicat pur, `classifyLinkAddress(raw)` dans
   `src/lib/helper/link-address.ts` (ADR 078 §2). Après `trim()` : aucun caractère de contrôle
   (U+0000–U+001F, U+007F), aucun espace, aucun `\` nulle part ; puis **interne** = commence par `/` et le
   2ᵉ caractère n'est pas `/` ; **externe** = commence par `https://` (casse ignorée), `URL.canParse`,
   `protocol === 'https:'`, hôte non vide, ni `username` ni `password`. Sinon refus, avec trois raisons :
   `empty`, `http` (commence par `http://`, message dédié du design), `refused` (tout le reste). Il rend
   `{ok: true; kind: 'internal' | 'external'; address}` ou `{ok: false; reason}`. Il n'a aucune
   dépendance (ni `logger`, ni horloge) : il est appelé dans le scope `'use cache'` du rendu.
5. **Emplacement du prédicat** : `src/lib/helper/` (règle des helpers isomorphes) — formulaire client,
   Server Action, service à l'écriture et service au rendu l'importent. Ni dans `src/lib/pennylane`
   (adaptateur de facturation), ni dans les types de domaine (le prédicat n'est pas propre au menu : un
   autre lien saisi par le bureau pourra s'y adosser). `isHttpsUrl` de Pennylane n'est **pas** touché.
6. **`?` et `#` permis** dans un chemin interne (`/actualites?page=2`, `/#contact`) : un chemin qui
   commence par une seule `/` reste sur le site quoi qu'il porte ensuite. L'existence de la route n'est pas
   vérifiée (notes de la story).
7. **Adresse stockée telle que saisie après `trim()`, jamais normalisée** (ADR 078 §3) : les formes que le
   navigateur réécrirait (`https:/hôte`, `https:\\hôte`, `/\hôte`, `\\hôte`, espace ou tabulation en tête
   d'un `//hôte`) sont **refusées**, pas corrigées. Le libellé est stocké après `trim()`.
8. **Longueurs** (manque 4 du design) : libellé `MENU_LINK_LABEL_MAX_LENGTH = 40` (valeur de la maquette,
   même plafond que `CATEGORY_NAME_MAX_LENGTH` ; une `nav` d'ordinateur sans retour à la ligne ne loge pas
   davantage), mesuré après `trim()`, compteur du §3.9 ; adresse `MENU_LINK_ADDRESS_MAX_LENGTH = 2048`
   (longueur d'URL que tous les navigateurs suivent), sans compteur. Constantes dans
   `site-navigation-types.ts`, à côté des DTO (patron de `CATEGORY_NAME_MAX_LENGTH`). Ce sont des bornes
   de validation, pas des paramètres d'association (ADR 010 : rien de métier n'y est réglable).
9. **Validation client** : React Hook Form + `zodResolver(createMenuLinkFormSchema(t))`, schéma traduit
   partagé par le client et la Server Action dans
   `src/components/features/navigation/menu-link-form-validation.ts` — patron exact de
   `category-form-validation.ts` + `report-categories-manager.tsx` (s10) et de la règle
   `rule-zod-client-server-internationalization`. `mode: 'onBlur'`, `reValidateMode: 'onChange'` (au
   _blur_ puis à la soumission, §3.1).
10. **Erreurs par champ du serveur** : l'action rejoue `createMenuLinkFormSchema(t).safeParse` et rend
    `{status: 'invalid'; errors: {field: 'label' | 'address'; message}[]}` (forme de
    `CategoryActionResult`) ; le client les pose par `form.setError`. Le service revalide de son côté
    (`addMenuLinkServiceSchema` / `updateMenuLinkServiceSchema`, adossés au même prédicat, non traduits) et
    lève `ValidationParsedZodError` : l'action la rend en `errors.invalidData`. Signature des deux actions
    `(prevState, formData)` (règle `rule-form-front`, comme les catégories) ; les actions existantes de
    l'écran gardent leurs arguments typés.
11. **DTO en unions discriminées** : `MenuItemDTO = {kind: 'page'; …champs actuels} | {kind: 'link'; id;
rank; visible; label; address; target: 'internal' | 'external' | 'refused'}` (`target` calculé par le
    prédicat : `refused` ne peut venir que d'une écriture hors application, la ligne l'annonce « Masquée
    sur le site public — adresse refusée. », sur le patron de `hiddenBecauseUnpublished`) ;
    `PublicMenuEntryDTO = {kind: 'internal'; id; title; href} | {kind: 'external'; id; title; href}`. Une
    entrée de page devient `{kind: 'internal', href: '/' + slug}` : le rendu ne connaît plus que des
    `href`, calculés **une fois** par le service.
12. **Rendu** : `internal` → `Link` de `next/link` (inchangé) ; `external` → `<a href rel="noopener
noreferrer">`, **sans** `target`, dans la `nav` d'ordinateur **et** le tiroir mobile.
13. **Manques du design** :
    - manque 1 (champs dans un `popover`) → question 1 ci-dessus, option (a) appliquée : `dialog`.
    - manque 2 (deux boutons sur une ligne : « Modifier » + « Retirer du menu ») → composé comme s48, qui a
      livré deux actions sur la ligne d'un membre (`organization-members-table.tsx` : « Agir à sa
      place », « Retirer ») : deux `outline` côte à côte, empilés pleine largeur 56 px sous 640 px ; la
      ligne du §9 reste à trancher pour les deux stories, s50 y est ajoutée. Une entrée de page garde une
      seule action.
    - manque 3 (indice « lien externe » au menu public) → **aucun** : le §3.16 attache `ExternalLink` et
      l'annonce au lien qui **ouvre un nouvel onglet** ; ici le lien reste dans l'onglet (notes de la
      story), il n'y a rien à annoncer et le rendu public reste inchangé. `ExternalLink` (16 px,
      décoratif, `aria-hidden`) ne paraît que sur la ligne du bureau, à côté du mot écrit « Autre site ».
    - manque 4 (plafonds) → décision 8.
14. **Aucune nouvelle action d'autorisation** : `ActionIdConst.SITE_NAVIGATION_MANAGE` (owner, board ;
    SuperAdmin partout) couvre l'ajout et la modification, par `requireNavigationManager`.

## Tasks (ordered)

1. [x] **Prédicat de liste blanche** — `src/lib/helper/link-address.ts` : `classifyLinkAddress` (décisions
       4 à 7) + type de résultat ; JSDoc qui dit pourquoi chaque refus. **Vérif** :
       `src/lib/helper/link-address.test.ts` (`it.each`) — acceptés : `/contact`, `/actualites?page=2`,
       `/#contact`, `/`, `  /contact  ` (rendu trimé), `https://www.saint-etang.fr`, `HTTPS://x.fr`,
       `https://x.fr/a?b=c#d` ; refusés `refused` : `javascript:alert(1)`, `JavaScript:…`, `data:text/html,…`,
       `vbscript:…`, `mailto:a@b.fr`, `//hôte`, `/\hôte`, `\\hôte`, `\/hôte`, `" //hôte"`, `"\t/x"`,
       `"/x\ny"`, `"/a b"`, `https:/hôte`, `https:\\hôte`, `https://`, `https://a@b.fr`,
       `https://a:b@c.fr`, `ftp://x`, `contact`, `www.x.fr` ; `http` : `http://x.fr`, `HTTP://x.fr` ;
       `empty` : `''`, `'   '`.
2. [x] **Modèle et migration générée** — `menu-item-model.ts` : `pageId` sans `.notNull()` (FK et cascade
       gardées), `label: text('label')`, `address: text('address')`, `check('menu_item_page_xor_address_check',
    …)` (ADR 078 §1, patron `member-invoice-model.ts:85-96`), JSDoc de la table mis à jour ; puis
       `pnpm db:generate` → `drizzle/migrations/0087_*.sql` + journal + instantané, **jamais écrits à la
       main**. ADR 078 (déjà rédigé) relu et passé `accepted`. **Vérif** : le SQL généré contient
       exactement `ALTER COLUMN "page_id" DROP NOT NULL`, deux `ADD COLUMN`, un `ADD CONSTRAINT … CHECK`, et
       aucune ligne RLS ; un second `pnpm db:generate` ne produit rien ; sur une base locale jetable (skill
       `postgres-local-dev`, arrêtée à la fin) `pnpm db:migrate` passe avec des lignes `menu_item` existantes,
       puis l'insertion d'une ligne page **et** adresse, d'une adresse sans libellé, d'une page avec libellé
       et d'une ligne sans rien est refusée par la contrainte ; `src/db/rls-inventory.test.ts` reste vert
       (aucune table neuve).
3. [x] **Lecture : jointure externe, DTO en union, validation au rendu** — `menu-item-repository.ts` :
       `innerJoin` → `leftJoin`, `MenuItemRow` à `pageId` / `pageTitle` / `pageSlug` / `pageStatus` nullables + `label` / `address` ; `site-navigation-types.ts` : unions de la décision 11, constantes de la
       décision 8 ; `site-navigation-service.ts` : `toMenuItemDto` par type (une ligne incohérente, impossible
       sous la contrainte, est écartée), `getPublicSiteNavigationService` filtre **par type** — page :
       `visible && pageStatus === 'published'` ; lien : `visible && classifyLinkAddress(address).ok` —
       et calcule `href`. `addMenuItemService` rend une entrée `kind: 'page'`. **Vérif** :
       `site-navigation-service.test.ts` — mocks des lignes adaptés (26 cas existants verts) ; nouveaux cas :
       menu mêlé dans l'ordre de `rank` ; entrée libre interne → `{kind: 'internal', href: '/contact'}` ;
       externe → `kind: 'external'` ; adresse dangereuse **déjà en base** (`javascript:…`, `//hôte`,
       `/\hôte`, `http://…`) → omise du public, `target: 'refused'` au bureau ; entrée libre masquée →
       omise ; entrée de page non publiée → omise comme avant ; le service public n'appelle ni horloge ni
       `logger`.
4. [x] **Écriture : ajout et modification d'une entrée libre** — `site-navigation-validation.ts` :
       `addMenuLinkServiceSchema {organizationId, label, address}` et `updateMenuLinkServiceSchema`
       (+ `menuItemId`) — libellé `trim()`, 1 à 40 ; adresse ≤ 2048, `refine` sur `classifyLinkAddress` ;
       `menu-item-repository.ts` : `addMenuLinkDao({organizationId, label, address, rank})` et
       `updateMenuLinkDao(organizationId, menuItemId, {label, address})` (filtre `id`, `organization_id`
       **et** `page_id is null`, `updatedAt`, `returning`) ; `site-navigation-service.ts` :
       `addMenuLinkService` (`safeParse` → `requireNavigationManager` → `withTenant` → rang
       `existing.length` → DTO `kind: 'link'`) et `updateMenuLinkService` (rien de modifié →
       `NotFoundError`) ; réexport dans `site-navigation-service-facade.ts`. **Vérif** : tests de service —
       chaque refus du critère 3 lève `ValidationParsedZodError` **sans appel de DAO** (libellé vide ou
       d'espaces, 41 caractères, `javascript:`, `data:`, `http:`, `//hôte`, `/\hôte`) ; valeurs trimées à
       l'écriture ; membre simple et anonyme → `AuthorizationError`, aucun DAO (critère 7) ; SuperAdmin
       accepté ; `withTenant` reçoit l'organisation passée ; rang = nombre d'entrées ; modification d'une
       entrée de page (DAO sans ligne) → `NotFoundError` (arbitrage 2) ; ajout de deux entrées libres
       acceptées (pas de doublon sur `page_id` nul).
5. [x] **Server Actions et libellés** — `menu-link-form-validation.ts` (décisions 9 et 10 :
       `createMenuLinkFormSchema(t)`, `MENU_LINK_FORM_FIELDS`, `MenuLinkActionResult = {status: 'saved';
    item} | {status: 'invalid'; errors} | {status: 'error'; message}`) ; `navigation/actions.ts` :
       `addMenuLinkAction` et `updateMenuLinkAction` — `requireCurrentTenantDal` → `requireActionAuth` →
       schéma traduit → façade → `updateTag(siteNavigationTag(tenant.id))` **après succès seulement** ;
       `NotFoundError` et `ValidationParsedZodError` → `errors.failed` / `errors.invalidData` ;
       `messages/fr.json` `BureauNavigationPage` : `menu.addPage`, `menu.addLink`, `menu.edit`,
       `menu.linkInternal` (« Adresse du site : »), `menu.linkExternal` (« Autre site : »),
       `menu.hiddenBecauseRefused`, `linkDialog.*` (titres, légende de modification, libellés, aides,
       compteur, boutons, envoi en cours), `validation.*` (messages du tableau du design, plus
       `labelTooLong` « {count} caractères de trop. » et `addressTooLong`), `errors.summary` ; clé
       `menu.add` retirée. **Vérif** : `actions.test.ts` (10 cas existants verts) — **côté serveur** : pour
       chaque refus du critère 3, `{status: 'invalid'}` sur le bon champ avec le bon message et façade
       **non appelée**, `updateTag` non appelé ; succès → `updateTag('site-navigation:<org>')` une fois, pour
       l'ajout **et** la modification (critère 6) ; `AuthorizationError` → `errors.forbidden` (critère 7) ;
       `NotFoundError` → `errors.failed`, sans `updateTag`.
6. [x] **Rendu public** — `(public)/layout.tsx` et `public-mobile-menu.tsx` : `href` du DTO, `Link` pour
       `internal`, `<a rel="noopener noreferrer">` sans `target` pour `external` (décision 12) ; JSDoc des
       deux composants mis à jour. **Vérif** : `layout.test.tsx` et `public-mobile-menu.test.tsx` — une
       entrée de page rend `href="/qualite-eau"` comme avant (critère 4) ; une interne libre
       `href="/contact"` sans `rel` ; une externe `href="https://…"`, `rel="noopener noreferrer"`, **aucun**
       attribut `target` ; ordre conservé ; menu vide → aucune `nav` (inchangé), dans les deux composants.
7. [x] **Écran du bureau** — `site-navigation-manager.tsx` (design écran A, option (a) de la question 1) :
       `MenuItemRow` par type — page inchangée ; lien : libellé 17 px / 500 sans badge, ligne `meta`
       « Adresse du site : » / `ExternalLink` + « Autre site : » suivie de l'adresse en `data`
       (`overflow-wrap: anywhere`), annotation `hiddenBecauseRefused` si `target === 'refused'`, `switch`,
       « Modifier » (`outline`) et « Retirer du menu » ; `getLabel`, `removedBanner` et `addablePages` lisent
       le type ; `MenuLinkDialog` (add / edit, un seul composant, clé par entrée) : `Dialog` + `Form` RHF,
       Libellé avec compteur `/ 40` (§3.9), Adresse en `data` avec son aide, résumé d'erreurs ancré
       (`role="alert"`, liens vers les champs) à la soumission, erreurs serveur par `setError`, échec sans
       champ en `alert` en tête du dialog qui reste ouvert, légende d'arbitrage 2 en modification, boutons
       « Annuler » / « Ajouter au menu » ou « Enregistrer l'entrée » (« Ajout… », « Enregistrement… »),
       empilés 56 px sous 640 px (§3.11), focus rendu à « Modifier » après succès ; ajout → entrée en dernier
       rang ; modification → ligne mise à jour à sa place ; `undoRemoval` recrée une entrée libre par
       `addLinkAction` (libellé + adresse) puis rejoue l'ordre ; boutons « Ajouter une page » (popover de
       s04b) et « Ajouter une adresse » ; `page.tsx` câble `addLinkAction` / `updateLinkAction`. Composants
       du socle seulement (`Dialog`, `Form`, `Input`, `Label`, `Alert`, `Button`, `Switch`, `Badge`,
       `SortableList`, `Popover`, `Command`), aucun composant ni token neuf. **Vérif** :
       `site-navigation-manager.test.tsx` (9 cas existants verts, sélecteur « Ajouter une entrée » renommé) —
       ligne libre interne et externe (mots écrits, pas de badge) ; ajout : erreurs au _blur_ (libellé vide,
       `http://`), action non appelée, puis succès → ligne en dernier rang et dialog fermé ; erreur serveur
       par champ posée sous le bon champ ; modification pré-remplie → ligne mise à jour ; une entrée de page
       n'a pas « Modifier » ; annuler le retrait d'une entrée libre appelle `addLinkAction` avec son libellé
       et son adresse, **jamais** `addAction`, puis `reorderAction` avec le nouvel identifiant à la même
       place ; compteur en faute à 41 caractères ; `page.test.tsx` vert.
8. [x] **e2e et isolation** — `e2e/site-navigation.spec.ts` (bloc s50, série, entrées nommées par
       `unique()`, retirées en fin de bloc) : la présidente de TechCorp (`localhost`) ajoute « /contact » et
       une adresse `https://` → présentes dans `Menu du site` de TechCorp, la première `href="/contact"`, la
       seconde `rel="noopener noreferrer"` sans `target` (critères 1, 2) ; **absentes** du menu de Marketing
       Pro (`127.0.0.1`) (critère 5) ; elle modifie le libellé → le menu public montre le nouveau libellé au
       rechargement, sans redémarrage, puis le retrait le fait disparaître (critère 6) ; `javascript:alert(1)`
       puis `//exemple.fr` → erreur sous « Adresse », rien dans la liste ni au menu (critère 3) ; une entrée
       de page posée avant reste au menu (critère 4). Test d'autorisation existant étendu : le membre simple
       ne voit ni « Ajouter une page », ni « Ajouter une adresse », ni « Modifier » (critère 7). Sélecteurs
       s04b « Ajouter une entrée » renommés. **Vérif** : e2e en CI GitHub uniquement (jamais en local sur
       cette machine) ; suite `site-navigation` et suites publiques vertes.
9. [x] **Docs et contrôles** — `docs/design-system.md` : section « Formes retenues par s50 » (numéro
       suivant libre après §3.19) — entrée libre ajoutée et modifiée dans un `dialog` à deux champs, ligne
       d'une entrée libre (type écrit + adresse en `data`, `ExternalLink` au bureau seulement), menu public
       sans indice externe tant que le lien reste dans l'onglet, plafond 40 ; ligne du §9 « Deux actions sur
       une ligne » : ajouter s50. `docs/architecture.md`, ligne `menu_item` (l. 421) : « une page ou une
       adresse (ADR 078, s50) » — **seulement** si les modifications non commitées d'un autre agent sur ce
       fichier ont été commitées ; sinon le dire au rapport et laisser la ligne à `/ks-ship`. **Vérif** :
       `pnpm lint`, typecheck, `pnpm check:rules`, `pnpm test --run` verts (copie sur disque local si le
       montage 9p fait expirer les workers ; un timeout ne compte jamais comme vert).

## Files touched

- Helper : `src/lib/helper/link-address.ts` (nouveau) + `link-address.test.ts` (nouveau).
- Persistance : `src/db/models/menu-item-model.ts`, `src/db/repositories/menu-item-repository.ts`,
  `drizzle/migrations/0087_*.sql` + `meta/_journal.json` + `meta/0087_snapshot.json` (générés).
- Domaine et services : `src/services/types/domain/site-navigation-types.ts`,
  `src/services/validation/site-navigation-validation.ts`, `src/services/site-navigation-service.ts`,
  `src/services/facades/site-navigation-service-facade.ts` (intercepteur inchangé : import `* as`).
- Présentation : `src/app/[locale]/(bureau)/bureau/navigation/actions.ts`, `page.tsx`,
  `src/components/features/navigation/site-navigation-manager.tsx`,
  `src/components/features/navigation/menu-link-form-validation.ts` (nouveau),
  `src/app/[locale]/(public)/layout.tsx`, `src/components/features/layouts/public-mobile-menu.tsx`,
  `messages/fr.json` (`BureauNavigationPage`).
- Tests : `src/services/__tests__/site-navigation-service.test.ts`, `navigation/actions.test.ts`,
  `navigation/page.test.tsx`, `site-navigation-manager.test.tsx`, `(public)/layout.test.tsx`,
  `public-mobile-menu.test.tsx`, `e2e/site-navigation.spec.ts`.
- Docs : ADR 078 (nouveau), `docs/design-system.md`, `docs/architecture.md` (conditionnel, tâche 9),
  recherche, design, plan.
- **Pas touchés** : pied de page (`public-footer.tsx`, `saveSiteFooterService`), policy RLS `0015`,
  `src/lib/pennylane/*`, registre des actions, `seed.ts` (aucune ligne `menu_item` au seed ; l'e2e crée
  les siennes).

## Test strategy

- **Unitaires (Vitest, `pnpm test --run <chemin>`)**, dans l'ordre des tâches : prédicat d'abord, table de
  cas exhaustive des pièges (`/\hôte`, `\\hôte`, espaces et contrôles en tête, `https:/hôte`,
  identifiants, casse) ; service — refus de validation sans appel de DAO, autorisation par rôle (bureau,
  présidence, SuperAdmin, membre, anonyme), `withTenant`, lecture publique qui omet une adresse dangereuse
  déjà en base ; Server Actions — erreurs **par champ côté serveur** sans appel de façade, `updateTag`
  après succès seulement ; composants — rendu `href` / `rel` / pas de `target` dans les **deux** rendus
  publics, dialog d'ajout et de modification, annulation du retrait d'une entrée libre.
- **Base** : contrainte `CHECK` prouvée sur une base locale jetable à la tâche 2 (la RLS et la contrainte
  ne se testent pas en unitaire : `db.ts` refuse toute connexion en test) ; migration rejouée en CI par la
  suite e2e.
- **e2e (Playwright, CI GitHub seulement)** : parcours complet du bureau à l'écran public, accès croisé
  TechCorp / Marketing Pro, refus d'une adresse dangereuse par l'écran, membre non-bureau, invalidation
  sans redémarrage.

## Definition of Done

- Une PR, branche `feature/s50-navigation-liens-libres` ; un commit de story, et la migration `0087`
  dans un commit à part (révocable seule, AGENTS.md).
- Les sept critères couverts par un test nommé ; le critère 3 prouvé **côté serveur** (action et service),
  le critère 4 par la contrainte générée et la non-régression des entrées de page, le critère 5 en e2e.
- Liste blanche unique (`classifyLinkAddress`) appelée à l'écriture (client, action, service) **et** au
  rendu ; aucune liste noire ; aucun `target="_blank"`.
- Migration générée par `pnpm db:generate`, aucun SQL ni journal écrit à la main.
- `getDb()` / `withTenant` partout ; `updateTag(siteNavigationTag(...))` dans chaque nouvelle action ;
  textes dans `messages/fr.json`.
- Aucun composant ni token hors du design system ; manques du design tranchés et versés au design system.
- `/ks-review` passée sans critique ; e2e verts en CI.

## Correctifs de revue — tour 1 (arbitrage du 2026-11-27)

L'utilisatrice a choisi de corriger le majeur avant le ship. Les mineurs restent dans
`docs/reviews/s50-navigation-liens-libres.md` pour le tour final de fin de projet.

10. [x] **Constat 1 (major)** — `src/lib/helper/link-address.ts`, `isExternalHttpsAddress` : remplacer
        `URL.canParse` (absent de Safari 16.4, dans la cible de Next 16) par `new URL(address)` dans un
        `try`/`catch` qui rend `false`. Test d'abord : un cas qui échoue quand `URL.canParse` est absent
        (le retirer le temps du test), puis le correctif.

## Correctif CI — e2e (2026-11-27)

La CI de la PR 91 a échoué sur un seul test, sur 381 :
`e2e/site-navigation.spec.ts:328`, « le bureau ajoute, modifie et retire une adresse… ». Après trois essais,
le test expire sur `getByRole('dialog').getByLabel('Libellé')`.

Cause : le `popover` « Ajouter une page » porte lui aussi `role="dialog"`, comme tout popover Radix.
Juste après `addMenuEntry`, il est encore dans le DOM, le temps de son animation de fermeture.
`openLinkDialog` le prend pour le `dialog` de l'adresse et ne clique donc pas « Ajouter une adresse ».
Le popover se démonte ensuite, et aucun `dialog` ne reste à l'écran. L'instantané de la CI le confirme :
pas de `dialog`, et le focus est revenu sur « Ajouter une page ».

11. [x] **e2e s50 — viser le `dialog` par son nom** : `openLinkDialog` et ses appelants ciblent
        `getByRole('dialog', {name: …})`, avec le titre du `dialog` (« Ajouter une adresse au menu »
        ou « Modifier l'entrée »). Il ne faut plus jamais de `getByRole('dialog')` sans nom dans les
        blocs s50. Même règle pour les attentes de fermeture (`toBeHidden`). Rien ne change dans le
        code de l'application.
