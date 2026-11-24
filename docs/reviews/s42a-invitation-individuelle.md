# Revue — Story s42a-invitation-individuelle

Tour 1 — commit `18e20fb2`, diff `git diff main...feature/s42a-invitation-individuelle`. Revue en
contexte neuf (subagent `reviewer`), en lecture seule.

Aucun constat critical ni major. Six mineurs, à traiter au tour final des mineurs.

## Résultats des tests

Suite lancée sur une copie en disque local, identique à la branche (fichiers du diff, `src`, `e2e`,
`messages`, `package.json`, `vitest.config.ts`).

- `pnpm test --run` : `Test Files 1 failed | 453 passed (454)`, `Tests 1 failed | 6196 passed | 4 skipped (6201)`, 356 s.
  - L'échec est `campaign-composer.test.tsx > … > la cible choisie part avec l'aperçu et avec l'envoi`,
    `Test timed out in 5000ms`. Fichier de s27, hors du diff. Relancé seul avec
    `association-settings-form.test.tsx` : `Test Files 2 passed (2)`, `Tests 90 passed (90)`.
  - Ce dépassement n'est pas compté comme vert : c'est le phénomène de charge déjà connu, pas un défaut
    de la story.
- `association-settings-form.test.tsx` : vert, en suite complète comme seul. Les deux champs ajoutés
  alourdissent un peu le rendu des Réglages : aggravation marginale de dépassements préexistants, aucun
  observé sur ce fichier. (Côté implémenteur, un premier passage complet y avait vu 5 dépassements ; le
  passage suivant, vert : `Tests 6197 passed | 4 skipped (6201)`.)
- `pnpm exec tsc --noEmit` : sortie 0.
- `eslint` sur les fichiers ajoutés ou modifiés de `src` et `e2e` : sortie 0.
- Ni build ni e2e en local (e2e en CI).

## APIs vérifiées (better-auth 1.7.1) — aucune hallucination

- `auth.api.signInMagicLink` : `body.metadata` (`z.record(z.string(), z.any())`) transmis tel quel à
  `sendMagicLink({email, url, token, metadata}, ctx)` ; `errorCallbackURL` accepté ; jeton stocké en clair
  (`storeToken` par défaut).
- `formCsrfMiddleware` : `if (!ctx.request) return;` — sans `Request`, pas de contrôle CSRF (ADR 071 §1).
- `databaseHooks.session.create.after` (`db/with-hooks.mjs`) : appelé après la transaction ; la ligne
  porte `impersonatedBy` (`admin/routes.mjs:597`).
- `internalAdapter.deleteVerificationByIdentifier` existe (`internal-adapter.mjs:763`).
- `adapter.update` / `deleteMany` du contexte : prolongation prouvée sur un vrai Better Auth
  (`invitation-link.real-auth.test.ts`, ligne à J+7).
- Dépôt : `getOrganizationByIdDao`, `getActiveEmailCarriersDao`, `getUserByEmailDao`, `isMemberOf`,
  `canOpenSessionOn`, `accountOfEmail`, `readProfileEmails`, `requireMemberProfileManager`,
  `getCurrentAssociationSettingsDal`, `getAssociationSettingsDal`, `pngLogoUrlOf`, option
  `shouldLogDetails` de `createServiceInterceptor` : tous existent sous ces noms et signatures.

## Définition de fini du plan

- Un seul appel à `signInMagicLink` hors de l'action de connexion : `src/lib/better-auth/invitation-link.ts:59`.
- Ni lien ni jeton dans les journaux : intercepteur en `shouldLogDetails: () => false` ; les nouveaux
  `logger.*` ne journalisent que des noms d'erreur.
- Ni lien ni jeton dans l'email conservé : URL brute, URL du HTML (`&amp;`), échéance et jeton remplacés
  par des marques, jeton révoqué ; testé sur un vrai rendu (`invitation-email-service.real-i18n.test.tsx`).
- Critère 7 : `revokeEarlierMagicLinks` sur l'adresse du compte en minuscules ; prouvé sur le vrai Better
  Auth (seul le dernier jeton subsiste) et en e2e (ancien lien → page du lien invalide, variante invitation).
- 7 jours contre 20 minutes : `expiresIn` global du plugin intact ; invitation prolongée à J+N
  (`invitation.link_days`, 1 à 30, défaut 7, seed 7) ; la page du lien invalide lit `?motif=invitation`.
- Première connexion hors imitation (s48) : le hook s'arrête sur `impersonatedBy`, ne trace qu'un membre
  de l'association du domaine, avale toute erreur ; test unitaire et e2e.
- Texte du tenant échappé : aucun `dangerouslySetInnerHTML` ; une balise reste du texte (testé).
- Texte par défaut : aucune fonctionnalité postérieure citée.
- Migrations : `0079` générée, `0080` par `--custom` sur le patron de `0078` ; journal cohérent
  (`prevId` 0078 → 0079 → 0080), snapshots 0079/0080 ne diffèrent que par `id`/`prevId`.
- RLS : `organization_id`, RLS activée et forcée, policy `tenant_isolation` ; `getDb()` et `withTenant`
  partout ; aucun nouveau `withRlsBypass` ; accès croisé en e2e (`member-invitations.spec.ts:535`) et appel
  direct de l'action de A sur une fiche de B (`:449`) ; `docs/architecture.md` à 57 tables dont 38 sous
  RLS forcée.
