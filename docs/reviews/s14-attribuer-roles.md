# Revue — s14-attribuer-roles

## Revue 1 — 2026-10-27 (commit 2269a02a)

Revue anti-hallucination, contexte neuf. Diff relu : `git diff main...feature/s14-attribuer-roles`
(76 fichiers).

### Vérifications exécutées par le reviewer

Branche exportée par `git archive` sur disque local (`node_modules` en lien symbolique), rien modifié
dans /workspace.

- `pnpm test --run` : 261 fichiers, 3168 tests passés, 4 ignorés, exit 0, aucun timeout de worker.
- `pnpm exec tsc --noEmit` : exit 0.
- `pnpm lint` : exit 0.
- `pnpm check:rules` : « Règles et documentation alignées ».
- `drizzle-kit check` : « Everything's fine ».
- e2e et build non lancés (CI uniquement).

### Checklist

- [x] Plan : tâches 1 à 10 présentes ; écarts consignés dans « Écarts d'exécution », aucun ne change
      D1 à D8. `rls-inventory.test.ts` générique, vert par la mise à jour de `docs/architecture.md`
      (36 tables, 17 scopées).
- [x] Anti-hallucination : imports et signatures ouverts un par un ; liste des `createAuthEndpoint`
      de Better Auth 1.7.1 relevée — les routes qui écrivent des appartenances sont exactement les
      sept fermées (create, delete, update-member-role, remove-member, leave, invite-member,
      accept-invitation) ; le test vérifie leur existence dans le plugin installé et le 404 de
      `auth.handler`. Aucun `authClient.organization.*` dans `src` ni `e2e`.
- [x] RLS de `member_role_event` : 0035 générée, 0036 `--custom` (`ENABLE` + `FORCE` + policy
      `tenant_isolation` calquée sur 0027), journal et snapshots enchaînés, aucune nouvelle
      occurrence de `withRlsBypass`.
- [x] Autorisations ADR 039 : `presidency_reserved`, `own_presidency`, décompte hors SuperAdmin,
      passation à deux lignes et deux traces, `invalid_role`, fiche d'un autre tenant → `not_found`,
      `user_id` relu depuis la fiche, ordre fiche → verrou → rôles → décompte → écriture → trace
      épinglé, écriture conditionnelle (0 ligne = échec).
- [ ] ADR 039 §1, un seul chemin d'écriture : voir problème 1.
- [x] Design system et intention : `card`, `radio-group`, `alert` (neutre, `destructive`, `warning`),
      `alert-dialog` ancré en bas sur mobile, `button`, `badge` `outline` ; aucun composant, token ou
      couleur hors système.
- [x] i18n : textes identiques au document de design ; textes hors design consignés dans les écarts.
- [x] Auto-rétrogradation : `redirect('/dashboard?role=retire')` hors du `try`, seulement si
      `self && change === 'demoted'` ; `RoleWithdrawnNotice` en `role="status"`.
- [x] Tests : règle pure combinaison par combinaison, aucune écriture sur refus, chaque refus de
      l'action, carte A1 à A12, DAO en SQL via `pg-proxy`. Spec e2e : pièges connus évités (parcelle
      avant `/dashboard`, alertes scopées, `exact: true`, seed rétabli en `finally`). Appels forgés
      plausibles mais fragiles ; la spec n'a jamais tourné.
- [x] Régressions : écran SuperAdmin garde le rôle en lecture ; retrait sous `withTenant` avec verrou,
      règle et trace ; `closeMemberAccount` ne touche aucun rôle du bureau ; appelants de s12d
      adaptés.

### Problèmes relevés

**Majeur**

1. `src/services/organization-service.ts` (`changeUserOrganizationRoleService`) et
   `src/db/repositories/organization-repository.ts` (`updateUserOrganizationRoleDao`) : écrit
   `member.role` sans trace, sans verrou, sans règle du dernier compte ni de présidence, toujours
   exporté par la façade. Contredit ADR 039 §1. Pas critique : aucun appelant, façade non
   `'use server'`. Même famille : `createOrganizationMemberService` accepte n'importe quel `role`.
   Correctif peu coûteux : supprimer fonction, entrée de façade, DAO et tests ; imposer `member` dans
   `createOrganizationMemberService`.

**Mineurs**

2. `replaceMemberAccount` sans verrou : course possible avec une rétrogradation concurrente (zéro
   compte capable). Peu coûteux : prendre `lockOrganizationRolesDao` en début de transaction. Cas
   sans concurrence (nouvelle adresse = SuperAdmin porteur de la ligne `owner`) : demande une
   décision, coûteux.
