# Review — Story s24-notes-internes-membre

Diff jugé : `git diff main...feature/s24-notes-internes-membre` (commit `b8d1b577`). Revue par le sous-agent `reviewer`, en contexte neuf.

## Vérifications exécutées par le reviewer

- `pnpm test --run` : 308 fichiers passés, 3784 tests passés, 1 ignoré, aucun timeout.
- `tsc --noEmit` : propre.
- e2e : non exécuté (CI seulement) ; `e2e/member-notes.spec.ts` relu.
- `pnpm lint` et `pnpm check:rules` : non relancés par le reviewer (verts au rapport de l'implémenteur).

## Checklist

1. **Tests** : suite verte, assertions discriminantes. Le critère 4 est un `describe.each` sur les six appels de service (lecture, ajout note, ajout échange, modification note, modification échange, suppression) × anonyme, `member`, `board` d'une autre association, SuperAdmin imitant un membre simple : `AuthorizationError`, ni DAO ni `withTenant` appelés. Cas complémentaires : SuperAdmin hors imitation autorisé, `board` lisant sa propre fiche.
2. **Existence des références** : `effectiveAuthor`/`TraceAuthor`, `getMemberProfileByIdDao`, `calendarDayOf`, `isoToFrenchDate`/`frenchDateToIso`, `requireCurrentTenantDal`, `requireActionAuth`, export de `db.ts`, entrée du registre : toutes présentes, signatures conformes.
3. **Plan vs diff** : les 9 tâches faites, rien hors plan. Les `.zip` restent non suivis. `docs/architecture.md` touché pour l'inventaire RLS exigé par `rls-inventory.test.ts` (précédents s14, s48, s12c).
4. **ADR** : 050 respecté ; 049 sans contradiction ; 002 respecté (`organization_id`, RLS forcée, `getDb()`, `withTenant`, e2e d'accès croisé) ; 038 respecté (aucun `'use cache'`, `cache()` + `<Suspense>` + `use()`).
5. **Migrations** : 0041 générée (CHECK, RESTRICT, SET NULL, index DESC) ; 0042 calquée sur 0036 (ENABLE, FORCE, `tenant_isolation`) ; journal et snapshots issus de drizzle-kit.
6. **Sécurité et fuites** : DTO en liste blanche, `select` du repository sans `author_user_id`/`organization_id`/`on_behalf_of_*` ; intercepteur `shouldLogDetails: () => false` ; aucun `logger` dans le diff, messages d'erreur fixes et traduits ; modification scopée par `kind` ; ordre `entry_date, created_at, id` ; aucun import `@/db/*` en présentation.
7. **UI et design** : états a à l couverts par des tests de composant ; libellés dans `messages/fr.json` ; aucun token ni couleur hors système ; « Garder … » en premier dans la boîte de suppression (focus initial).

## Findings

### Critical

Aucun.

### Major

Aucun.

### Minor

1. **Garde de page et permission de lecture divergent.** `page.tsx` garde la fiche par `member.profile.manage` ; la lecture du fil et les écritures exigent `member.note.manage`. Les deux ont aujourd'hui les mêmes rôles : pas de défaut actif. Le jour où s37 les sépare, `notesPromise` rejetterait avec `AuthorizationError` et `use()` n'a pas de frontière d'erreur : toute la fiche tomberait au lieu de masquer la carte. À traiter avec s37 (garder la carte sur `member.note.manage`, ou rattraper le rejet dans la DAL) ; rien ne fige l'écart dans un test.
2. **Page au-delà de la dernière.** `?notes=99` (entier ≥ 1) rend un `<ol>` vide avec la pagination, sans bornage ni test. Cosmétique, aucune fuite.
3. **Petits fragments en dur.** Séparateurs `'· '` et `' · '` de `member-notes-card.tsx` hors `messages/fr.json` ; repli `entryDate ?? ''` de `notes-actions.ts` inatteignable (le service revalide).

## Suivi hors périmètre (rappel)

s38 et s39 déclarent `member_note` (export, complétude), s40 l'inclut dans la copie du membre ; les quatre écarts de design à verser à `docs/design-system.md` relèvent de `/ks-design-system`.

Max severity: minor
Ship allowed: yes
