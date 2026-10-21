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

## Constats de la CI de la PR 45 (run 39596447195)

La première exécution e2e sur la CI échoue : 11 tests en échec, 27 non lancés, 180 passés.

1. **Majeur — un compte ouvert par s12d ne peut pas se connecter par lien magique.** Le compte est créé
   avec `emailVerified = false`. À la vérification du lien, Better Auth appelle
   `revokeUnprovenAccountAccess`, qui pose un verrou par `internalAdapter.reserveVerificationValue` :
   insertion dans `verification` avec un `id` imposé (`forceAllowId`), un SHA-256 en base64url de
   43 caractères. La colonne `verification.id` est de type `uuid` (`src/db/models/auth-model.ts:92`) :
   Postgres refuse (`22P02 invalid input syntax for type uuid`) et la vérification part en erreur ; la
   page reste sur `/api/auth/magic-link/verify`. Les comptes du seed, vérifiés, ne passent jamais par ce
   chemin, d'où l'absence du défaut avant s12d (aucune occurrence dans le run vert de s12b). Échec :
   `member-accounts.spec.ts` critère 1 (trois tentatives, trois erreurs `uuid` dans le journal serveur à
   12:13:45, 12:14:09, 12:14:32) ; les 27 tests non lancés sont la suite de ce fichier.
   Correctif attendu : `verification.id` passe en `text` (le défaut `uuid_generate_v4()` reste valable,
   converti en texte), migration générée par `pnpm db:generate`, test unitaire qui fige le type de la
   colonne. Ne pas contourner en créant le compte avec `emailVerified = true` : l'adresse saisie par le
   bureau n'est pas prouvée, et s13 (import) et s15 (invitation) créeront aussi des comptes non vérifiés.
2. **Mineur — neuf specs antérieures attendent l'ancien titre de refus.** s12d remplace, pour le rôle
   `member`, l'écran « Cette page est réservée au bureau de l'association » par l'écran C4 (titre
   « Cette page ne vous est pas accessible », texte « Elle est réservée au bureau de l'association. »).
   Le changement est voulu (design C4) ; les specs n'ont pas suivi : `association-identity.spec.ts:366`,
   `association-settings.spec.ts:362`, `board-members.spec.ts:419`, `home-page.spec.ts:427`,
   `news.spec.ts:375`, `page-cms.spec.ts:278`, `site-alert.spec.ts:230`, `site-navigation.spec.ts:254`,
   `water-analysis.spec.ts:453`. Correctif : adapter leurs attentes à l'écran C4 (titre de niveau 1 et
   texte), sans affaiblir l'assertion.
3. **Mineur — `member-profiles.spec.ts:751` ambigu.** `getByText(email)` trouve aussi l'adresse dans la
   confirmation « Compte ouvert. … » ajoutée par s12d (violation du mode strict). Correctif :
   `{exact: true}` ou ciblage du `dd` de la fiche.

## Revue n° 5 — correctif `bd79b1ad`, relecteur en contexte neuf

- **Constat CI 1 corrigé.** `verification.id` est en `text` (défaut `uuid_generate_v4()::text`), migration
  `0034_icy_madripoor.sql` générée par drizzle-kit (snapshot chaîné sur 0033, diff limité à la colonne).
  SQL rejoué par le relecteur sur une table temporaire à lignes uuid (transaction annulée) : conversion,
  insertion d'un id base64url de 43 caractères, défaut valides. Aucune clé étrangère ni aucun code ne
  suppose un uuid ; les deux flux qui posent le verrou (lien magique, OTP email) sont couverts. La CI
  applique la migration par `pnpm db:migrate`. Test `src/db/verification-model.test.ts`.
- **Constat CI 2 corrigé.** Les neuf specs attendent le titre de niveau 1 « Cette page ne vous est pas
  accessible » et « Elle est réservée au bureau de l’association. » (identiques à `messages/fr.json`) ;
  assertions renforcées ; `user@gmail.com` est bien `member` de TechCorp, donc voit l'écran C4. Plus
  aucune occurrence de l'ancien écran attendue pour un membre simple dans `e2e/`.
- **Constat CI 3 corrigé.** `getByText(email, {exact: true})` ne cible que le `dd` de la fiche.
- Suite unitaire relancée par le relecteur (copie disque local) : **249 fichiers, 2988 passés,
  4 ignorés**, code 0, aucun timeout. Aucun nouveau constat.
- Reste à confirmer par la CI : `member-accounts.spec.ts` critère 1 et les 27 tests qui le suivent.

## Constat de la deuxième CI de la PR 45 (run 39609810690)

213 passés, 1 en échec, 4 non lancés (la suite sérielle de `member-accounts.spec.ts`). Le critère 1
passe désormais : le correctif `verification.id` est confirmé.

1. **Majeur — critère 3 : sur l'association B, l'espace membre ne trouve pas la fiche.**
   `member-accounts.spec.ts:447`. Fiche créée **avec** une adresse sur A, puis la même adresse sur B
   (création, pas modification) ; `accountOf` montre bien un seul `user` et deux lignes `member`
   (B puis A) ; fermeture sur A, la ligne `member` de A part. La connexion par lien sur B
   (`127.0.0.1`) aboutit sur `/dashboard`, mais la page montre le titre générique « Votre espace
   membre » (`MemberSpacePage.title`) au lieu de « Bonjour {nom} » : `getMyParcelsService` rend
   `undefined` ou une fiche sans parcelle (les deux donnent l'écran C5 ; la revue n° 6 a établi que
   c'était le second cas). Échec aux
   trois tentatives. Le critère 1, qui crée la fiche **sans** adresse puis l'ajoute (chemin de
   modification), passe. Cause à établir (le test ne vérifie pas `user_id` de la fiche B) : lien jamais
   posé sur la fiche B au chemin de création, lien retiré par la fermeture sur A, ou autre. Correctif
   attendu : cause prouvée par un test qui échoue d'abord, puis correction ; et le test e2e vérifie en
   plus `user_id` des deux fiches après chaque étape, pour localiser un futur échec.

## Revue n° 6 — correctif `2a454789`, relecteur en contexte neuf

- **Cause : le test e2e, pas le code.** La fiche de B était créée sans parcelle ; une fiche liée sans
  parcelle affiche l'écran C5 (« Votre espace membre »), comme le prévoit le design (« Pas d'état vide
  distinct … sinon c'est C5 »), arbre identique au snapshot de la CI. Le chemin de création avec adresse
  (compte existant sur A) pose bien le lien sur B dans la même transaction que la ligne `member`
  constatée par la CI ; la fermeture sur A ne touche pas B.
- **Correctif (tests seulement).** Le critère 3 rattache une parcelle à la fiche B, vérifie `user_id`
  des deux fiches après création et après la fermeture sur A (A vidée, B toujours liée) et « Mes
  parcelles » sur B. Test unitaire de la page : C5 pour une fiche liée sans parcelle.
- **Suite de la série** (critère 4 ×2, critère 6, fiche du bureau) relue : pas le même piège.
- Suite unitaire relancée par le relecteur : **249 fichiers, 2989 passés, 4 ignorés**, code 0.
- Mineurs : le nouveau test unitaire est rangé sous le `describe` « compte sans fiche » (laissé tel
  quel) ; l'affirmation non prouvée du constat de la deuxième CI — corrigée ci-dessus.

Max severity: minor
Ship allowed: yes
