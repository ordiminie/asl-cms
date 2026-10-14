# Revue — Story s46-comptes-herites-minimum (deuxième passage)

> Revue en contexte neuf. Chaque problème est classé critique, majeur ou mineur.
> Diff revu : `git diff main...feature/s46-comptes-herites-minimum`. Deux commits : `f74dad7` (story) et `b2a7726` (correctif), 96 fichiers, +2275 / −7244.

## Suivi des constats du premier passage

J'ai vérifié chaque constat dans le code, sans me fier au message du correctif.

| # | Constat (1er passage) | Sévérité | État | Vérification |
| --- | --- | --- | --- | --- |
| 1 | Lien `/admin` → `/bureau` vers une page introuvable ; critère 3 non épinglé | critique | **Fermé** | Détail sous le tableau. |
| 2 | `docs/architecture.md:477` cite encore `account/organizations` et `team/[slug]` | mineur | Ouvert | Toujours présent. C'est un document de cadrage sur `main`, hors du diff. À corriger à part. |
| 3 | `@better-auth/api-key` sans importeur ; branche `x-api-key` de `api-auth.ts` inerte | mineur | Ouvert | `package.json:40` toujours présent. Reporté à s46b. |
| 4 | Cartes de `/account` espacées de 24 px partout | mineur | **Fermé** | `security-section.tsx:17` vaut maintenant `space-y-6 lg:space-y-8` (24 px, puis 32 px). C'est l'intention de l'écran 2. Un test le fixe. |
| 5 | Titre de métadonnées `'Espace membre'` écrit dans le code | mineur | Ouvert | Inchangé. Le plan le prescrit et c'est cohérent avec `admin/layout.tsx`. |
| 6 | Exemples `UserMenu` / `UserMenuSkeleton` absents du dépôt dans deux règles | mineur | Ouvert | Toujours aux lignes 62-63 de `rule-safe-route.md` et 118-119 de `rule-react-cache-next-cache.md`. Présentés comme un patron. |

Détail de la fermeture du constat 1 :

- `nav-application.tsx:33` vise maintenant `/bureau/pages`.
- Cette route existe : `src/app/[locale]/(bureau)/bureau/pages/page.tsx`.
- Le SuperAdmin y a accès. Le layout `(bureau)` et la page appellent `canManageAssociation`, qui renvoie `true` pour `RoleConst.SUPER_ADMIN` (`association-authorization.ts:26`).
- Le plan (décision G, tâches 3f et 8) et le design (repère 3) ont été mis à jour, avec la raison et le renvoi à s46b pour la destination de `/bureau` lui-même.

## Le correctif b2a7726, relu comme du code neuf

Code :

- Le seul changement est la valeur de `href` dans `nav-application.tsx` (et son commentaire JSDoc), plus la classe `lg:space-y-8`. Pas d'effet de bord : aucun autre consommateur ne dépend de `href="/bureau"`.
- Dans le test unitaire « sans association », `a[href^="/bureau"]` est un peu plus strict qu'avant. C'est correct.

Le test e2e durci du critère 3 (`e2e/account-legacy-routes.spec.ts:219-255`) échouerait-il sur une cible inexistante ? Oui, à quatre endroits indépendants :

1. `page.waitForURL(`${TENANT_A}/bureau/pages`)` et `pathname === '/bureau/pages'` : une URL exacte. Tout autre `href` échoue, y compris une redirection vers `/login`.
2. `getByRole('heading', {level: 1, name: 'Pages'})`. J'ai vérifié que ce `h1` existe :
   - `pages-list.tsx:88-89` rend `t('title')` ;
   - `BureauPagesPage.title` vaut « Pages » (`messages/fr.json:2198`).
   - Si `/bureau/pages` n'existait pas, l'adresse à deux segments donnerait un vrai 404 (ADR 013), sans ce titre.
   - L'écran de refus du bureau n'a pas ce titre non plus. Un SuperAdmin refusé ferait donc échouer le test.
3. Le lien « Page d'accueil » doit exister dans `[data-sidebar="sidebar"]` avec `href="/bureau/page-accueil"`. J'ai vérifié :
   - la clé `BureauIdentityPage.nav.homePage` vaut « Page d'accueil », avec la même apostrophe typographique (`fr.json:1918`) ;
   - l'entrée existe dans `NAV_GROUPS` de `bureau-sidebar.tsx` ;
   - `data-sidebar="sidebar"` est posé par `ui/sidebar.tsx`, en ordinateur (l. 238) comme en mobile (l. 191).
   - Ce repère n'existe que si le layout `(bureau)` a rendu sa barre, donc si l'accès est accordé.
4. `getByText('Page non trouvée')` doit avoir un compte de 0. C'est le garde-fou contre la page CMS de repli.

En plus, l'absence de passage par `/login` est vérifiée sur toutes les requêtes. Ce test épingle maintenant vraiment le critère 3. Comme les e2e ne tournent pas sur cette machine, je l'ai lu, pas exécuté. Il tournera en CI.

Le nouveau test `security-section.test.tsx` :

- Les dépendances mockées existent : `AuthClientAppConfig`, `shouldShow*` et les quatre sous-formulaires.
- L'assertion `toHaveClass('space-y-6', 'lg:space-y-8')` échoue si la classe est retirée. C'est un test de style, mais il n'est pas vide.

## Conformité au plan

