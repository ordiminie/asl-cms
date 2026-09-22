# Revue — Story s03c-session-multi-domaine (après amend)

> J'ai fait cette revue dans un contexte neuf. Chaque problème est classé critique, majeur ou mineur.
> Diff examiné : `git diff main...feature/s03c-session-multi-domaine`, un seul commit, bec8103, 13 fichiers.
> Écart depuis la revue précédente (sur 1f07329, verdict `Ship allowed: yes`, mineurs seulement) : `git diff 1f07329 bec8103`. Les deux commits ont le même parent (4cccf5b, qui est aussi `main`), donc cet écart contient tout l'amend et rien d'autre.

## Écart de l'amend (1f07329 → bec8103)

Il touche 3 fichiers (19 lignes ajoutées, 12 retirées) et ne corrige que les deux points mineurs visés. Aucun comportement ne change.

- **`src/lib/better-auth/magic-link-integration.ts`** : `isMemberOf` est déplacée, à l'identique, à la fin du fichier. Le JSDoc « Revoque les liens encore en attente… » est de nouveau juste au-dessus de `revokeEarlierMagicLinks` (lignes 122-144).
  - Le déplacement est sans risque : `isMemberOf` est une `const` appelée seulement à l'exécution de `sendMagicLink`, donc après l'évaluation du module. Il n'y a pas de problème de TDZ.
  - Le premier point mineur est corrigé.
- **`docs/decisions/022-lien-et-session-sur-le-domaine-de-l-association.md`** (Conséquences) et **`docs/architecture.md`** : documentation seulement. Le deuxième point mineur est corrigé, avec une réserve de précision (voir ci-dessous).

Comme l'amend ne change rien à l'exécution, **je n'ai pas relancé les e2e**. Ils avaient passé sur 1f07329 : suite chromium 94/94, sur le build de production, d'après la revue précédente. Le code exécuté est identique à l'ordre d'une déclaration près.

## Contestation de l'implémenteur — vérifiée dans better-auth 1.7.1

J'ai tout vérifié dans `node_modules/better-auth/dist`.

- **`api/middlewares/origin-check.mjs:43`** : `originCheckMiddleware` sort tout de suite pour `GET`, `OPTIONS`, `HEAD` et quand il n'y a pas de requête. C'est vrai. Pour les autres méthodes, `validateOrigin` (ligne 108) rappelle `options.trustedOrigins(request)`, mais seulement si la requête porte un cookie (ligne 106). Sans cookie, la fonction n'est pas rappelée.
- **`formCsrfMiddleware`** (sign-in, sign-up, email-otp) : avec un cookie, il appelle `validateOrigin` (ligne 133). C'est vrai.
- **`auth/base.mjs:35`** : `getTrustedOrigins` est appelée sans condition à chaque requête du handler, puisque `baseURL` est fixe (branche `else`). C'est vrai.
- **Conclusion** : un `get-session` du client, en `GET`, coûte **une** lecture ; une requête avec cookie hors `GET`/`HEAD`/`OPTIONS` (déconnexion, par exemple) en coûte **deux**. La contestation est fondée. Le constat précédent (« deux lectures par get-session ») était faux sur ce point.
- **Imprécision restante** : l'ADR écrit que le rafraîchissement du `get-session` passe en `POST` et coûte deux lectures. Ce n'est pas vrai dans la configuration du dépôt. Dans `client/session-atom.mjs:75`, le `POST /get-session` n'est émis que si la réponse porte `needsRefresh`, et ce drapeau n'existe qu'avec `session.deferSessionRefresh` (`api/routes/session.mjs:181`). `auth.ts:68` ne l'active pas : sans lui, un `POST /get-session` est refusé (`METHOD_NOT_ALLOWED`, ligne 37) et le rafraîchissement se fait dans le `GET` lui-même (ligne 191). Ici, le rafraîchissement coûte donc **une** lecture. C'est un détail de documentation (mineur, ci-dessous) ; le coût global reste bien décrit.

## Conformité au plan

- [x] Le code fait ce que le plan demande, rien de plus. Les 7 tâches (`associationOriginOf`, `rebaseMagicLinkUrl`, `sendMagicLink` avec rebasage, logo et non-membre, `trustedOriginsOf`, client sans `baseURL`, e2e sur deux domaines, documentation) sont toujours présentes, sans changement depuis 1f07329. L'amend n'ajoute rien hors du plan. La stabilisation de `requestLink` en e2e reste un écart justifié, pas une dérive.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. J'ai rouvert :
  - `getOrganizationByDomainService` (`organization-service-facade.ts:58`) ;
  - `normalizeTenantHost` (`tenant-helper.ts:11`) ;
  - `BETTER_AUTH_TRUSTED_ORIGINS` (`src/env.ts:61`, `src/env-schemas.ts:80`) ;
  - `trustedOrigins` en fonction (type dans `@better-auth/core` `init-options.d.mts`, appels dans `context/helpers.mjs:78-80` et `origin-check.mjs:108`) ;
  - les lignes citées par l'ADR : `auth/base.mjs:35` et `origin-check.mjs:108`, exactes toutes les deux.