3. Même fonction : la trace `email_change` de l'ancien compte est écrite même si
   `deleteMemberWithRoleDao` n'a touché aucune ligne. Peu coûteux : rendre le nombre de lignes et
   n'écrire la trace que s'il vaut 1.
4. `e2e/member-roles.spec.ts` : la RLS de `member_role_event` n'est sondée nulle part directement.
   Peu coûteux : lecture croisée + insertion croisée sur le modèle de `incident-report.spec.ts:950`.
5. `decideRoleChange` : une cible SuperAdmin portant une ligne `board` est comptée capable alors que
   le décompte l'exclut → refus `last_capable` à tort possible. Peu coûteux : passer
   `targetIsSuperAdmin`.
6. `transferPresidencyByOperatorService` + `getOrganizationOwnerDao` (`LIMIT 1`) : plusieurs lignes
   `owner` hors SuperAdmin → une seule rétrogradée, D8 « Président(e) unique » non tenue. Peu
   coûteux : rétrograder toutes les lignes `owner` hors SuperAdmin, une trace chacune.
7. Hors plan : la suppression d'un compte `user` (cascade sur `member`) retire un rôle sans trace ni
   règle du dernier compte. Préexistant, coûteux : demande une décision.

### Verdict

Revue 1 : sévérité maximale majeure, livraison autorisée (oui). Correctifs 1 à 6 demandés.

## Revue 2 — 2026-10-27 (commits 2269a02a + 43583941)

Revue en contexte neuf ; le commit de correctif 43583941 relu comme du code neuf. 78 fichiers.

### Vérifications exécutées par le reviewer

- `pnpm test --run` : 262 fichiers, 3180 tests passés, 4 ignorés, exit 0, aucun timeout.
- `pnpm exec tsc --noEmit`, `pnpm lint` : exit 0. `pnpm check:rules` : aligné.
  `drizzle-kit check` : « Everything's fine ».
- e2e et build non lancés (CI uniquement).

### Suivi de la revue 1

1. Corrigé : fonction, façade et DAO supprimés ; `createOrganizationMemberService` refuse tout rôle
   autre que `member` avant écriture.
2. Corrigé pour la course sur le décompte (verrou en tête de `replaceMemberAccount`). Cas de la cible
   SuperAdmin laissé exprès (décision produit).
3. Corrigé : trace de l'ancien compte seulement si `removed === 1`.
4. Corrigé : sonde RLS de `member_role_event` dans `e2e/member-roles.spec.ts` (lecture croisée par id
   et par `organization_id`, lecture sans scope, insertion croisée rejetée), nettoyage en `finally`.
   À confirmer en CI.
5. Corrigé dans `decideRoleChange` (`targetIsSuperAdmin`).
6. Corrigé pour le recours d'exploitation (toutes les présidences hors SuperAdmin rétrogradées, une
   trace chacune). Relance pour un compte déjà Président(e) : rétrograde les autres — cohérent avec
   D8, documenté, testé.
7. Laissé exprès (décision produit).

### Constats

Critique : aucun. Majeur : aucun.

**Mineurs (tous peu coûteux)**

1. `replaceMemberAccount` : le rôle déplacé est lu par l'appelant (`getLinkedAccountRole`) avant le
   verrou ; une rétrogradation concurrente peut être annulée. Relire le rôle de `previousUserId` après
   le verrou.
2. `decideMemberRemoval` (`member-role-rules.ts:133`) compte une ligne `board` de SuperAdmin comme
   capable, contrairement au décompte ; refus à tort possible. Passer `targetIsSuperAdmin`.