- [x] Le code fait ce que le plan demande, sans ajout. Les tâches 1 à 10 sont présentes. La décision G est maintenant cohérente avec une route réelle.
- Dans `docs/stories.md`, la seule modification remplace une référence à `edit-user-settings.tsx`, supprimé, par `member-profile-form.tsx`. C'est l'alignement des références attendu par la tâche des règles, pas une dérive.
- Réserve de processus (mineur) : le correctif a modifié la décision G d'un plan déjà `validated: yes`. C'était la réponse à l'option a du premier passage, c'est documenté et c'est proportionné. Mais la validation humaine portait sur `/bureau`, et le critère 3 de `docs/stories.md:3270` dit toujours « (`/bureau`) ». À confirmer par la personne qui valide, au moment du ship.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. J'ai rouvert les cibles :
  - `requireCurrentTenantDal`, `getCurrentTenantDal` et `TenantDTO.logoKey` ;
  - `AssociationMark` et `getIdentityVersionFromKey` ;
  - `LogoutButton`, avec ses nouvelles props `variant`, `withIcon` et `className` ;
  - `CardTitle`, les icônes lucide `Landmark`, `LogOut`, `ArrowLeft` et `ArrowRight` ;
  - les clés `MemberSpaceLayout.*`, `MemberSpacePage.*`, `AppSidebar.associationBackOffice.*` et `AccountPage.backToMemberSpace` ;
  - pour le correctif : `/bureau/pages`, `BureauPagesPage.title`, `BureauIdentityPage.nav.homePage` et `data-sidebar`.
- [x] Aucune valeur plausible mais fausse. La cible du lien est maintenant une route réelle et autorisée pour le SuperAdmin.
- [x] Le code fait ce qu'il annonce. Aucune référence restante dans `src/`, `e2e/`, `scripts/` ou les règles vers les modules supprimés. Le seul résultat de ma recherche est le motif `STALE_PATTERNS` de `check-rules.ts`, qui est voulu.

## Conformité aux règles

- [x] Conventions du dépôt (AGENTS.md) respectées :
  - pas de `withRlsBypass`, pas de `process.env` dans `src`, pas d'accès direct à `db` ;
  - libellés dans `messages/fr.json`, sauf le titre de métadonnées (constat 5) ;
  - le layout `(app)` n'attend pas la session.
- [x] Aucun ADR accepté contredit :
  - ADR 003 et ADR 013 : de vrais 404 sur des adresses à plusieurs segments ;
  - ADR 008 : `date-helper` revient au `fr` par défaut ;
  - ADR 009 : les retraits sont récupérables ;
  - ADR 027 : la barre du bureau n'est pas touchée.
- [x] Design system respecté :
  - en-tête §3.12, écrans 1 et 2, repère 3 : aucun composant ni token hors système ;
  - l'espacement 24 / 32 px de l'écran 2 est maintenant respecté.

## Tests

- [x] Suite lancée par moi : `NEXT_PUBLIC_ENABLED_PAGES=account,admin pnpm test --run` donne **214 fichiers, 2562 tests passés, 1 ignoré**, code de sortie 0, aucun délai de worker. C'est un fichier et un test de plus qu'au premier passage : `security-section.test.tsx`.
  - `tsc --noEmit` : propre, code 0.
  - ESLint sur les fichiers du correctif : propre.
  - `pnpm check:rules` : « Règles et documentation alignées sur le code ».
  - e2e lus, pas exécutés (CI).
- [x] Les assertions épinglent les critères 1 à 6. Le critère 3 l'est maintenant au bout du parcours (voir plus haut), pas seulement sur l'attribut `href`.

## Régressions

- [x] Chemins touchés revérifiés :
  - `LogoutButton` : rendu par défaut inchangé pour `logout-form.tsx` ;
  - `AuthProvider` reste monté par `app-providers.tsx` et `admin/layout.tsx` ;
  - `/bureau/pages` n'est pas modifié par le diff ;
  - la classe ajoutée à `UserSecurityFactorSection` est sans effet sous `lg`.
- Les dettes I et J notées au plan restent hors périmètre, comme prévu :
  - liens d'invitation vers `/account/invitations` dans `auth.ts` et `notification-service.ts` ;
  - `callbackURL` Stripe dans `stripe-events.ts`.

## Constats

- mineur — `docs/plans/s46-comptes-herites-minimum.md` (décision G) et `docs/stories.md:3270` : le plan validé a été amendé en fix mode (`/bureau` devient `/bureau/pages`). Le critère de la story cite toujours `/bureau`. L'écart est justifié et renvoyé à s46b, mais la personne qui valide doit le confirmer au ship.
- mineur — `docs/architecture.md:477` : le « Reste connu » cite encore `account/organizations` et `team/[slug]`, retirés par cette story. Document de cadrage sur `main`, à corriger à part. Reporté du 1er passage.
- mineur — `package.json:40` et `src/lib/api-auth.ts:151-164` : `@better-auth/api-key` n'a plus d'importeur, et la branche `x-api-key` n'authentifie plus rien. À retirer en s46b. Reporté du 1er passage.
- mineur — `src/app/[locale]/(app)/layout.tsx:14` : titre de métadonnées `'Espace membre'` écrit dans le code au lieu de `messages/fr.json`. Prescrit par le plan. Reporté du 1er passage.
- mineur — `.claude/rules/01-presentation/rule-safe-route.md:62-63` et `rule-react-cache-next-cache.md:118-119` : `UserMenu` et `UserMenuSkeleton` n'existent pas dans le dépôt. Ils sont présentés comme un patron. Reporté du 1er passage.

## Verdict

Le constat critique du premier passage est fermé : le lien de `/admin` mène à une page réelle du back-office. Le test e2e du critère 3 vérifie désormais l'URL exacte, le titre de la page, la barre du bureau et l'absence de « Page non trouvée ». Il échouerait sur une cible inexistante. Le correctif n'introduit aucun défaut. Il ne reste que des constats mineurs, dont aucun ne bloque.

Max severity: minor
Ship allowed: yes
