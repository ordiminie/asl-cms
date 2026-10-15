# ADR 034 — La connexion est limitée à l'association du domaine par un plugin Better Auth, à l'ouverture de la session

- Status: accepted
- Date: 2026-10-15
- Scope: story s46b-connexion-limitee-association

Complète l'[ADR 022](022-lien-et-session-sur-le-domaine-de-l-association.md) (lien et session sur le
domaine de l'association) et l'[ADR 003](003-resolution-tenant-par-domaine.md) (tenant par le domaine).

## Context

Avant s46b, seul le lien magique vérifie qu'un compte appartient à l'association du domaine appelé, et
seulement **à la demande** (`sendMagicLink` n'envoie rien à un non-membre). Le mot de passe, la double
authentification et Google ouvrent une session sur n'importe quel domaine. Un jeton de lien magique
émis sur A ouvre une session sur B. La story exige un contrôle **unique**, traversé par les quatre
modes, avec le SuperAdmin pour seule exception et le même message qu'un compte inconnu.

Trois faits, relevés dans Better Auth 1.7.1 (`docs/research/s46b-connexion-limitee-association.md`) :

- le seul point que les quatre modes traversent est la création de la session
  (`internalAdapter.createSession` → `createWithHooks`, `db/with-hooks.mjs:6-23`). Les hooks
  `session.create.before` y reçoivent `(session, context)`, et un `false` empêche la session ;
- **les hooks des plugins passent avant ceux de la configuration** (`context/helpers.mjs:15-45` :
  `dbHooks` reçoit d'abord chaque plugin, dans l'ordre du tableau `plugins`, puis `source: "user"`) ;
- le plugin `admin()` porte son propre `session.create.before`, qui lève `BANNED_USER` pour un compte
  banni (`plugins/admin/admin.mjs:33-48`). Placé dans `databaseHooks`, un contrôle d'appartenance
  passerait **après** lui : un compte banni de A qui se connecte sur B recevrait le message de
  bannissement, qui révèle que le compte existe.

## Decision

**Le contrôle vit dans un plugin Better Auth local, placé en tête du tableau `plugins`**, qui déclare un
seul hook `databaseHooks.session.create.before`. Ce hook applique une fonction pure
(`canOpenSessionOn(user, organization)`) partagée avec la demande de lien magique :

- l'association est celle du domaine appelé, lue dans `context.headers ?? context.request?.headers`
  par le même chemin que `sendMagicLink` (`requestHostOf` → `normalizeTenantHost` →
  `getOrganizationByDomainService`) ;
- la session est acceptée si le compte est `super_admin`, ou s'il a une ligne `member` dans cette
  association. Elle est refusée par un `false` dans tous les autres cas : domaine sans association,
  `context` nul ou en-têtes absents (**fermé par défaut**) ;
- le contrôle s'applique à **toute** création de session (vérification d'email, activation de la
  double authentification et imitation comprises), sans exemption par chemin. Une session n'est
  légitime sur un domaine que pour un membre de son association, quelle que soit la façon dont elle
  naît.

Le refus est un `false`, pas une `APIError` : Better Auth rend alors l'erreur générique de chaque mode
(`FAILED_TO_CREATE_SESSION`, `failed_to_create_session`, `unable to create session`), et l'action de
connexion la rend avec le message d'un compte inconnu.

## Considered options

- **Plugin local en tête de `plugins`** — retenu : un seul point, traversé par les quatre modes, qui
  passe avant le contrôle de bannissement du plugin `admin()`.
- **`databaseHooks.session.create.before` de la configuration** (à côté du contrôle de bannissement
  existant) — rejeté : il passe après le hook du plugin `admin()`, donc le bannissement d'un compte
  d'une autre association serait révélé.
- **Un contrôle dans chaque action de connexion** — rejeté : l'ouverture d'un lien magique
  (`GET /api/auth/magic-link/verify`) et le callback de Google ne passent par aucune action du projet.
  Quatre copies d'une même règle, et deux modes non couverts.
- **Un contrôle a posteriori, dans les layouts ou dans `src/proxy.ts`** — rejeté : la session existe
  déjà, et son cookie aussi. Un oubli de layout ouvrirait l'accès, et le refus ne pourrait plus
  ressembler à celui d'un compte inconnu.
- **Exempter certains chemins** (imitation, vérification d'email, double authentification) — rejeté :
  aucun n'a besoin d'ouvrir une session pour un non-membre. L'imitation n'a pas d'écran, et le
  SuperAdmin peut la faire sur le domaine de l'association visée.

## Consequences

- Chaque création de session coûte une lecture du compte et une lecture d'association, en plus de la
  lecture du compte du contrôle de bannissement existant.
- Toute action serveur qui appelle `auth.api.*` en ouvrant une session **doit transmettre les
  `headers`** de la requête : sans eux, le contrôle refuse. `loginCredentialAction` est corrigée par
  s46b ; un futur appel qui l'oublierait échouerait fermé.
- Toute session ouverte **par un lien d'email** doit naître sur le domaine de l'association : un lien
  construit sur l'hôte de la plateforme (`BETTER_AUTH_URL`, ADR 022) y crée sa session, que ce contrôle
  refuse à tout compte sauf le SuperAdmin.
  - **Lien magique** : rebasé sur l'origine de l'association depuis s03 (ADR 022).
  - **Vérification d'email et changement d'adresse** : rebasés de la même façon depuis la revue de s46b
    (`verificationLinkOnAssociation`, `email-verification-link.ts`). Sans cela, le changement d'adresse
    échouait en 500 sans changer l'adresse (Better Auth crée la session **avant** la mise à jour), et la
    vérification finissait en 500 **après** avoir marqué l'adresse vérifiée. L'hôte vient de la `Request`
    que Better Auth 1.7.1 passe au callback lors d'un appel HTTP ; lors d'un appel direct `auth.api.*`
    (Server Action, comme `changeEmailAction`), Better Auth ne passe aucune `Request` et ce sont les
    en-têtes de la requête Next qui servent. Hôte sans association (le SuperAdmin sur la plateforme) ou
    hors requête : le lien reste sur la plateforme, comme avant — seul le SuperAdmin peut y ouvrir la
    session. Prouvé sur un vrai Better Auth (`email-verification-link.real-auth.test.ts`).
  - **Lien OTP** de la double authentification : toujours construit sur `NEXT_PUBLIC_APP_URL`
    (`auth.ts`). Ouvert sur l'hôte de la plateforme, sa vérification est refusée. Dette connue (ADR 022,
    « Reste connu »), à traiter avec s12b.
- Google, en sommeil sans écran, a son callback sur l'hôte de la plateforme (`BETTER_AUTH_URL`) : il
  n'y ouvre de session que pour le SuperAdmin. La V2 devra donner un callback par domaine.
- La règle d'appartenance a une seule définition, et le lien magique l'utilise aussi : le SuperAdmin y
  reçoit désormais un lien sur tout domaine.
