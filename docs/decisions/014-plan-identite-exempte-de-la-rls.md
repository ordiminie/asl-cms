# ADR 014 — `member` et `invitation` sont le plan identité, exempté de la RLS

- Status: accepted
- Date: 2026-09-10
- Scope: story s01-provisionner-association

## Context

L'ADR 002 pose la règle : « RLS activée _et_ forcée sur toute table portant `organization_id` ».
Après le retrait ADR 009, exactement **trois** tables portent cette colonne : `member`, `invitation`
et `user_submissions`. La tâche 7 de s01 a donc posé la policy `tenant_isolation` sur les trois, et
la mesure a immédiatement montré que l'application ne fonctionne plus.

**Mesuré le 2026-09-10**, base de développement, rôle `asl_app` (`rolsuper=f, rolbypassrls=f`),
build de production :

| Mesure                                                        | Résultat                                   |
| ------------------------------------------------------------- | ------------------------------------------ |
| `select count(*) from member` hors scope de tenant            | **0** (le propriétaire en voit 11)         |
| `insert into member (…)` hors scope de tenant                 | **refusé** par la policy                   |
| `GET /api/auth/get-session` pour un membre de 3 organisations | `organizations: []`                        |
| `/en/account/organizations`                                   | « No organization »                        |
| Inscription d'un nouvel utilisateur (`auth.ts:302`)           | **cassée** — l'`insert(member)` est refusé |

La cause n'est pas un oubli de scope : c'est que la lecture principale de `member` est
**inter-tenant par construction**. `getUserByIdDao` (`src/db/repositories/user-repository.ts:39`)
charge l'utilisateur avec ses `members`, et le `customSession` de Better Auth
(`src/lib/better-auth/auth.ts:273`) exécute cette lecture **à chaque requête** pour peupler
`user.organizations` — d'où sortent l'organisation active, les rôles d'organisation de CASL et tout
le back-office. Cette lecture a lieu **avant** qu'un tenant soit connu : elle sert justement à
déterminer à quels tenants l'utilisateur appartient. Aucun placement de `withTenant` ne peut la
satisfaire, parce que la question posée n'est pas « que contient ce tenant » mais « quels tenants
concernent cette identité ».

L'ADR 002 n'a pas traité ce cas : il raisonne sur les **tables métier** — son exemple est
`project-model.ts` — et sa liste d'exemptions n'existe que dans `docs/architecture.md`, où elle
couvre les tables Better Auth sans `organization_id` (`user`, `session`, `account`, `verification`)
et `app_settings`. `member` et `invitation` sont dans un angle mort : elles portent
`organization_id` sans être des données métier.

## Decision

**`member` et `invitation` appartiennent au plan identité, pas au plan métier. Elles rejoignent la
liste d'exemption de `docs/architecture.md` aux côtés de `user`, `session`, `account`,
`verification` et `app_settings`. Aucune policy RLS ne les couvre ; leur isolation reste
applicative (CASL, `organization-authorization.ts`).**

Le critère qui fait la différence, et qui vaut pour les tables futures : une table est du **plan
identité** quand elle ne porte **aucune donnée de l'association** et sert à répondre « qui est cet
utilisateur et où a-t-il le droit d'aller ». `member` ne porte que le triplet
`(organization_id, user_id, role)` ; `invitation` ne porte que l'adresse invitée, le rôle proposé et
l'expiration. Ce sont des arêtes d'un graphe d'autorisation, lues avant tout scope, et non le
contenu d'un tenant.

**Ce qui ne change pas.** La convention de l'ADR 002 tient **inchangée pour toute table métier
future** : `organization_id`, RLS activée et forcée, policy `tenant_isolation` fail-closed, et un
test d'accès croisé entre deux tenants dans la story qui l'introduit. La RLS reste posée sur
`user_submissions`, et c'est sur elle que s01 prouve le critère 7. Les 41 stories suivantes ajoutent
des tables métier : aucune d'elles n'est un pivot d'identité, et aucune n'hérite de cette exemption.
Une exemption nouvelle se justifie en revue, comme `docs/architecture.md` l'exige déjà.

Cet ADR **ne supersède pas l'ADR 002** : il enregistre un retrait de périmètre que l'ADR 002 n'avait
jamais adressé. Sa SQL, son rôle applicatif dédié, son `withTenant`/`getDb` et son bypass SuperAdmin
restent en vigueur mot pour mot.

