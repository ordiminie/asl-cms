# Revue — Story s57-acces-ancien-proprietaire

> Revue faite avec un contexte neuf. Chaque point est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s57-acces-ancien-proprietaire`, un seul commit `f9d6741f`, 63 fichiers, +4157 / −162.
> Documents de référence : `docs/plans/s57-acces-ancien-proprietaire.md` (validated: yes, décisions 1 à 12), les critères de s57 dans `docs/stories.md`, AGENTS.md, ADR 010, 029, 034, 038, 054, 073 et 075 (nouvel ADR), `docs/design-system.md`, `docs/designs/s57-acces-ancien-proprietaire.md`.

## Ce que j'ai exécuté moi-même

J'ai tout lancé sur une copie de la branche sur disque local, pour éviter les expirations de workers du montage 9p. La copie a été faite par `git archive feature/s57-acces-ancien-proprietaire | tar -x` dans le scratchpad, avec un lien symbolique vers `/workspace/node_modules` et la copie de `.env.test`.

- `pnpm test --run` : **494 fichiers passés sur 494, 6835 tests passés, 4 ignorés.** Aucune expiration de worker, code de sortie 0.
- `npx tsc --noEmit` : 0 erreur.
- `npx eslint` sur les 50 fichiers `.ts`/`.tsx` touchés : 0 erreur.
- `pnpm check:rules` : « Règles et documentation alignées sur le code. »
- Les e2e Playwright n'ont pas été lancés, conformément à la consigne (ils tournent en CI). Je les ai relus.

## Conformité au plan

- [x] Le code fait ce que le plan demande, et rien de plus, à un détail mineur près (m1).

Vérification tâche par tâche :

1. **Règle pure.** `src/services/rules/member-profile-access-rules.ts` contient :
   - `addMonthsToDay`, qui ramène au dernier jour du mois (31/08 + 6 donne 28/02, ou 29/02 une année bissextile) ;
   - `profileAccessOf` avec ses quatre états ;
   - `isBeforeSale`, qui compare strictement à `soldOn` ;
   - `accessWindowOf`, qui donne `openUntil = closesOn − 1` (par `addDays` de `campaign-schedule-rules.ts`, dont j'ai vérifié l'existence) et `closedSince = closesOn`.

   Les tests couvrent J−1 / J / J+1, la fin de mois, l'année bissextile, la plus tardive de plusieurs périodes, une période ouverte parmi des closes, l'absence de période, le recalcul quand le délai change, et le jour même de la vente. C'est conforme à la décision 8.
2. **Paramètre.** Clé `member.access_after_sale_months` de type `number`, `min 1`, `max 60`, `integer`, défaut `6`, `unitKey: 'units.months'`, `editableBy: 'super_admin'`, `readOnlyHelpKey: 'campaignNature.superAdminOnly'`, section `member_access` placée après `invitation`. L'accesseur `getMemberAccessAfterSaleMonths` passe par `numberSettingOf` (vérifié). Le seed TechCorp vaut `6` et le commentaire d'en-tête renvoie au conseil RGPD. Conforme aux décisions 3, 9 et 10.
3. **Service d'accès.** `getMyAccessibleProfiles`, `hasMemberSpaceAccessService` et `readProfileAccess` lisent sous `withTenant`. La façade et l'intercepteur sont créés, avec `shouldLogDetails: () => false` ; la façade n'exporte que `hasMemberSpaceAccessService`. Le JSDoc assume l'absence d'autorisation.
4. **Règle de session asynchrone.** `canOpenSessionOn(user, organization, {impersonated})` suit cet ordre : SuperAdmin, puis ligne `member` absente, puis imitation, puis rôle différent de `member`, puis appel à la façade par `import()`. Une exception donne `false` et un `logger.error` sans adresse. Les quatre appelants sont migrés et `isMemberOf` n'a pas changé.
5. **Lecteurs et écrivains de l'espace membre** migrés vers `getMyAccessibleProfiles` : `member-space-service`, `my-email-service`, `member-email-pending-authors`, `incident-report-service`, `member-question-service`. Les lecteurs du bureau (`member-profile-support` aux lignes 142 et 218, `member-role-service`, `organization-service`) sont inchangés, comme la décision 1 et l'ADR 075 §4 le demandent.
6. **Factures et documents d'avant la vente** : listes et accès par identifiant (`getMyInvoicePdfUrlService`, `readMemberDocumentFileService`, branche possession seulement). `landCount` porte sur les fiches accessibles.
7. **Côté bureau** : `accessWindow` dans le DTO, états A1 à A5 et A3-bureau, refus `access_closed` contrôlé avant tout lien, Server Action adaptée.
8. **e2e.** Le bloc « Accès après la vente — s57 » de `e2e/member-accounts.spec.ts` couvre les critères 2 à 8 et l'accès croisé TechCorp / Marketing Pro. `e2e/association-settings.spec.ts` couvre la lecture seule du bureau.
9. **Documentation.** `docs/architecture.md` et `docs/design-system.md` sont complétés.

## Vérification anti-hallucination

- [x] Aucune API, fonction ou import inventé : j'ai ouvert chaque cible.
  - `listOwnershipPeriodsByProfilesDao(ids)` existe (`parcel-ownership-repository.ts:314`) ; il passe par `getDb()` et rend `memberProfileId` / `startsOn` / `endsOn`.
  - `getMemberProfilesByUserIdDao(organizationId, userId)` et `MyMemberProfileRow` existent (`member-profile-repository.ts:497` et `:93`).
  - Existent aussi : `orderMyProfiles`, `calendarDayOf` (`water-analysis-types.ts:155`), `memberProfileOrganizationIdSchema`, `createServiceInterceptor` avec l'option `shouldLogDetails`, `UserOrganizationRoleConst.MEMBER = 'member'`, `BoardRoleBadge({role})`, `isoToFrenchDate`.
  - **Point qui aurait pu être critique : `membership.role`.** La règle ne garde le bureau que si `user.organizations[].role` est renseigné. J'ai vérifié qu'il l'est pour les trois sources. `getUserByIdDao`, utilisé par `customSession` et par le hook, comme `getUserByEmailDao`, utilisé par `sendMagicLink` et `issueInvitation`, rendent les lignes `members` complètes, dont la colonne `role` (`organizationRoleEnum`, défaut `member`). Un membre du bureau n'appelle donc jamais la façade.
  - **`impersonatedBy` dans le hook `session.create.before`.** Le plugin `admin()` pose `impersonatedBy` sur la session créée (`node_modules/better-auth/dist/plugins/admin/routes.mjs:597`). Le test sur un vrai Better Auth, `impersonation.real-auth.test.ts`, le prouve : une imitation s'ouvre avec une façade qui répond `false` et cette façade n'est jamais appelée. Sans imitation, la création de session est refusée.
- [x] Aucune valeur ni logique plausible mais fausse. Les bornes concordent avec la décision 8 et l'exemple du design : vente le 15/06/2026, accès ouvert jusqu'au 14/12/2026, fermé depuis le 15/12/2026. « Avant la vente » est strict. `withTenant` imbriqué (`getAssociationSettingsService` est appelé dans le scope de `readProfilesWithAccess`) réutilise la même transaction et restaure le réglage (`runInNestedScope`).
- [x] Le code fait ce qu'il annonce.

## Points que l'implémenteur m'a demandé de trancher

| Point                                                           | Verdict |
| --------------------------------------------------------------- | ------- |
| `canOpenSessionOn` asynchrone, `{impersonated}`, refus en cas d'erreur | Correct. Conforme à l'ADR 075 §3 et à la décision 11. Le journal ne contient que `organizationId` et le message d'erreur, jamais d'adresse ; c'est testé (`association-membership.test.ts`). |
| Test anti-cycle `magic-link-integration-imports.test.ts`        | Vert. La façade est chargée par `import()`. Le seul import statique ajouté à `association-membership.ts` est `@/lib/logger`, qui n'ouvre pas de cycle. |
| Accès par identifiant filtrés « avant la vente »                | Correct. Le PDF d'une facture forgée émise après la vente donne `not_found` sans appel à Pennylane. Un document d'après la vente ou d'une fiche fermée lève `NotFoundError`. La branche `member.document.manage` n'est pas filtrée. Tout est testé. |
| `updateMyMemberProfilesContactDao(…, memberProfileIds, …)`      | Correct. Le filtre `inArray(ids)` s'ajoute au lien `linkedProfileIds(organizationId, userId)`, qui reste en place : un identifiant hors du compte n'est jamais écrit. Une liste vide rend `[]` sans requête. |
| Lecteurs du bureau de `getMemberProfilesByUserIdDao` inchangés  | Correct, et la non-régression « Ce compte réunit aussi » est testée. |
| Coût par lecture ajouté à `readProfileView`                     | Acceptable : une lecture des périodes et une lecture des réglages par fiche affichée. Voir m4. |
| Textes hors design (`access.closedMailOnly`, `invitation.accessClosedRefused`) | Mineur (m2). Ils sont dérivés des patrons existants (`closed`, `mailOnlyRefused`) et de l'état A5 du design. |
| Texte genré « il voit encore… » (état A2)                       | Mineur (m3). C'est le texte exact du design. |
| Modifications de `docs/architecture.md` et `docs/design-system.md` | Demandées par la tâche 9. Elles décrivent l'existant, sans nouveau composant ni token. |
| Paramètre réservé au SuperAdmin, rien en dur (ADR 010)          | Correct. Le délai vient du registre et du seed du premier tenant. `AFTER_SALE_MONTHS = 6` n'apparaît que dans l'e2e, pour refléter le seed. |
| Test e2e d'accès croisé (AGENTS.md)                             | Présent. Un compte fermé sur TechCorp garde sa session ouverte sur Marketing Pro, où sa fiche est ouverte. Le bureau de Marketing Pro, avec l'identifiant d'une fiche de TechCorp, obtient une 404, sans le nom ni la date. |
| RLS / `withTenant` / `getDb()`, aucun nouveau `withRlsBypass`   | Correct. Aucune occurrence de `withRlsBypass` dans le diff. Les repositories passent par `getDb()`. Le scope est testé (`member-profile-access-service.test.ts`, « lit sous le scope de l'association passée »). |

## Conformité aux règles

- [x] Les conventions d'AGENTS.md sont respectées : architecture en couches (façade pour l'appel venant de `lib/better-auth`, service vers service en interne), libellés dans `messages/fr.json`, rien en dur, un seul commit, aucune migration.
- [x] Aucun ADR accepté n'est contredit. L'ADR 038 est complété, et non contredit : le contrôle se fait toujours à chaque lecture par la même règle unique (ADR 034). L'ADR 075 est appliqué point par point.
- [x] Le design system est respecté. Seuls des composants et classes déjà existants sont utilisés : `DetailCard`, ligne `Lock`, `t.rich` avec `<strong>`, `BoardRoleBadge`, aide `text-muted-foreground text-[15px]`, `text-[17px]`. La carte des réglages est générée par le registre, sans composant nouveau. L'intention de l'écran A est tenue : en A2 une phrase s'ajoute, en A3 la phrase d'ouverture est remplacée et le bouton cède la place à l'aide, en A3-bureau le badge et la phrase du back-office apparaissent, en A5 le texte se décline. L'écran B est également conforme : B1 et B2 en lecture seule avec la phrase du conseil RGPD, B3 avec le défaut 6, B4 avec le message propre.

## Tests

- [x] J'ai lancé la suite moi-même, et elle passe (chiffres plus haut).
- [x] Les assertions épinglent les critères d'acceptation :
  - critère 3 : test du service avec une horloge doublée (`vi.useFakeTimers({toFake: ['Date']})`) à J−1 et J+1, plus la règle pure à J ;
  - critères 4, 5 et 7 : fiches de Lefèvre, proche titulaire ailleurs, rachat sur la même fiche et sur une nouvelle ;
  - critère 6 : facture et document de la veille, du jour, d'après, impayée d'avant et d'après, identifiants forgés ;
  - critère 8 : dates de la décision 8 dans `member-profile-service.test.ts` et rendu du composant ;
  - règle de session : chaque branche, y compris l'absence d'appel à la façade pour le SuperAdmin, le bureau et l'imitation.

  En e2e, la coupure est prouvée par un rechargement réel vers `/login?acces=ferme`. L'e2e vérifie aussi que rien n'est supprimé (ligne `member` et lien conservés) et que le rachat rouvre l'accès. Les périodes sont relatives au jour réel de Paris.

## Régressions

- [x] Aucun impact sur les chemins existants. J'ai repris tous les appelants de `canOpenSessionOn` ; les mocks des tests existants ont été ajustés (`role: 'member'`, façade simulée) sans affaiblir leurs assertions. Les comptes sans fiche ou dont les fiches n'ont aucune période (Ferrand, C7) restent hors règle. Le surcoût par requête authentifiée d'un compte de rôle `member` est documenté et accepté dans les conséquences de l'ADR 075.

## Constats

- **m1 (mineur)** — `e2e/member-accounts.spec.ts` : le bloc s57 est un `test.describe` simple, alors que la tâche 8 demandait un bloc en série. Sans conséquence aujourd'hui, car chaque test pose ses propres fiches, adresses et parcelles, avec un nommage par `RUN` et un nettoyage en `afterAll`. Petit écart de forme avec le plan.
- **m2 (mineur)** — `messages/fr.json` : deux textes absents du design. `BureauMemberProfilesPage.detail.access.closedMailOnly` est la phrase A5 « fermé », que le design laisse en « … ». `invitation.accessClosedRefused` est le refus serveur d'une fiche fermée entre l'affichage et le clic. Tous deux suivent les patrons existants (`closed`, `mailOnlyRefused`), mais ils auraient dû être signalés comme écarts du design plutôt qu'ajoutés en silence.
- **m3 (mineur)** — `messages/fr.json`, `detail.access.grace` : « il voit encore ses factures… » est genré alors que la phrase est paramétrée par `{name}`. Le texte reprend celui du design ; une tournure neutre (« ses factures et documents d'avant cette date restent visibles ») serait plus juste pour une fiche au nom d'une femme ou d'une entreprise.
- **m4 (mineur)** — `src/services/member-profile-support.ts`, `readProfileView` : `readProfileAccess` ouvre son propre `withTenant` et relit les réglages du tenant à chaque affichage de fiche du bureau, en plus des lectures existantes. Le coût est faible mais pourrait être mutualisé avec les lectures déjà faites pour la fiche.
- **m5 (mineur)** — `src/services/facades/interceptors/member-profile-access-service-logger-interceptor.ts` : l'intercepteur journalise l'appel de `hasMemberSpaceAccessService` en `info` à **chaque** requête authentifiée d'un membre, sans détails, donc sans fuite. Cela ajoute du bruit dans les journaux, à surveiller en production. Même patron que les autres façades.
- **m6 (mineur)** — `src/services/member-profile-access-service.ts`, conception à noter : un défaut de scope qui ne rendrait aucune fiche serait lu comme « hors règle », donc **ouvert**. L'ADR 075 le reconnaît, et le scope est épinglé par un test unitaire et par l'e2e de coupure. Ce n'est pas un défaut aujourd'hui, mais une hypothèse à garder en tête si ce chemin change.

## Verdict

La story est livrable : aucun constat critique ni majeur, six mineurs à reprendre au tour final.

Max severity: minor
Ship allowed: yes
