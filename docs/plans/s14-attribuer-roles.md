---
validated: yes
---

# Plan — Story s14-attribuer-roles

Branch: `feature/s14-attribuer-roles`

## Target story

**s14 — Désigner les membres du bureau** (complexité 2, dépendances s03b, s12, s12d). Recherche :
`docs/research/s14-attribuer-roles.md` (code lu sur `main` au commit `e7227836`). Design :
`docs/designs/s14-attribuer-roles.md` + `.html` (validé le 2026-10-27). Décision : ADR 039.

Critères d'acceptation :

1. Depuis la fiche d'un membre, un membre du bureau (Bureau ou Président(e)) lui attribue le rôle
   Bureau ou Président(e), ou le lui retire ; le changement prend effet à la connexion suivante du
   membre concerné (tenu plus fort : dès sa requête suivante, ADR 038 et `customSession`).
2. Un membre promu Bureau accède au back-office ; le même membre, rôle retiré, y reçoit un refus —
   vérifié en interface et sur l'appel serveur direct.
3. Une association a toujours au moins un compte capable d'attribuer les rôles : retirer le dernier
   est refusé avec un message explicite.
4. Chaque attribution et chaque retrait est tracé avec son auteur, sa date, le membre visé et le rôle.
5. Un membre du bureau ne peut attribuer de rôle qu'aux membres de sa propre association.
6. Le rôle SuperAdmin n'est jamais attribuable depuis cet écran.

### Arbitrages repris (produit, 23 et 27 octobre)

- Trois rôles : Membre (`member`), Bureau (`board`), Président(e) (`owner`).
- **Une seule Président(e).** Le Bureau ne peut ni retirer ni attribuer la présidence.
- **Passation par la Président(e) seule**, depuis la fiche du successeur ; elle redevient Bureau.
  La Président(e) ne modifie pas son propre rôle.
- **Effet immédiat** annoncé à l'écran.
- **Trace stockée, sans écran.**
- Comptes du bureau sans fiche : on leur crée une fiche (formulaire existant) ; la liste montre un
  badge de rôle.

### Ce que la story ne fait pas (à ne pas compter comme un manque)

- Aucun écran d'historique des rôles.
- Aucune attribution de la présidence par le Bureau ni par le SuperAdmin **depuis l'écran** ; le seul
  recours, si la Président(e) part sans transmettre, est le script d'exploitation de D8. Une
  association sans Président(e) (ancienne) garde la main de son Bureau sur le rôle Bureau.
- Pas de rôle sur une fiche « courrier uniquement » (pas de compte, donc pas de ligne `member`).
- La matrice des droits (s37), la simulation de rôle (s41).

### Décisions du plan (à confirmer à la validation)

- **D1 — Un seul chemin, tracé (ADR 039).** Service `member-role-service` sous `withTenant`, DAO du
  projet ; jamais `auth.api.updateMemberRole`.
- **D2 — Portes latérales fermées (ADR 039).** Routes HTTP du plugin organisation qui écrivent des
  appartenances ajoutées à `disabledPaths` ; écran SuperAdmin `/admin/organizations/[id]/edit` :
  dialogue de modification du rôle retiré, ajout au rôle Membre seulement, retrait d'un membre soumis
  à la règle du dernier compte et tracé. Seul appelant client du plugin vérifié : le dialogue
  `edit-member-role-dialog.tsx`.