## Considered options

- **(a) Exempter `member` et `invitation` comme plan identité** — **retenu**. C'est la seule option
  qui laisse le mécanisme de l'ADR 002 intact tout en rendant l'application fonctionnelle, et elle
  reconnaît une distinction qui existait déjà dans la liste d'exemption (les tables Better Auth y
  sont toutes). Le coût est réel et nommé plus bas : l'énumération des adhésions n'est plus gardée
  que par la couche applicative.
- **(b) Étendre la policy de `member` d'une clause par utilisateur**
  (`user_id = current_setting('app.user_id')::uuid`), avec un scope `withCurrentUser()` posé sur
  chaque chemin serveur — rejeté. Trois raisons, dans l'ordre de gravité : (1) cela **amende la SQL
  que l'ADR 002 cite littéralement**, donc il faudrait superséder un ADR de cadrage depuis une
  story ; (2) cela ajoute une **seconde clé de session** que tout chemin serveur doit poser, et
  oublier la seconde ne donne pas une erreur mais une **liste vide** — exactement le bug qui a
  bloqué la tâche 7, reproduit à demeure et sur 42 stories ; (3) le chemin `/api/auth/*` de Better
  Auth n'a aucun point d'accroche pour poser un scope, la lecture partant de son propre
  `customSession`.
- **(c) Router les lectures d'adhésion par `withRlsBypass()`** — rejeté d'emblée. La porte dérobée
  deviendrait le chemin normal de **chaque requête authentifiée**, ce que l'ADR 002 interdit
  nommément en la réservant au provisioning et à s41, et la règle de revue « toute occurrence de
  `withRlsBypass` est un point d'arrêt » perdrait tout pouvoir de détection.
- **(d) Supprimer le concept « toutes mes organisations »** — écarté pour s01, mais pas absurde :
  sous l'ADR 003 le tenant vient du domaine, donc un membre appartient à **une** association et
  « toutes mes organisations » est un concept de boilerplate. Cela rendrait la mesure ci-dessus
  correcte plutôt que cassée. Rejeté ici parce que c'est un changement de ce que voit l'autorisation
  CASL, qui casserait `/account/organizations`, `/team/[slug]` et le sélecteur d'organisation, donc
  un élargissement de périmètre hors des dix critères de s01. **À rouvrir** quand une story traitera
  le shell du back-office association.

## Consequences

**Ce qui devient plus simple**

- L'inscription, la session, les rôles d'organisation et les invitations fonctionnent sans qu'aucun
  chemin serveur n'ait à poser un scope avant d'avoir résolu l'identité.
- La règle reste énonçable en une phrase, ce qui est ce qui la rend applicable par 41 stories :
  « toute table **métier** porte `organization_id` et une policy forcée ».

**Ce qui devient plus difficile, et ce qu'il faut surveiller**

- **Risque résiduel, nommé** : un bug de la couche applicative peut désormais **énumérer des
  adhésions inter-tenant**. La RLS ne l'en empêche plus ; seuls les `can*` de
  `src/services/authorization/organization-authorization.ts` le font. C'est le prix explicite de
  cette décision. Ce que le risque ne couvre **pas** : les données de l'association elles-mêmes —
  une adhésion révèle un nom d'organisation et un rôle, pas un document nominatif, une facture ou un
  relevé.
- **Conséquence de revue** : toute requête nouvelle sur `member` ou `invitation` doit être lue comme
  du code d'autorisation, et porter son `can*`. Une lecture de `member` sans contrôle applicatif est
  un défaut de revue, au même titre qu'une occurrence de `withRlsBypass`.
- **Le critère 7 de s01 ne se prouve plus que sur `user_submissions`.** C'est suffisant — la policy
  est identique et le mécanisme est celui que toutes les tables métier futures emploieront — mais la
  preuve est plus étroite qu'annoncée au plan.
- **À rouvrir si** `member` gagne un jour des données propres à l'association (une date d'adhésion
  statutaire, une cotisation, un mandat). Ces données appartiendraient au plan métier et devraient
  vivre dans une table scopée, pas dans `member` : c'est le signal qu'il faut relire cet ADR plutôt
  que d'étendre `member`.