- [x] Aucune valeur ni logique plausible mais fausse qui ait des conséquences. Le seul écart est une phrase de documentation, sans conséquence.
- [x] Le code fait ce qu'il annonce.

## Respect des règles

- [x] Conventions du dépôt (AGENTS.md) respectées :
  - un seul commit de story ;
  - aucune valeur en dur ;
  - aucun `withRlsBypass()` ;
  - aucune migration ni variable d'environnement ajoutée ;
  - le nouveau code est placé en fin de fichier (c'est l'objet du premier correctif).
- [x] Aucun ADR accepté n'est contredit. L'ADR 022 est appliqué, et l'ADR 003 et l'ADR 005 restent cohérents.
- [x] Design system : sans objet (la story n'a pas d'écran).

## Tests

- [x] J'ai lancé moi-même, sur HEAD = bec8103 :
  - `pnpm test --run` : **96 fichiers réussis, 2 ignorés ; 1013 tests réussis, 8 ignorés**, code de sortie 0 ;
  - `pnpm lint` : 0 erreur, 2 avertissements dans des fichiers non suivis hors du diff (`.remember/`, `.scratch/`) ;
  - `pnpm exec tsc --noEmit` : code de sortie 0 ;
  - `pnpm check:rules` : « Règles et documentation alignées sur le code. »
  - e2e non relancés (voir plus haut) ; suite complète 94/94 sur 1f07329, sur le build de production.
- [x] Les assertions vérifient les critères d'acceptation, sans changement depuis la revue précédente :
  - le lien rebasé est exigé par `not.toContain(url)` ;
  - pour le non-membre : quota consommé, aucun email, aucune révocation ;
  - en e2e : cookie présent sur un domaine et absent sur l'autre, et renvoi vers la connexion sur B avec la session de A.

## Régressions

- [x] Aucun effet sur les chemins existants. Le SuperAdmin garde la connexion par mot de passe. Les appels `auth.api.*` sans requête ne lisent rien en base. L'URL du logo reste la même en HTTPS. L'amend n'y change rien.

## Constats

- **mineur (nouveau, documentation)** — `docs/decisions/022-lien-et-session-sur-le-domaine-de-l-association.md` (Conséquences) : « son rafraîchissement (`POST`) … deux » est inexact dans cette configuration. Le client n'émet `POST /get-session` qu'avec `session.deferSessionRefresh`, absent de `auth.ts`. Sans lui, le rafraîchissement a lieu dans le `GET` et coûte une lecture. Il suffit d'écrire « la déconnexion, et toute requête avec cookie hors GET/HEAD/OPTIONS, deux ». `docs/architecture.md` est exact.
- **mineur (reporté)** — `src/lib/better-auth/association-origin.ts` (`requestHostOf`, utilisé par `trustedOriginsOf`) : la fonction tient compte de `x-forwarded-host`, que Better Auth n'honore pas sans `advanced.trustedProxyHeaders`. Les deux choix de l'hôte peuvent donc diverger. Le risque est faible : l'origine ajoutée vient de la base. Le point est déjà noté « à vérifier en s12b ».
- **mineur (reporté)** — `src/lib/better-auth/association-origin.ts` (`onOrigin`) : une adresse de retour dans un schéma non HTTP (par exemple `javascript:x`) donne une chaîne mal formée (`http://127.0.0.1:3000x`). Ce cas est inatteignable, puisque l'`originCheck` de Better Auth rejette ces valeurs avant, et ne permet aucune sortie du domaine. C'est un point de durcissement.
- **Résolus par l'amend** : le JSDoc mal placé de `revokeEarlierMagicLinks`, et le coût de `trustedOrigins` dans l'ADR et dans `architecture.md` (corrigé, sauf la nuance ci-dessus).

## Verdict

L'amend ne contient que les deux correctifs de documentation et de placement annoncés, sans changement à l'exécution. La contestation de l'implémenteur est fondée : je l'ai vérifiée dans better-auth 1.7.1. Le reste du diff tient toujours : suite unitaire, lint, types et règles au vert, relancés par moi. Aucun critique, aucun majeur.

Max severity: minor
Ship allowed: yes