- **D3 — « Compte capable »** = ligne `owner` ou `board` de l'association dont le compte n'est pas
  SuperAdmin (la ligne `owner` de l'amorçage ne compte pas). Décompte sous `pg_advisory_xact_lock`.
- **D4 — Nouvelle action du registre `member.role.assign`** (`owner`, `board`), distincte de
  `member.profile.manage`, pour que s37 la règle à part. Le SuperAdmin passe `canPerformAction` mais
  la règle pure lui refuse la passation (il n'est pas Président(e)) ; sur la fiche, il voit la carte
  comme un membre du Bureau.
- **D5 — Déplacement de rôle de s12d tracé** (`reason = email_change`), auteur = le membre du bureau
  qui a changé l'adresse.
- **D6 — Textes des manques du canevas** : refus du dernier compte à la 2ᵉ personne « Votre compte
  est le dernier qui peut désigner le bureau de l'association… » ; badge de rôle = variante
  `outline` existante du `badge` (aucune couleur nouvelle) ; carte « Rôle » sans icône.
- **D8 — Recours d'exploitation (arbitrage du 27/10).** Commande `pnpm ops:transfer-presidency
<domaine> <adresse>`, sur le patron de `pnpm ops:bootstrap` (`src/db/scripts/bootstrap-platform.ts`) :
  elle passe par le même service, sous le même verrou, garantit une Président(e) unique (l'ancienne
  repasse Bureau), n'accepte qu'une adresse qui a déjà un compte membre de cette association, et
  trace `presidency_transfer` avec l'auteur « Zourite Studio » (`author_user_id` nul). Documentée
  dans `docs/exploitation/README.md`. Rattachée à la tâche 5 pour rester à dix tâches.
- **D7 — Complexité.** La story est cotée 2 ; avec la fermeture des portes latérales et la table de
  trace, elle se rapproche de 3. Dix tâches : à la limite, pas au-delà. Pas de scission proposée.

## Tasks (ordered)

1. [x] **Table de trace (ADR 039).** Modèle `member_role_event` (`src/db/models/member-role-event-model.ts`,
       colonnes de l'ADR, énumérés `member_role_event_reason`), migration par `pnpm db:generate`,
       policy `tenant_isolation` **forcée** par `drizzle-kit generate --custom` (patron
       `0027_incident_report_rls.sql`). Ajout au classement de `docs/architecture.md` et à
       `src/db/rls-inventory.test.ts` (qui échoue d'abord). Test de modèle sur le patron de
       `src/db/member-profile-model.test.ts` (colonnes, `SET NULL`, index sur `organization_id`).
2. [x] **Règle pure du changement de rôle.** `src/services/rules/member-role-rules.ts` :
       `decideRoleChange({viewerRole, viewerIsSuperAdmin, targetRole, nextRole, isSelf,
 capableCount})` → `none` | `assign` (board) | `demote` (member) | `transfer_presidency` |
       refus `presidency_reserved` (Bureau ou SuperAdmin touche ou vise `owner`), `own_presidency`
       (la Président(e) sur sa fiche), `last_capable` (le changement ferait tomber le décompte à 0),
       `invalid_role` (toute valeur hors `member|board|owner`, critère 6). Et
       `roleCardFor(viewer, target)` → phrase de lecture, `canEdit`, options du `radio-group`
       (écran A). Tests unitaires exhaustifs par combinaison.
3. [x] **Registre et autorisation.** `ActionIdConst.MEMBER_ROLE_ASSIGN = 'member.role.assign'`,
       `defaultRoles: ['owner', 'board']` dans `action-registry-types.ts` ; `canAssignMemberRole(user,
 orgId)` dans `src/services/authorization/` sur le patron de `canReadMemberAccount`. Mettre à
       jour les tests du registre (décompte des actions).
4. [x] **DAO.** Dans `organization-repository.ts` : `countCapableMembersDao(orgId)` (lignes
       `owner`/`board` jointes à `user`, `role <> 'super_admin'`), `lockOrganizationRolesDao(orgId)`
       (`pg_advisory_xact_lock(hashtextextended('member-roles:' || orgId, 0))`),
       `getOrganizationOwnerDao(orgId)`, et faire rendre à `updateMemberRoleFromDao` le nombre de
       lignes touchées (appelants existants adaptés, tests verts). Nouveau
       `member-role-event-repository.ts` : `insertMemberRoleEventDao` (via `getDb()`).
5. [x] **Service `changeMemberRoleService`** (`src/services/member-role-service.ts`, façade
       `member-role-service-facade.ts` + intercepteur de log) : Zod (`organizationId`,
       `memberProfileId`, `role`), `canAssignMemberRole`, puis sous `withTenant` : relire la fiche
       (RLS : fiche d'une autre association → `not_found`, critère 5), `user_id` **de la fiche
       relue**, jamais du navigateur ; `mail_only` → `no_account` ; verrou ; décompte ; règle ;
       écriture (`updateMemberRoleFromDao` conditionnel ; passation = cible `owner` puis appelant
       `board`) ; une ligne de trace par compte changé, noms copiés. Résultat typé :
       `{status: 'saved', change, self}` ou refus. Tests unitaires (DAO mockés) : chaque branche,
       aucune écriture sur refus, ordre verrou → décompte → écriture épinglé. **Recours (D8)** :
       `transferPresidencyByOperatorService(domain, email)` dans le même service, et le script
       `src/db/scripts/transfer-presidency.ts` + entrée `ops:transfer-presidency` dans
       `package.json` + section de `docs/exploitation/README.md` ; tests du service (domaine
       inconnu, adresse sans compte membre, passation et deux traces) et de la lecture des
       arguments, sur le patron de `bootstrap-platform.test.ts`.
6. [x] **Portes latérales (D2).** Ajouter à `disabledPaths` les routes du plugin organisation qui
       écrivent des appartenances (liste exacte relevée dans
       `node_modules/better-auth/dist/plugins/organization/` au moment de l'exécution, avec un test
       qui épingle la liste). Écran SuperAdmin : retirer `EditMemberRoleDialog` de
       `organization-members-table.tsx` (rôle affiché en lecture), `addUserToOrganizationAction`
       limité au rôle `member`, `removeUserFromOrganizationService` soumis au verrou et à la règle
       du dernier compte, avec trace `removal`. `replaceMemberAccount` (s12d) écrit sa trace
       `email_change` (D5). Tests unitaires de chaque point.
7. [x] **Lecture pour l'écran.** `MemberProfileDTO` porte la carte de rôle calculée par
       `roleCardFor` pour la personne connectée (lecture, `canEdit`, options) ; la liste des
       propriétaires porte `boardRole` par ligne (badge, écran B). Tests du service de lecture.
8. [x] **Server Action** `changeMemberRoleAction` dans
       `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts` : `requireActionAuth`, façade,
       messages par `getTranslations('BureauMemberProfilesPage')`, `revalidateMemberProfileScreens()` ;
       sur sa propre rétrogradation (`self`), `redirect('/dashboard?role=retire')`. Tests de l'action
       (succès, chaque refus, redirection).
9. [x] **Écrans A et B** (`member-profile-detail.tsx`, liste des propriétaires, `/dashboard`) :
       carte « Rôle dans l'association » après « Accès à l'espace membre » — lecture, modification en
       place (`radio-group`), encarts `warning`, `alert-dialog` de passation, résumé d'erreurs
       `destructive`, confirmations `role="status"` ; badge `outline` « Bureau » / « Président(e) »
       dans la liste ; `alert` « Vous ne faites plus partie du bureau. » sur `/dashboard?role=retire`.
       Textes du design dans `messages/fr.json` (`BureauMemberProfilesPage.detail.role.*`). Tests de
       composants : chaque état A1 à A12 et B.
10. [x] **Preuves e2e** (CI de la PR, pas en local) : `e2e/member-roles.spec.ts`, patron
        `member-accounts.spec.ts` (comptes et fiches propres au run, deux tenants `localhost` /
        `127.0.0.1`, `mode: 'serial'`) : promotion → back-office accessible au rechargement ;
        rétrogradation → écran C4 **et** appel serveur direct d'une action du bureau refusé
        (critère 2) ; refus du dernier compte (critère 3) ; une ligne `member_role_event` par
        changement, lue en base (critère 4) ; fiche d'une autre association → aucune écriture
        (critère 5) ; passation (Président(e) → Bureau, successeur → Président(e)) ; option
        SuperAdmin absente et valeur forgée refusée (critère 6) ; route HTTP du plugin
        `/api/auth/organization/update-member-role` → 404.

## Files touched

- `src/db/models/member-role-event-model.ts`, `src/db/models/index`/schéma si agrégé,
  `drizzle/migrations/00xx_*.sql` (+ `--custom` RLS, snapshots, journal générés)
- `src/db/rls-inventory.test.ts`, `docs/architecture.md` (classement RLS), `src/db/member-role-event-model.test.ts`
- `src/db/repositories/organization-repository.ts`, `src/db/repositories/member-role-event-repository.ts`
- `src/services/rules/member-role-rules.ts` (+ test)
- `src/services/member-role-service.ts`, `src/services/facades/member-role-service-facade.ts`,
  `src/services/facades/interceptors/member-role-service-logger-interceptor.ts` (+ tests)
- `src/services/types/domain/action-registry-types.ts`, `src/services/types/domain/member-role-types.ts`,
  `src/services/types/domain/member-profile-types.ts`
- `src/services/authorization/member-role-authorization.ts` (+ test)
- `src/services/member-profile-service.ts` (lecture : carte de rôle, `boardRole` en liste)
- `src/services/member-account-service.ts` (trace `email_change`), `src/services/organization-service.ts`
  (retrait soumis à la règle)
- `src/lib/better-auth/auth.ts` / `magic-link-integration.ts` (`disabledPaths`)
- `src/components/features/organization/organization-members-table.tsx`,
  `edit-member-role-dialog.tsx` (retiré), `organization-add-member-form.tsx`,
  `src/components/features/organization/action.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`, `[id]/page.tsx`, page de liste
- `src/components/features/member-profile/member-profile-detail.tsx`, liste des propriétaires,
  `src/components/features/member-space/member-space.tsx` (message `?role=retire`)
- `messages/fr.json`
- `src/db/scripts/transfer-presidency.ts` (+ test), `package.json`, `docs/exploitation/README.md`
- `e2e/member-roles.spec.ts`
- `docs/decisions/039-changement-de-role-un-seul-chemin-trace.md`

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`, sur une copie en disque local)** : règle pure exhaustive
  (toutes les combinaisons appelant × cible × rôle visé × décompte) ; service avec DAO mockés — pas
  d'écriture sur refus, `user_id` jamais pris de l'entrée, ordre verrou → décompte → écriture,
  passation en deux écritures et deux traces ; action serveur ; composants de l'écran A (A1 à A12) et
  B ; registre ; inventaire RLS ; liste des `disabledPaths`.
- **e2e (Playwright, CI seulement)** : critères 1 à 6 sur une vraie base, effet au rechargement,
  isolation entre deux associations, trace lue en base, porte HTTP du plugin fermée.
- La RLS et la prise d'effet ne sont prouvées qu'en e2e (`db.ts` refuse toute connexion en test ;
  les tests qui mockent `getAuthUser` ne voient pas l'ADR 038).

## Definition of Done

- Une PR, description structurée (UI, DB : migration de `member_role_event` + RLS, Auth : routes du
  plugin fermées).
- Tests unitaires verts, aucune régression (tests de s12d et de l'écran SuperAdmin adaptés, pas
  affaiblis).
- e2e verts sur la CI de la PR, dont les nouveaux.
- Revue passée (`Ship allowed: yes`), ADR 039 joint, design respecté (composants du design system
  seulement, manques consignés).
- Aucune nouvelle occurrence de `withRlsBypass`.
- Déploiement : selon la stratégie (pas de mise en production avant s13).

## Écarts d'exécution

Relevés pendant l'exécution (implementer, 2026-10-27). Aucun ne change une décision D1–D8.

- **Tâche 1 — inventaire RLS.** `src/db/rls-inventory.test.ts` est générique (il lit les `pgTable`
  et les migrations) : il a échoué tel quel à l'ajout du modèle, puis est repassé au vert par la
  seule mise à jour de `docs/architecture.md` (36 tables, 17 scopées). Le fichier de test n'a pas
  eu à changer. Migrations : `0035_lame_ricochet.sql` (`pnpm db:generate`) et
  `0036_member_role_event_rls.sql` (`drizzle-kit generate --custom`).
- **Tâche 2 — `roleCardFor` rend aussi `self`.** Les textes à la 2ᵉ personne de l'écran (A9, A10)
  demandent de savoir que la fiche est celle de la personne connectée ; la carte porte donc
  `self: boolean`. Une règle sœur `decideMemberRemoval` porte la même règle du dernier compte pour
  le retrait d'une ligne `member` (tâche 6).
- **Tâche 3 — décompte des actions.** Aucun test du registre ne comptait les actions : un bloc de
  tests `MEMBER_ROLE_ASSIGN` a été ajouté à `action-registry-authorization.test.ts`, sur le patron
  des actions voisines.
- **Tâche 5 — recours D8.** `transferPresidencyByOperatorService` refuse aussi un compte SuperAdmin
  (cohérence avec D3 : une ligne `owner` de SuperAdmin n'est pas une présidence) et ne rétrograde
  pas la ligne `owner` de l'amorçage. Relancé pour un compte déjà Président(e), il n'écrit rien.
- **Tâche 6 — liste des routes fermées.** Relevée dans Better Auth 1.7.1 :
  `/organization/create`, `/organization/delete`, `/organization/update-member-role`,
  `/organization/remove-member`, `/organization/leave`, `/organization/invite-member`,
  `/organization/accept-invitation` (`addMember` n'a pas de route HTTP). La constante vit dans
  `src/lib/better-auth/organization-roles.ts` (module du plugin organisation), un test épingle la
  liste et vérifie que chaque route existe dans le plugin installé, un autre vérifie le 404 par
  le gestionnaire HTTP.
- **Tâche 6 — écran SuperAdmin.** L'écran `/admin/organizations/[id]/edit` utilise
  `OrganizationAdminAddMemberForm` et l'action `addUserToOrganizationAction` de
  `src/app/[locale]/admin/organizations/actions.ts`, pas ceux de `features/organization` cités au
  plan : les **deux** actions et les **deux** formulaires ont été limités au rôle Membre (sélecteur
  de rôle retiré, rôle forgé ignoré). Les libellés devenus inutiles (`Organization.roles`,
  `Organization.members.editRole*`, `Organization.invite.*Description`) sont retirés de
  `messages/fr.json`.
- **Tâche 6 — trace `email_change` (D5).** Écrite seulement pour un rôle `board`/`owner` (le
  déplacement de rôle) : une ligne par compte dont le rôle change. `applyMemberAccountDecision` et
  `replaceMemberAccount` reçoivent l'auteur (`MemberAccountAuthor`), passé par
  `member-profile-service`. Le verrou n'est pas pris par `replaceMemberAccount` : le plan ne le
  demande pas, et le déplacement ne fait jamais tomber le décompte à zéro.
- **Tâche 7 — `boardRole` de la liste.** Lu par `getOrganizationMembersDao` (DAO existant), sous
  `canReadMemberAccount`, et rapproché du `user_id` de chaque fiche ; aucun DAO nouveau.
- **Tâche 9 — composants.** La carte vit dans `member-role-card.tsx` ; `DetailCard` est extrait
  dans `member-profile-detail-card.tsx` pour être partagé. Un texte hors design, pour les refus
  qu'aucun écran ne produit (appel forgé) : `refusals.invalid_role` « Ce rôle ne peut pas être
  attribué. Rien n'a été enregistré. », et les variantes « … Rien n'a été enregistré. » des
  phrases existantes pour `presidency_reserved`, `own_presidency`, `no_account`. Un choix égal au
  rôle enregistré referme le formulaire sans appel serveur.
- **Tâche 10 — e2e non exécutés en local** (machine trop juste) : à vérifier sur la CI de la PR.
  Deux essais (critère 3, passation) modifient temporairement la présidence du seed de TechCorp et
  la rétablissent dans un `finally` et au nettoyage ; le refus « sur l'appel serveur direct » est
  prouvé par un formulaire du bureau resté ouvert puis soumis après la rétrogradation ; les appels
  forgés (critères 5 et 6) réécrivent le corps de la Server Action par `page.route`.
- **Hors plan, non traité (à arbitrer).** `changeUserOrganizationRoleService`
  (`organization-service.ts`, exposé par la façade) écrit un rôle sans trace ni verrou. Aucun
  appelant dans le code ; le plan ne le cite pas, il n'a pas été touché.
