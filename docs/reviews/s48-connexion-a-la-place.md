# Review s48-connexion-a-la-place

Revue faite par le sous-agent `reviewer` (contexte neuf), sur `git diff main...feature/s48-connexion-a-la-place`.

## Checklist

- [x] Tests lancés par le relecteur : `pnpm test --run` donne 279 fichiers passés, 3360 tests passés, 1 sauté, 0 échec, aucun timeout de worker. Ni build ni e2e (CI uniquement).
- [x] Imports et API vérifiés : `auth.api.impersonateUser` et `auth.api.stopImpersonating` (avec `headers`, corps `{userId}`), `impersonationSessionDuration` (option de `admin()`), `session.impersonatedBy`, `createAuthMiddleware` / `getSessionFromCtx` / `APIError` / `isAPIError` de `better-auth/api`, `getUserByIdDao`, `withTenant`, `postLoginPathOf`, `normalizeTenantHost`, `requestHostOf` existent. Le test `impersonation.real-auth.test.ts` tourne sur le vrai Better Auth. Aucune référence inventée.
- [x] Plan et diff : les 9 tâches sont présentes, aucun code non demandé.
- [x] Les tests épinglent les critères : ouverture, sortie, enchaînement refusé, refus de `changePassword` / `changeEmail` / `enableTwoFactor` pendant l'imitation (et passants hors imitation), 404 HTTP des deux routes, attribution, DAL, composants, e2e d'accès croisé.
- [x] Règles du dépôt et ADR 041 / 042 respectés.
- [x] Pas de régression : les signatures des quatre écrivains de trace ne changent que par `effectiveAuthor`.

## Points de sécurité

- **Routes fermées** : `IMPERSONATION_DISABLED_HTTP_PATHS` est fusionnée dans `disabledPaths` ; le test HTTP attend 404 pour les deux routes. Seul point d'entrée : le service.
- **Garde** : couvre `/change-password`, `/change-email`, `/delete-user`, `/link-social`, `/unlink-account`, `/two-factor/*`. Correspondance exacte sur `context.path` : une variante (barre finale, casse) ne correspond à aucune route Better Auth, donc 404, non contournable. Défense en profondeur côté Server Actions (`refusalWhileImpersonating`).
- **Pas d'enchaînement, pas de cible SuperAdmin** : `already_impersonating`, `canImpersonateAccount`, `target_is_admin`, `wrong_domain`, appartenance à l'association, compte non suspendu ; Better Auth refuse aussi.
- **Attribution** : `effectiveAuthor` pose `on_behalf_of_*` dans les quatre écrivains ; `getActingContext` lève une erreur plutôt que d'attribuer au compte visé.
- **RLS** : `impersonation_event` porte `organization_id` ; migration 0038 = ENABLE + FORCE + policy `tenant_isolation` ; test e2e d'accès croisé.
- **Aucun nouveau `withRlsBypass`.**
- **Durée** : `IMPERSONATION_SESSION_DURATION_SECONDS` (défaut 1800, max 3600) dans `@/env`, conforme à l'ADR 042.
- **`stopImpersonationAction` sans rôle : sûr.** Session authentifiée requise, le service rend `not_impersonating` hors imitation, aucune entrée client. Exiger un rôle rendrait la sortie impossible.
- **Migrations** : 0037 générée, 0038 `--custom`, journal et snapshots cohérents, rien d'édité à la main.

## Design system

La barre réutilise le §2.6 (z-index 60, `Button`). Le magenta est une constante dans le composant, déclarée comme manque au §9 du design system : manque signalé, pas libre invention.

## Findings

Aucun critique, aucun majeur.

Mineurs :

1. **Couverture du garde sous-testée** : le test réel exerce 3 chemins gardés sur 6 ou plus (pas `delete-user`, `link-social`, `unlink-account`, variantes `/two-factor/*`, ni variante barre finale / casse). Un test paramétré sur `IMPERSONATION_SENSITIVE_PATHS` fermerait le point.
2. **Périmètre du garde** : la réinitialisation par jeton et `/set-password` ne sont pas listées. Elles exigent un jeton que le SuperAdmin n'a pas : simple durcissement possible.
3. **Valeurs arbitraires** : `font-mono text-[15px]` dans `impersonation-dialog.tsx`, `max-w-[1200px]` dans la barre, hors de l'échelle de tokens.
4. **Connu et accepté** : `docs/designs/s48-support.js` non commité (hook ESLint) ; trailer du commit « Opus 5.5 » au lieu de « Sonnet 5.5 ».
5. Fichiers non suivis sans rapport (zips de design, `docs/research/s42-lancement-invitations.md`) : hors du diff, aucune action.

Max severity: minor
Ship allowed: yes
