# Revue — Story s12d-comptes-membres

> Revue n° 3, relecteur en contexte neuf. Diff jugé : `git diff main...feature/s12d-comptes-membres`
> (commits `bdc8d4a9`, `417c67e0`, `f2bbe662`). Le correctif `f2bbe662` est relu comme du code neuf.
> Modifications non commitées d'autres sessions ignorées. Aucun fichier modifié par le relecteur.
>
> Historique : revue 1 → 5 mineurs, corrigés dans `417c67e0` ; revue 2 → 2 mineurs (repli
> `/dashboard` inatteignable de `/login/acces-ferme`, lien laissé sur une fiche vidée), corrigés dans
> `f2bbe662` ; revue 3 → 1 mineur de rédaction du plan, corrigé après la revue dans `53d5cffd`
> (documentation seule, aucun code).

Aucun critique, aucun majeur. Les six preuves e2e restent à passer sur la CI de la PR.

## Reprise de la revue 2

1. **Repli `/dashboard` — corrigé, équivalence vérifiée.** La route décide à partir de
   `getPostLoginPathDal()` seule :
   - elle ne rend `undefined` que si `getAuthUser()` ne rend aucun compte
     (`src/app/dal/user-dal.ts:183-190`) ;
   - sinon elle rend `postLoginPathOf(user, tenant?.id)`, typée `PostLoginPath`, toujours un chemin
     (`/admin`, `/bureau/pages` ou `/dashboard`) : pas de compte accepté sans destination, pas de
     session refusée avec une destination ;
   - SuperAdmin accepté partout → `/admin`, sans déconnexion ; compte ordinaire sur l'hôte de la
     plateforme → session fermée, `/login?acces=ferme` ;
   - `POST_LOGIN_PATHS` ne contient que des chemins internes : pas de redirection ouverte ;
   - tests : `Location` exact, ni `signOut` ni cookie pour un accès ouvert ; le test d'état
     impossible est retiré.
2. **Lien laissé sur une fiche vidée — corrigé.** Décision `unlink` quand l'adresse devient vide et
   qu'aucune ligne `member` n'est lue pour le compte lié (`member-account-rules.ts:32`) :
   - fiche sans compte lié : la garde `profile.userId !== null` (`member-account-service.ts:201`)
     saute la branche, rien n'est écrit (testé) ;
   - `unlinkMemberAccount` n'appelle que `setMemberProfileUserIdDao(id, null)` sous `withTenant` ;
     ni `deleteMemberWithRoleDao` ni `deleteUserOrganizationDao` (testé) ;
   - `close` et `refuse_board_removal` inchangés ; aucun message de changement d'accès ;
   - remplacement sur un lien périmé → `open`, le nouveau compte est lié, rien n'est supprimé
     (testé) ;
   - seuls appelants de la décision : `member-profile-service.ts:148` et `:184-201`.

## Conformité au plan

- [x] Plan `validated: yes`. Tâches 1 à 10 présentes (revérifiées en revues 1 et 2). Le correctif ne
      touche que ses deux constats et le plan.
- [x] Écarts d'exécution exacts (route, « Président(e) », `unlink` — précision ajoutée dans
      `53d5cffd`).

## Anti-hallucination

- [x] Cibles ouvertes : `getPostLoginPathDal`, `postLoginPathOf`, `POST_LOGIN_PATHS`, `getAuthUser`,
      `canOpenSessionOn`, `organizationOfRequest`, `requestHostOf`, `setMemberProfileUserIdDao`,
      `withTenant`, `getLinkedAccountRole`. Noms et signatures exacts.

## Respect des règles

- [x] AGENTS.md : aucune nouvelle occurrence de `withRlsBypass` ; `process.env` seulement dans les
      e2e ; `getDb()` par les DAO.
- [x] ADR 038 (session fermée seulement pour un accès réellement fermé), ADR 037 (une fiche courrier
      ne garde plus de lien) ; ADR 034, 014, 002/003 non affectés.
- [x] Design system : le correctif ne touche aucune interface.

## Tests (lancés par le relecteur)

- Copie disque local (`git archive`, `.env.test`, `node_modules` en lien), `pnpm test --run` :
  **248 fichiers, 2986 passés, 4 ignorés, code 0**, aucun timeout (+4 par rapport à la revue 2 : un
  test de route retiré, cinq ajoutés). `tsc --noEmit` propre ; ESLint et Prettier propres sur le
  correctif et le plan.
- Les assertions fixent les comportements, pas seulement des appels.

## Régressions

- [x] Aucune. `e2e/member-accounts.spec.ts` ne compte ni sur un lien gardé après vidage de
      l'adresse, ni sur le repli `/dashboard`.

## Problèmes

- Critique : aucun.
- Majeur : aucun.
- Mineur : écart « Décision `unlink` » du plan incomplet (la décision est aussi rendue, sans effet,
  pour une fiche sans compte lié) — **corrigé après la revue** dans `53d5cffd`.

## Verdict

Les deux constats de la revue 2 sont réellement corrigés, sans régression. Ouvrir la PR ; les e2e de
la CI confirment les parcours (notamment la coupure du critère 6).

Max severity: minor
Ship allowed: yes