3. Passation depuis l'écran vers un SuperAdmin porteur d'une ligne `board` et d'une fiche : laisse
   l'association sans Président(e) ; incohérent avec le recours qui refuse un SuperAdmin. Refuser
   `transfer_presidency` si `targetIsSuperAdmin` (et masquer l'option si simple).
4. Passation depuis l'écran avec plusieurs présidences héritées : seule l'appelante est rétrogradée,
   contrairement à `docs/exploitation/README.md` §12. Rétrograder toutes les présidences hors
   SuperAdmin autres que la cible, ou nuancer le README.
5. `canChangeOrganizationMemberRole` (`organization-authorization.ts:294`) sans appelant, logique
   contraire à l'ADR 039. Le supprimer.

### Verdict

Revue 2 : sévérité maximale mineure, livraison autorisée. Les cinq mineurs, peu coûteux, sont
corrigés avant livraison (boucle de la story).

## Revue 3 — 2026-10-27 (commits 2269a02a + 43583941 + 4c713321)

Revue en contexte neuf ; le commit 4c713321 relu comme du code neuf. 81 fichiers.

### Vérifications exécutées par le reviewer

- `pnpm test --run` : 262 fichiers, 3189 tests passés, 4 ignorés, exit 0, aucun timeout.
- `pnpm exec tsc --noEmit`, `pnpm lint` : exit 0. `pnpm check:rules` : aligné.
  `drizzle-kit check` : « Everything's fine ».
- e2e et build non lancés (CI uniquement) ; la spec e2e n'a pas changé dans 4c713321.

### Suivi de la revue 2

1. Corrigé : `replaceMemberAccount` relit le rôle de l'ancien compte après le verrou ; la décision
   `replace` ne porte plus de rôle ; ordre épinglé. Branche « ancien compte sans ligne » : accès de
   simple membre, rien retiré, rien tracé — correct et sûr.
2. Corrigé : `decideMemberRemoval` reçoit `targetIsSuperAdmin`, lu après le verrou.
3. Corrigé : refus `superadmin_presidency`. Option non masquée à l'écran (changement de DTO), non
   bloquant.
4. Corrigé : la passation depuis l'écran rétrograde l'appelante puis les autres présidences hors
   SuperAdmin, sauf la cible ; pas de double écriture (appelante filtrée de la liste).
5. Corrigé : `canChangeOrganizationMemberRole` supprimée, aucune référence restante.

### Constats

Critique : aucun. Majeur : aucun.

**Mineur (peu coûteux)**

1. `messages/fr.json`, `refusals.superadmin_presidency` : « … il ne peut pas devenir Président(e). »
   s'écarte de la convention sans pronom du design (A3, « le produit ne connaît pas le genre »).
   Reformuler : « {name} est un compte SuperAdmin de la plateforme : ce compte ne peut pas devenir
   Président(e). Rien n'a été enregistré. »

### Hors constats (préexistant, décision produit)

- Adresse d'une Président(e) changée vers celle d'un compte déjà Bureau de la même association :
  `ensureMembership` n'abaisse pas le rôle en place, l'ancienne ligne `owner` est retirée et
  l'association reste sans Président(e). Tracé ; décompte jamais à zéro ; le recours d'exploitation
  répare. Comportement de s12d, hors story.

### Verdict

Revue 3 : sévérité maximale mineure, livraison autorisée. Le mineur de texte est corrigé avant
livraison.

## Revue 4 — 2026-10-27 (commits 2269a02a, 43583941, 4c713321, 635ec53f)

Revue en contexte neuf ; 635ec53f relu comme du code neuf, survol du diff complet (81 fichiers).

### Vérifications exécutées par le reviewer

- `pnpm test --run` : 262 fichiers, 3190 tests passés, 4 ignorés, exit 0, aucun timeout.
- `pnpm exec tsc --noEmit`, `pnpm lint` : exit 0. `pnpm check:rules` : aligné.
  `drizzle-kit check` : « Everything's fine ».
- e2e et build non lancés (CI uniquement).

### Suivi de la revue 3

1. Corrigé : `refusals.superadmin_presidency` dit « {name} est un compte SuperAdmin de la plateforme :
   ce compte ne peut pas devenir Président(e). Rien n’a été enregistré. », sans pronom. Le test
   (`actions.test.ts:777`) lit `messages/fr.json` comme une douzaine de tests existants et épingle le
   texte exact.

### Survol du diff complet

- Migrations 0035 générée, 0036 `--custom` (RLS `ENABLE` + `FORCE`, policy `tenant_isolation`).
- Aucun nouveau `withRlsBypass`, `process.env` ou accès direct à `db`.
- `changeMemberRoleAction` : tenant (DAL) → `requireActionAuth` → façade → service ; le compte visé
  n'est jamais lu du formulaire.

### Points laissés à une décision produit (non bloquants)

- Suppression d'un compte `user` : rôle retiré sans trace ni règle du dernier compte (préexistant).
- Adresse d'une fiche du bureau remplacée par celle d'un compte SuperAdmin.
- Option Président(e) non masquée pour une cible SuperAdmin (refus motivé à l'enregistrement).
- Adresse d'une Président(e) remplacée par celle d'un compte déjà Bureau : association sans
  Président(e) (préexistant, s12d ; réparable par `pnpm ops:transfer-presidency`).

### Constats

Critique : aucun. Majeur : aucun. Mineur : aucun.

### Verdict

Max severity: none
Ship allowed: yes