- Rien en dur : texte et durée en réglages, libellés dans `messages/fr.json`.
- Canal `metadata.invitation` : un corps JSON ne porte pas de fonction, route HTTP fermée
  (`MAGIC_LINK_DISABLED_HTTP_PATHS`), l'action de connexion ne passe que `{locale}`.

## Écarts déclarés par l'implémenteur

- (a) `getOrganizationByIdDao` chargé par `import()` dans `sendMagicLink` : acceptable. Le fichier appelait
  déjà `getUserByEmailDao` ; `organization` est la table tenant, hors RLS ; l'identifiant vient du seul
  code serveur ; la façade exige une session, absente au rejeu. `expiresInDays` dans
  `metadata.invitation` : acceptable (durée lue à la génération, comme le veut l'ADR).
- (b) Compte non membre → `null` et jeton supprimé : acceptable, testé sur le vrai Better Auth.
- (c) Lecture de l'état dans `readProfileView` : acceptable, même scope tenant, DTO sans type Drizzle.
- (d) Section « Invitation des membres » en dernière position des Réglages : acceptable, testé.
- (e) Envoi partiel (arrêt à la première erreur) : conforme au plan ; voir m1 et m2 pour l'affichage.
- (f) Pas d'e2e « invitation reportée puis rejouée » : permis par le plan (`email-budget.spec.ts` ne
  déclenche pas le planificateur). Preuve hors requête unitaire : vrai Better Auth sans requête et rejeu
  dans `deferred-email-delivery.test.ts`. **La PR doit le dire.**
- (g) Gap « envoi partiel » : remonté dans le design de la story (gaps 2 et 3), l'écran compose
  `Alert destructive` existant. À verser au §9 du design system (m6).

## Constats

Aucun critical, aucun major.

**m1 — Issue « deferred » mêlée à des envois partis, mal annoncée et sans rafraîchissement**

- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` (`toInvitationActionResult`),
  `member-profile-detail.tsx` (`InvitationOutcome`).
- Avec `sent=[a]` et `deferred=[b]`, le service rend `deferred` : l'écran dit seulement « L'invitation
  partira demain matin », sans nommer `a`, et rien n'est revalidé alors que « Invitée le » vient d'être
  écrit pour `a`.
- Correctif : revalider dès que `sent` n'est pas vide, nommer les adresses parties.

**m2 — Envoi partiel sans envoi réel : liste vide**

- `actions.ts` (rend `partial` sans `deferred`), `member-profile-detail.tsx` (`t.rich('partial', …)`).
- Première adresse reportée, deuxième en erreur → `partial` avec `sent=[]` : « L'invitation n'est partie
  qu'à . ».
- Correctif : transmettre `deferred` et choisir le message selon le contenu des listes.

**m3 — `fields.invitationLinkDays.help` écrit « 20 minutes » en dur**

- `messages/fr.json`. `invalidMagicLink.explanation` reçoit `{minutes}` depuis
  `MAGIC_LINK_EXPIRES_IN_MINUTES`, ce libellé non : il se désynchroniserait si la constante changeait.
- Correctif : paramètre `{minutes}`.

**m4 — La révocation porte sur l'adresse, toutes associations confondues**

- `magic-link-integration.ts` (`issueInvitation` → `revokeEarlierMagicLinks`).
- Un compte membre de A et de B, invité par B, perd son lien d'invitation encore valide sur A, alors que
  la fiche de A affiche toujours « Invitée le ». Hérité du lien demandé, rare (un seul client) ; à noter
  pour s42b.

**m5 — Invitation reportée rejouée même si une invitation est partie entre-temps**

- `email-service.ts` (`deferredInvitationToSend`).
- Deux clics budget épuisé, ou report suivi d'un envoi réussi le même jour : un second email le
  lendemain, qui consomme du budget et révoque le lien de la veille.
- Correctif : au rejeu, sauter la ligne si `last_invited_at` est postérieur au report, ou retirer les
  invitations reportées de la même adresse à la réinvitation.

**m6 — Gap « envoi partiel » à verser au §9 de `docs/design-system.md`**

- Prévu par la liste des fichiers du plan ; au tour final des mineurs.

Note hors constat : les membres connectés avant le déploiement afficheront « Jamais invitée » (pas de
reprise d'historique). Inhérent ; à dire au bureau au déploiement.

## Plan, tâche par tâche

- Tâches 1 à 10 présentes et cochées ; tests demandés présents (cinq profils dans le service ; hook :
  écrit, imitation, SuperAdmin, autre association, erreur avalée ; report et rejeu ; composants et action ;
  e2e sur A puis B).
- Ajouts hors plan, dans le périmètre des tâches 3, 6 et 9 : motif `INVITATION_ERROR_CALLBACK_URL`, trace
  `afterSent` du rejeu, `dayOfInstant`.
- `theme.ts` non modifié : les jumelles sombres existaient déjà.
- Déploiement : migrations 0079 et 0080 à appliquer, aucune nouvelle minuterie.

Max severity: minor
Ship allowed: yes
