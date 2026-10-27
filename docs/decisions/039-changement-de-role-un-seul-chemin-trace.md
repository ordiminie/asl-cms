# ADR 039 — Un rôle d'association ne change que par un service du projet, tracé dans `member_role_event`

- Status: accepted
- Date: 2026-10-27
- Scope: story s14-attribuer-roles

## Context

s14 donne au bureau le pouvoir d'attribuer et de retirer les rôles Bureau et Président(e) (colonne
`member.role`, ADR 014). Trois exigences de la story et des arbitrages du 23/10/2026 pèsent sur la
forme :

- **chaque** attribution et **chaque** retrait est tracé (auteur, date, membre visé, rôle) ; la trace
  est stockée, sans écran, et entre dans l'export de s38 ;
- une association garde toujours au moins un compte capable d'attribuer les rôles, même face à deux
  retraits simultanés ;
- une seule Président(e), que seule la Président(e) transmet ; le Bureau ne la touche pas.

Ce qui existe (recherche de s14) :

- `member` est une table du plan identité, **sans RLS** : l'isolation y est applicative ;
- aucune table d'audit ni de journal générique n'existe ; le patron le plus proche est
  `incident_report_event` (s10) : `organization_id`, auteur en `SET NULL` + nom copié, RLS forcée ;
- **des portes latérales changent déjà un rôle sans trace** : les routes HTTP du plugin organisation
  de Better Auth (`/organization/update-member-role`, `/remove-member`, `/add-member`, `/leave`,
  invitations) restent ouvertes, `disabledPaths` ne fermant que `/sign-in/magic-link` ; l'écran
  SuperAdmin `/admin/organizations/[id]/edit` appelle `authClient.organization.updateMemberRole` ;
  `replaceMemberAccount` (s12d) déplace un rôle quand l'adresse d'une fiche change ;
- `auth.api.updateMemberRole` interdit au Bureau d'attribuer `owner` et ne trace rien.

## Decision

1. **Un seul chemin d'écriture d'un rôle** : les services du projet (`member-role-service`, et
   `replaceMemberAccount` pour le déplacement par changement d'adresse), sous `withTenant`, par les
   DAO de `organization-repository.ts`. Aucune écriture de rôle par l'API du plugin organisation.
2. **Les routes HTTP du plugin organisation qui écrivent des appartenances sont fermées**
   (`disabledPaths`), et l'écran SuperAdmin des membres d'une association ne modifie plus les rôles
   (lecture seule du rôle ; ajout au rôle Membre seulement ; le retrait passe par la règle du dernier
   compte).
3. **Trace dans une table dédiée `member_role_event`**, sous RLS forcée : `organization_id`,
   `member_profile_id` (`SET NULL`), `target_user_id` (`SET NULL`), `target_name` copié,
   `author_user_id` (`SET NULL`), `author_name` copié, `from_role`, `to_role` (`member` | `board` |
   `owner`, ou nul pour une ligne créée ou supprimée), `reason` (`assignment`, `presidency_transfer`,
   `email_change`, `removal`), `created_at`. Une ligne par compte dont le rôle change : une
   passation écrit deux lignes.
4. **Décompte du dernier compte capable sous verrou** : `pg_advisory_xact_lock` sur une clé propre à
   l'association, pris dans la transaction de `withTenant` avant le décompte, comme
   `association-category-repository.ts`. Est « capable » une ligne `owner` ou `board` dont le compte
   n'est pas SuperAdmin.

## Considered options

- **Journal générique (`audit_event` polymorphe)** pour s37/s38 — rejeté : ses besoins ne sont pas
  connus, un schéma à colonnes JSON perdrait les clés étrangères et l'isolation par colonne ; s38 lit
  l'inventaire des tables scopées, une table dédiée y entre sans travail.
- **Passer par `auth.api.updateMemberRole`** — rejeté : refuse au Bureau ce que la story lui donne,
  ne trace rien, exige une ligne `member` de l'appelant (le SuperAdmin n'en a pas toujours).
- **Hooks Better Auth (`organizationHooks`) pour tracer** — rejeté : ils ne couvrent que les écritures
  passées par le plugin, pas les DAO du projet (s12d), et ne savent pas porter la règle du dernier
  compte dans la même transaction.
- **Laisser les portes latérales ouvertes et ne tracer que l'écran de s14** — rejeté : le critère 4
  (« chaque » attribution) et le verrou du dernier compte seraient faux par un simple appel HTTP d'un
  membre du Bureau.
- **Verrou par `SELECT … FOR UPDATE` sur les lignes `member`** — rejeté : `member` est hors RLS et le
  décompte porte sur un ensemble (pas une ligne connue d'avance) ; un verrou consultatif par
  association est plus simple et a un précédent dans le dépôt.

## Consequences

- Une nouvelle table scopée : policy `tenant_isolation` forcée par migration `--custom`, classement
  dans `docs/architecture.md` et `src/db/rls-inventory.test.ts`.
- L'écran SuperAdmin perd la modification de rôle. Si la Président(e) part sans transmettre la
  présidence, le recours est une commande d'exploitation, `pnpm ops:transfer-presidency <domaine>
<adresse>` (arbitrage du 27/10), qui passe par le même service et trace l'acte avec l'auteur
  « Zourite Studio ». Une modification SQL à la main reste possible mais ne laisse aucune trace : à
  éviter.
- Le déplacement de rôle de s12d est désormais tracé (`email_change`).
- s37 (permissions configurables) réglera l'action `member.role.assign` ; ce jour-là, « compte
  capable » se redéfinit par l'action, pas par le rôle.
