# Review s16-coordonnees-membre

## Verdict

Le diff est conforme au plan, à l'ADR 040 et aux critères d'acceptation. Aucun problème critique ou majeur, deux problèmes mineurs.

## 1. Tests, exécutés par le reviewer

- `pnpm test --run` : 265 fichiers passés, 3227 tests passés, 1 ignoré. Aucun timeout de worker.
- `prettier --check` propre sur tous les .ts, .tsx et .json du diff.
- Build et e2e non lancés (consigne). Le spec e2e est dans le diff mais non vérifié localement : l'isolation RLS et le vrai `WHERE user_id` ne sont prouvés que là, la CI de la PR doit être verte.

## 2. Références vérifiées

`getMemberProfileByUserIdDao`, `withTenant`, `getAuthUser`, `requireActionAuth`, `requireCurrentTenantDal`, `MemberTextField`, `memberFieldIdOf`, `createMemberContactFormSchema`, `Alert`, `Card`, `Button`, `Skeleton`, la route `/contact` sous `(public)` et le fichier de l'ADR 040 existent avec les signatures utilisées.

## 3. Plan versus diff

Les 9 tâches sont faites et cochées. Rien ne dépasse le plan : pas de migration, pas de `withRlsBypass`, pas d'action de registre, fichiers côté bureau intacts.

- Le DAO `updateMyMemberProfileContactDao` n'a pas de champ `email` et utilise `getDb()`.
- Ordre du service : Zod, `getAuthUser`, `withTenant`, DAO appelé avec `authUser.id`.
- L'action ne lit que les cinq champs postaux/téléphone ; `revalidatePath` après succès.

## 4. Critères d'acceptation

- Critère 1 : l'email est affiché en texte, jamais en champ.
- Critère 2 : erreurs de champ client et serveur, rien d'écrit si invalide.
- Critère 3 : aucun id de profil rendu ni envoyé ; un `email` ou `memberProfileId` glissé est retiré par Zod et la liste blanche `readFields`. Une seule association est mise à jour.
- Critère 4 : le bureau lit via ses propres DAL dynamiques ; couvert par e2e.

## 5. Tests

Assertions substantielles (arguments du DAO, absence de clé `email`, `AuthorizationError` avant tout appel DAO, DTO sans id, contenu du `FormData`). Tous les cas n'ont pas été relus un à un.

## 6. Règles, ADR et design system

ADR 040, 002, 003 et 010 respectés ; architecture en couches respectée ; seuls `Card`, `Alert`, `Button`, `Skeleton` et les tokens existants sont utilisés ; l'intention de l'écran (lecture puis édition en place, alertes avec focus, état C8) est respectée.

## 7. Problèmes

- **Mineur 1** : le docblock de `MemberSpace` (`src/components/features/member-space/member-space.tsx`) dit « Composants serveur, sans état client », ce qui n'est plus vrai avec `MyContactCard`.
- **Mineur 2** : une ligne de plus de 80 caractères dans le docblock de `Page` (`src/app/[locale]/(app)/dashboard/page.tsx`).

## 8. Checklist

- [x] Tests exécutés par le reviewer et verts (unitaires) ; e2e laissés à la CI
- [x] Chaque import et appel vérifié
- [x] Tâches du plan toutes faites, pas de dérive
- [x] Assertions épinglant les critères d'acceptation
- [x] AGENTS.md et ADR 040, 002, 003, 010 respectés ; aucun nouveau `withRlsBypass`
- [x] Conformité au design system
- [x] Aucune régression constatée

Max severity: minor
Ship allowed: yes
