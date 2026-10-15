# Revue (4e passage) : story s46b-connexion-limitee-association

> Revue faite sans le contexte de l'auteur. Chaque constat est classé : critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s46b-connexion-limitee-association`, soit quatre commits : `ff1d3c8`, `24b59ee`, `3850c4b` et `8b8948f`. `8b8948f` a été relu comme du code neuf ; le reste du diff a été repris en entier.
> La story n'a pas d'écran (aucun fichier `docs/designs/s46b-*`), donc pas de contrôle de conformité au design.

## Ce que le relecteur a lancé lui-même

Tout a tourné sur une copie de la branche en disque local (via `git archive`), avec `node_modules` lié. Rien n'a été modifié dans le dépôt.

- **Suite complète** : `NEXT_PUBLIC_ENABLED_PAGES=account,admin pnpm test --run`.
  - 222 fichiers de test réussis sur 222.
  - 2670 tests réussis, 1 ignoré.
  - Code de sortie 0, aucun timeout.
- **Tests ciblés** : `action.test.ts` et `email-verification-link.real-auth.test.ts`, 53 tests sur 53 réussis.
- **`tsc --noEmit`** : aucune erreur.
- **`eslint`** sur les huit fichiers touchés par `8b8948f` : rien à signaler.
- **`pnpm check:rules`** : « Règles et documentation alignées sur le code ».
- **Tests de mutation**, sur la copie seulement, pour le test qui utilise un vrai Better Auth :
  - Plugin `associationSessionGuard()` retiré : seul le test « vérification d'email sur l'hôte de la plateforme : 500 » échoue. Le refus du contrôle d'association reste donc bien testé.
  - `trustedOrigins: []` : 4 tests échouent (les deux liens sur l'association, la vérification d'email par HTTP, la réinitialisation sur l'association). L'acceptation par `trustedOriginsOf` est donc réellement prouvée.
  - `disableOriginCheck: false` retiré : le test qui attend le 403 échoue. Le réglage est indispensable, et le test le garde.
- Aucun Playwright, aucun `pnpm build` (consigne : les e2e tournent en CI GitHub).

## Respect du plan

- [x] **Plan validé, décisions intactes.** `validated: yes` et les décisions A à M n'ont pas bougé. `8b8948f` n'ajoute que deux entrées à « Écarts après revue ».
- [x] **Entrée m7 du plan : exacte, avec une imprécision.** Elle annonce « non plus vers `/login` ou le message `connectionError` ». Pour le code de secours et l'OTP, l'ancien message était `verificationError`, pas `connectionError`. Sans conséquence (m11).
- [x] **Entrée m3 du plan : exacte.** Sur `main`, les quatre services retirés n'étaient appelés que par :
  - le code retiré par la décision K (`handleFullCheckoutSessionCompleted` et la branche invitée, `stripe-events.ts:276, 463, 556, 594, 626` sur `main`) ;
  - ou les actions d'inscription retirées (`isEmailAvailableService`).
  - `getBillingReferenceId` n'avait pour appelant que `getBillingContext`.
- [x] **Rien en plus de ce que le plan demande.** Les retraits de `8b8948f` couvrent exactement m3, et la suite exacte de la décision K.

## Vérification des références (rien d'inventé)

- **`8b8948f`, `action.ts`** : `logger` vient de `@/lib/logger` (serveur), `getPostLoginPathOfAccountDal` de `src/app/dal/user-dal.ts`, `isRedirectError` est importé depuis `next/dist/client/components/redirect-error`. Tous existent.
- **`/dashboard` est une vraie page** : `src/app/[locale]/(app)/dashboard/page.tsx` existe, et le chemin figure dans `POST_LOGIN_PATHS` (`association-authorization.ts`).
- **Better Auth 1.7.1** (version confirmée dans le `package.json` du paquet) :
  - `advanced.disableOriginCheck` est lu par `context/create-context.mjs:210`. Sous test, il vaut vrai par défaut ; le fixer à `false` réactive le contrôle.
  - `originCheck((ctx) => ctx.query.callbackURL)` est bien appliqué à `/verify-email` (`api/routes/email-verification.mjs:131`). Un `callbackURL` refusé lève `FORBIDDEN` `INVALID_CALLBACK_URL` (`api/middlewares/origin-check.mjs`), d'où le 403 attendu.
  - Le refus d'ouvrir une session à la vérification d'email lève `INTERNAL_SERVER_ERROR` `FAILED_TO_CREATE_SESSION` (`email-verification.mjs:217/252/299`), d'où le 500.
- **m2** : `signInEmail` rend `UNAUTHORIZED` `FAILED_TO_CREATE_SESSION` (`sign-in.mjs:354-356`). Le jeu de données du test, `jsonResponse(401, {code: 'FAILED_TO_CREATE_SESSION'})`, est donc juste.
- **m3, aucun appelant restant** : `git grep` sur la branche (src, e2e, scripts, .claude, .cursor, docs hors plans/recherches/revues) ne trouve plus aucune occurrence des six symboles.
  - L'import `OrganizationRoleConst` est retiré.
  - Les imports restants de `subscription-service.ts` (`getAuthUser`, `getUserOrganizationsService`, `getSubscriptionByUserIdDao`, `getUserByIdDao`, `BILLING_MODE`…) sont toujours utilisés, ce que `tsc` et `eslint` confirment.
  - Les façades sont cohérentes : l'intercepteur est construit par `createServiceInterceptor` sur le module, et chaque export retiré de la façade correspond à une fonction retirée du service.
  - Le paiement en plusieurs fois encore en place (`handleInstallmentCheckoutSessionCompleted`) n'importe que `createSubscriptionFromStripeService` et `getUserByEmailDao`. Aucun chemin Stripe encore utilisé n'est cassé.

## Points de `8b8948f` vérifiés un par un

- **m7, repli après connexion.**
  - `redirect()` est hors du `try/catch` (`action.ts:157`). `postLoginPathOfSignedInAccount` ne contient aucun `redirect`.
  - `getPostLoginPathOfAccountDal` → `getUserByEmailService` + `getCurrentTenantDal` ne lèvent aucun signal de contrôle de Next (`getCurrentTenantDal` n'appelle pas `notFound()` ; c'est `requireCurrentTenantDal` qui le fait). Le `catch` ne peut donc avaler aucune redirection ni aucun `notFound`.
  - La redirection levée par `redirect()` remonte par le `isRedirectError` déjà en place dans chaque action.
  - La journalisation passe par le logger serveur, sans l'email dans le message.
  - Les tests le prouvent : `toHaveBeenCalledTimes(1)` sur `redirect` et `rejects.toBe(redirectSignal)` échoueraient si la redirection était avalée puis rejouée. Les trois actions et les deux cas (compte introuvable, lecture en échec) sont couverts.
- **m8.** L'ADR 034 et le commentaire du test n'annoncent plus que ce que le test prouve, ce que confirment les mutations ci-dessus :
  - **Prouvé** : l'acceptation des `callbackURL` absolus sur l'association par `trustedOriginsOf` ; le 403 `INVALID_CALLBACK_URL` sur la plateforme ; le 500 du contrôle d'association à la vérification ouverte sur la plateforme.
  - **Pas rejoué, et l'ADR le dit honnêtement** : le 500 du changement d'adresse avant correctif.
  - **Le refus du contrôle d'association reste testé** par le test « vérification d'email sur l'hôte de la plateforme ».
- **m6.** Le `TextEncoder` d'origine est capturé dans `vi.hoisted`, avant la substitution, puis restauré dans `afterAll`. C'est correct : `jose` a déjà capturé son encodeur au chargement, donc restaurer en fin de fichier ne change rien aux tests.
- **ADR 034 modifiée** : l'ADR est créée par cette story et n'est pas encore fusionnée. La retoucher sur sa propre branche ne contredit pas la règle d'immuabilité, qui vaut pour une ADR acceptée sur la branche par défaut.

## Respect des règles

- [x] **Conventions d'AGENTS.md** : logger serveur, aucun `process.env`, aucun nouveau `withRlsBypass`, aucune valeur métier codée en dur. `/dashboard` est une route, pas un paramètre d'association.
- [x] **Aucune ADR acceptée contredite** :
  - 034 : contrôle unique à l'ouverture de session, refus par `false` ;
  - 003 : tenant résolu côté serveur depuis le domaine ;
  - 013 : Route Handler en 307 ;
  - 014 et 022 : origines de confiance par association.
- [x] Design : sans objet (story sans écran).

## Tests

- [x] Suite lancée par le relecteur : verte (chiffres en tête de rapport).
- [x] **Les assertions épinglent les critères**, avec trois réserves :
  - m4 : les e2e n'ont pas tourné ;
  - m10 : le repli quand l'email manque n'est pas testé ;
  - m9 : le test du 500 ne vérifie pas l'absence de cookie de session.

## Régressions

- [x] **Aucun impact sur les chemins existants.**
  - Le repli ne change que le cas « session ouverte mais compte illisible » : avant, l'utilisateur recevait `/login` ou un message d'erreur ; maintenant il va sur `/dashboard`.
  - Le chemin Stripe encore utilisé n'est pas touché par `8b8948f`.

## Constats

### Critiques

Aucun.

### Majeurs

Aucun.

### Mineurs

- **m1 (connu, gardé pour s12b)** — `src/lib/better-auth/association-origin.ts:8-11`
  - `requestHostOf` fait confiance à `x-forwarded-host` sans proxy de confiance. Cet en-tête choisit l'association du contrôle de session et celle des liens d'email.
  - Pas de fuite : seul un domaine enregistré peut sortir.
  - s12b doit exiger que le reverse proxy écrase cet en-tête.
- **m4 (connu)** — `e2e/auth.spec.ts`, `e2e/magic-link.spec.ts`
  - Ces specs ne tournent qu'en CI GitHub et n'ont pas été exécutées pour cette revue. Elles portent l'accès croisé, les destinations par rôle, la barre d'adresse après une Server Action et le refus d'inscription par le serveur.
  - Condition maintenue : **pas de fusion sans e2e vert en CI.**
- **m10 (nouveau, effet de bord de m7)** — `src/app/[locale]/(auth)/action.ts:165-177`
  - Quand l'email n'est pas connu après la connexion (`signedInEmailOf` rend `undefined` sur une réponse 2FA sans `user.email`), l'utilisateur va désormais sur `/dashboard` au lieu de `/login`, et le journal dit « Compte introuvable ».
  - La session est déjà ouverte, donc `/dashboard` est le choix le plus cohérent ; ce n'est pas une régression.
  - Mais aucun test ne couvre cette branche (les tests m7 passent tous un email), et le message du journal ne distingue pas « email absent » de « compte introuvable ».
- **m9 (nouveau, très léger)** — `src/lib/better-auth/email-verification-link.real-auth.test.ts:266-273`
  - Le contre-exemple « vérification sur l'hôte de la plateforme » n'asserte que le statut 500 et `emailVerified`. Il ne vérifie ni le code `FAILED_TO_CREATE_SESSION` ni l'absence de `set-cookie`.
  - La mutation montre qu'il échoue bien sans le contrôle d'association. La preuve tient, mais elle repose sur le seul statut.
- **m11 (rédaction du plan)** — `docs/plans/s46b-connexion-limitee-association.md`, entrée m7 de « Écarts après revue »
  - Elle cite `connectionError`. Pour le code de secours et l'OTP, l'ancien message était `verificationError`.

m2, m3, m6, m7 et m8 de la revue précédente sont corrigés et vérifiés ci-dessus.

## Checklist (templates/review-checklist.md)

- [x] Le code fait ce que le plan demande, rien de plus.
- [x] Aucune API, fonction ou import inventé (chacun ouvert et vérifié).
- [x] Aucune valeur ni logique plausible mais fausse (401, 403 et 500 vérifiés dans Better Auth 1.7.1).
- [x] Le code fait ce qu'il annonce (ADR 034 et commentaires de test alignés sur ce que les tests prouvent).
- [x] Conventions du dépôt respectées (AGENTS.md).
- [x] Aucune ADR acceptée contredite.
- [x] Design system : sans objet (pas d'écran).
- [x] Suite lancée par le relecteur, verte.
- [x] Les assertions épinglent les critères (réserves m4, m9, m10).
- [x] Aucun impact sur les chemins existants.

## Verdict

Il ne reste aucun constat critique ni majeur. Les mineurs m2, m3, m6, m7 et m8 sont corrigés, et le nouveau code de `8b8948f` est correct. Restent des mineurs : m1 et m4, connus et gardés volontairement, et les nouveaux m9, m10 et m11, cosmétiques ou de couverture. Condition maintenue : pas de fusion sans e2e vert en CI (m4).

Max severity: minor
Ship allowed: yes
