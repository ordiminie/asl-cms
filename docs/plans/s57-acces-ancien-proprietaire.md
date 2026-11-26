---
validated: yes
---

# Plan — Story s57-acces-ancien-proprietaire

Branch: `feature/s57-acces-ancien-proprietaire`

Sources : `docs/research/s57-acces-ancien-proprietaire.md`, `docs/designs/s57-acces-ancien-proprietaire.md`
(+ `.html`, référence visuelle seulement), [ADR 075](../decisions/075-acces-apres-la-vente-regle-par-fiche-calculee-a-chaque-lecture.md)
(complète les ADR 034 et 038).

## Target story

Le vendeur d'un terrain garde son accès pendant un délai paramétré, puis le perd, sans que rien soit
supprimé ; le bureau continue de tout consulter depuis la fiche.

1. Une fiche dont toutes les périodes sont closes reste ouverte à toutes ses adresses et à tous ses comptes
   (titulaire et proches) pendant un délai du tenant (seed six mois) à partir de la fin de sa dernière
   période.
2. Passé le délai, l'accès à cette fiche est fermé sans rien supprimer ; le bureau consulte factures,
   relevés et documents depuis la fiche ; les autres fiches du compte ne sont pas touchées.
3. Contrôle à chaque lecture de session (ADR 038), sans tâche planifiée ; horloge doublée J-1 / J+1.
4. Qui vend un terrain mais en garde un autre conserve son accès.
5. Le proche d'une fiche vendue perd cette fiche au même délai, pas celles où il est titulaire ni celles
   dont le propriétaire n'a pas vendu.
6. Pendant le délai, factures et documents d'avant la vente seulement ; une impayée reste visible.
7. Un rachat rouvre l'accès sans intervention.
8. Le bureau voit sur la fiche la date de fin d'accès prévue.

## Décisions

**Arbitrages de l'utilisatrice du 26/11/2026** (non rouverts) :

1. **Règle par fiche.** Une fiche dont toutes les périodes sont closes perd l'accès `délai` après la fin de
   sa dernière période, pour toutes ses adresses et tous ses comptes (titulaire et proches). La session
   reste ouverte tant qu'au moins une fiche reliée est ouverte (propriétaire, dans le délai, ou hors
   règle). Une fiche fermée sort de l'espace membre : listes, écritures « sur toutes mes fiches », accès
   par identifiant. Un rachat sur une **nouvelle** fiche ne rouvre pas l'ancienne ; une nouvelle période
   sur **la même** fiche la rouvre d'elle-même. Un membre du bureau ou la présidence garde le bureau : un
   rôle autre que `member` n'est jamais retiré, rien n'est supprimé.
2. **Visibilité pendant le délai** : factures dont `issued_on` est antérieur à la vente (fin de la
   dernière période), documents dont `document_date` est antérieur à la vente ; une facture émise après
   est masquée, même impayée. Le filtre ne s'applique qu'à une fiche qui ne possède plus rien. Les accès
   par identifiant (`getMyInvoicePdfUrlService`, `readMemberDocumentFileService`) appliquent le même
   filtre (test d'identifiant forgé).
3. **Paramètre** : réglage du tenant en **mois**, seed 6, `editableBy: 'super_admin'` (le bureau le voit en
   lecture seule), calculé à la volée : aucune date stockée, un changement s'applique rétroactivement.

**Défauts de l'orchestrateur** (révisables à la validation du plan) :

4. Une fiche **sans aucune période** est hors règle : accès comme aujourd'hui (Ferrand au seed, e2e
   « C7 — une fiche sans parcelle voit Mes coordonnées »). Un compte de rôle `member` sans aucune fiche
   reliée est aussi hors règle (la session reste régie par la seule ligne `member`, comme aujourd'hui).
5. **Relevés** (s17, s18) non livrés : rien à brancher ; s18 appliquera la même date de vente à ses
   lectures (noté dans l'ADR 075).
6. **Invitations** : elles suivent la règle de session. L'invitation individuelle (s42a) refuse côté
   serveur une fiche fermée (`access_closed`) et l'écran A3 remplace le bouton par l'aide. Le lancement et
   les relances (s42b) passent par le générateur de liens, donc par `canOpenSessionOn` : un compte refusé
   n'obtient aucun lien, son destinataire passe en échec et rien ne part (comportement existant de
   `campaign-service.ts`, aucun filtre de cible ajouté). Les **campagnes** (s25, s27) restent hors
   périmètre : la cible est le choix du bureau.
7. **Connexion à la place d'un compte (s48)** : elle s'ouvre toujours sur un compte fermé (le SuperAdmin
   peut tout faire) ; l'espace vu est celui que la règle laisse au compte (fiches fermées absentes). Le
   bureau consulte tout depuis la fiche.
8. **Borne de date** (ADR 029, jour calendaire de Paris par `calendarDayOf`) : `soldOn` = la plus tardive
   des `ends_on` de la fiche ; `closesOn` = `soldOn + N mois`, le jour ramené au dernier jour du mois s'il
   n'existe pas (31/08 + 6 = 28/02, ou 29/02 une année bissextile). Accès ouvert tant que
   `today < closesOn` (dernier jour ouvert : la veille, affiché « Accès ouvert jusqu'au … ») ; fermé à
   partir de `closesOn` (affiché « Accès fermé depuis le … »). Exemple du design : vente le 15/06/2026 →
   ouvert jusqu'au 14/12/2026, fermé depuis le 15/12/2026. « Avant la vente » = strictement avant
   `soldOn` (le jour de la vente est le premier jour de l'acquéreur). Horloge doublée en unitaire, horloge
   réelle en e2e.
9. **Section de réglages** (gap 1 du design) : nouvelle section `member_access` de l'union
   `AssociationSettingSection`, placée juste après `invitation` dans le registre (le formulaire généré
   range les cartes dans l'ordre du registre). C'est la voie la plus simple du registre : un membre de
   l'union et deux libellés (`cards.member_access.title` / `.description`), aucun composant ; ranger le
   champ dans « Invitation des membres » aurait obligé à réécrire la description de cette carte.
10. **Bornes du paramètre** : `member.access_after_sale_months`, entier, `min: 1`, `max: 60`, défaut `6`,
    unité `units.months` (« mois », gap 2), `readOnlyHelpKey: 'campaignNature.superAdminOnly'` (phrase du
    conseil RGPD déjà employée, design B2). Refus de `0`, négatif, décimal, texte : message propre
    « Saisissez un nombre entier de mois supérieur à 0. » ; au-dessus de 60 : message commun `aboveMax`.
11. **Erreur de lecture dans la règle de session** : refus (fermé par défaut), journalisé sans adresse.
12. **Inventaires** : aucune table, aucune colonne, aucune clé de fichier — rien à déclarer à s12c ; s38 et
    s39 ne sont pas livrées. Une ligne `organization_setting` de plus est déjà couverte.

## Tasks (ordered)

1. [x] **Règle pure du délai** — `src/services/rules/member-profile-access-rules.ts` (+ types dans
       `src/services/types/domain/member-profile-access-types.ts`) : `addMonthsToDay(day, months)` (jours
       calendaires `YYYY-MM-DD`, sans fuseau, patron de `addDays` de `campaign-schedule-rules.ts`, jour
       ramené au dernier du mois) ; `profileAccessOf(periods, months, today)` →
       `{status: 'out_of_rule'} | {status: 'owner'} | {status: 'grace', soldOn, closesOn} | {status:
'closed', soldOn, closesOn}` (décision 8) ; `isBeforeSale(day, access)` (vrai hors `grace`, sinon
       `day < soldOn`). **Vérif** : tests unitaires (sans faux minuteur, `today` en argument) — critère 3
       : `closesOn − 1` → `grace`, `closesOn` → `closed`, `closesOn + 1` → `closed` ; 31/08 + 6 → 28/02 et
       29/02 bissextile ; plusieurs parcelles vendues à des dates différentes → la plus tardive ; une
       période ouverte parmi des closes → `owner` (critère 4 sur une même fiche) ; aucune période →
       `out_of_rule` ; changement de `months` → résultat recalculé (rétroactif) ; `isBeforeSale` le jour
       même de la vente → faux.
2. [x] **Paramètre du délai** — `association-settings-types.ts` : clé
       `MEMBER_ACCESS_AFTER_SALE_MONTHS_SETTING_KEY = 'member.access_after_sale_months'`, section
       `member_access` ajoutée à l'union, entrée du registre après la dernière entrée `invitation`
       (décisions 9 et 10), accesseur `getMemberAccessAfterSaleMonths(settings)` sur `numberSettingOf` ;
       `messages/fr.json` : `AssociationSettings.cards.member_access.*`, `fields.memberAccessAfterSaleMonths.*`
       (libellé, aide, erreur), `units.months` (textes du design B) ; `src/db/scripts/tenant-settings-seed.ts`
       : `techcorp-solutions` = `6`, commentaire d'en-tête (valeur de seed du premier tenant, conseil RGPD à
       consulter). **Vérif** : `association-settings-rules.test.ts` (défaut 6, refus 0 / -1 / 1,5 / texte /
       61, champ réservé au SuperAdmin) ; test du formulaire : lecture seule pour le bureau (B2), modifiable
       pour le SuperAdmin (B1), carte placée après « Invitation des membres ».
3. [x] **Service d'accès par fiche** — `src/services/member-profile-access-service.ts` :
       `getMyAccessibleProfiles(organizationId, userId)` (sous `withTenant` : `getMemberProfilesByUserIdDao`,
       `listOwnershipPeriodsByProfilesDao` sur ces fiches, `getAssociationSettingsService`, `today =
calendarDayOf(new Date())` lu une fois ; rend les fiches hors `closed`, ordonnées par
       `orderMyProfiles`, chacune avec `access`) et `hasMemberSpaceAccessService(organizationId, userId)`
       (vrai sans fiche reliée ou si une fiche est hors `closed`). Façade
       `src/services/facades/member-profile-access-service-facade.ts` + intercepteur (patron des façades
       existantes), qui n'exporte que `hasMemberSpaceAccessService`. Aucun contrôle d'autorisation dans
       `hasMemberSpaceAccessService` (appelée avant toute session, comme `getAssociationSettingsService`),
       commentaire JSDoc qui le dit. **Vérif** : tests de service avec `vi.useFakeTimers({toFake: ['Date']})`
       + `vi.setSystemTime` — J-1 ouvert, J+1 fermé (critère 3) ; Lefèvre vend la fiche 1 et garde 2 et 3 :
       session ouverte, fiche 1 absente passé le délai (critères 2, 4) ; proche titulaire ailleurs : sa
       fiche garde l'accès, la fiche vendue sort (critère 5) ; nouvelle période sur la même fiche → rouverte
       (critère 7), rachat sur une nouvelle fiche → l'ancienne reste fermée ; fiche sans période → ouverte ;
       `withTenant` appelé avec l'association passée.
4. [x] **Règle de session asynchrone (ADR 075 §3)** — `association-membership.ts` :
       `canOpenSessionOn(user, organization, options?: {impersonated?: boolean}): Promise<boolean>` —
       SuperAdmin → vrai ; pas de ligne `member` → faux ; `impersonated` → vrai ; rôle de la ligne autre que
       `member` → vrai ; sinon façade de la tâche 3 chargée par `import()` ; exception → faux + `logger.error`
       sans adresse (décision 11). Appelants : `getAuthUser` (`impersonated` depuis
       `session.session.impersonatedBy`), `openSessionOnRequestDomain` (depuis `session.impersonatedBy` —
       vérifier à l'exécution que le hook `before` le reçoit lors d'une imitation ; sinon, lire la session
       créée par le plugin `admin()` et le consigner au rapport), `sendMagicLink`, `issueInvitation` ;
       `isMemberOf` inchangé (garde de `recordFirstSignInOnRequestDomain`). **Vérif** :
       `association-membership.test.ts` (chaque branche, façade simulée, refus sur exception, aucun appel à
       la façade pour SuperAdmin / bureau / imitation), `association-session-guard.test.ts`,
       `auth-service-session-access.test.ts`, `auth-service-acting-context.test.ts`, tests du lien magique
       mis à jour ; `magic-link-integration-imports.test.ts` reste vert (aucun import statique de service).
5. [x] **Espace membre : lecteurs et écrivains** — remplacer « mes fiches » par `getMyAccessibleProfiles`
       dans les seuls chemins membre : `member-space-service.ts` (`getMyLandsService`, `getMyContactService`,
       `updateMyContactService` — l'écriture vise les seules fiches accessibles : `updateMyMemberProfilesContactDao`
       reçoit la liste des identifiants, toujours bornée par le lien au compte dans la requête),
       `my-email-service.ts` (`loadMine`), `member-email-pending-authors.ts` (`profileIdsOfMemberAuthor` :
       une adresse en attente d'une fiche fermée n'est plus activable), `incident-report-service.ts` (l. 490,
       546), `member-question-service.ts` (l. 225, 268). Les lecteurs du bureau (`member-profile-support.ts`
       `findEmailHolder` / `readAccountView`, `member-role-service.ts`, `organization-service.ts`) gardent
       `getMyMemberProfiles` / `getMemberProfilesByUserIdDao`. **Vérif** : tests de service — une fiche
       fermée n'apparaît ni dans « Mes terrains », ni dans les coordonnées, n'est pas écrite par
       `updateMyContactService`, ne reçoit pas d'adresse ajoutée, n'est pas la « première fiche » d'un
       signalement / d'une question ; non-régression : « Ce compte réunit aussi » liste encore la fiche
       fermée (bureau). Mocks des 14 fichiers de `src/services/__tests__/` ajustés.
6. [x] **Factures et documents d'avant la vente (critère 6)** — `getMyInvoicesService` (fiches accessibles,
       puis `isBeforeSale(invoice.issuedOn, access)`), `getMyInvoicePdfUrlService` (possession **et** même
       filtre), `getMyMemberDocumentsService` (`row.documentDate`), `readMemberDocumentFileService` (branche
       possession seulement ; la branche `member.document.manage` n'est pas filtrée). Le décompte
       `landCount` porte sur les fiches accessibles. **Vérif** : tests — en délai, facture du jour d'avant la
       vente visible, du jour de la vente masquée, impayée d'avant visible, impayée d'après masquée ;
       document daté de la veille visible, du jour masqué ; identifiant forgé d'une facture d'après la vente
       → `not_found` ; d'un document d'après la vente ou d'une fiche fermée → `NotFoundError` ; bureau
       (`member.document.manage`) lit tout.
7. [x] **Bureau : date de fin d'accès et invitation (critère 8, écran A)** — `MemberProfileDTO.accessWindow`
       (`null` en `owner` / `out_of_rule`, sinon `{status: 'grace', soldOn, openUntil}` ou `{status: 'closed',
soldOn, closedSince}`), calculé dans `readProfileView` (`member-profile-support.ts`) à partir des
       périodes de la fiche, du paramètre et du jour de `now` déjà reçu ; `member-profile-detail.tsx`
       (`AccessState`, `MemberInvitation`) : états A1 à A5 et A3-bureau du design, composants existants
       seulement (`DetailCard`, ligne `Lock`, `t.rich`, `badge`, aide sur le patron de `mailOnlyHint`) ;
       `inviteMemberProfileService` refuse une fiche fermée (`{status: 'access_closed'}`, avant tout lien),
       Server Action et message correspondants ; libellés sous `BureauMemberProfilesPage.detail.access`.
       **Vérif** : tests du service de fiche (dates de la décision 8), du refus d'invitation par appel
       direct, du composant (A1 / A4 inchangés, A2 phrase ajoutée et bouton présent, A3 phrase remplacée
       et bouton absent, A3-bureau badge, A5 courrier uniquement).
8. [x] **e2e et isolation** — `e2e/member-accounts.spec.ts` (bloc s57, série) : fiches et périodes posées
       en SQL direct **relativement au jour réel** (patron l. 198-219), nettoyées en `afterAll`. Vendeur en
       délai : se connecte, voit la facture et le document d'avant la vente, pas ceux d'après (6) ; vendeur
       hors délai avec session ouverte : rechargement → `/login?acces=ferme` (2, 3) ; compte à deux fiches,
       une fermée : session ouverte, fiche fermée absente de « Mes terrains » (4) ; proche titulaire
       ailleurs (5) ; nouvelle période ouverte sur la fiche fermée → accès retrouvé au rechargement (7) ;
       fiche du bureau : « Accès ouvert jusqu'au … » / « Accès fermé depuis le … », bouton d'invitation
       absent en A3 (8). Accès croisé (`e2e/tenant-isolation.spec.ts` ou même bloc) : un compte fermé sur
       TechCorp (`localhost`) garde sa session sur Marketing Pro (`127.0.0.1`) où sa fiche est ouverte ; le
       bureau de Marketing Pro, avec l'identifiant d'une fiche de TechCorp, n'obtient ni la fiche ni sa date
       (404). Réglages : le bureau voit le délai en lecture seule (`association-settings.spec.ts`).
       **Vérif** : e2e en CI GitHub (jamais en local) ; suites existantes `member-accounts`,
       `member-invoices`, `member-documents`, `impersonation` vertes.
9. [x] **Docs et contrôles** — `docs/architecture.md` (règle de session de l'ADR 038 complétée par l'ADR
       075 ; paramètre `member.access_after_sale_months` dans la liste des paramètres du tenant si elle y
       figure) ; `docs/design-system.md` si un réglage réservé au SuperAdmin y est recensé (s52, s27b).
       **Vérif** : `pnpm lint`, typecheck, `pnpm check:rules`, `pnpm test --run` verts (copie sur disque
       local si le montage 9p fait expirer les workers ; un timeout ne compte jamais comme vert).

## Files touched

- Règles et types : `src/services/rules/member-profile-access-rules.ts` (nouveau),
  `src/services/types/domain/member-profile-access-types.ts` (nouveau),
  `src/services/types/domain/association-settings-types.ts`, `src/services/types/domain/member-profile-types.ts`.
- Services : `src/services/member-profile-access-service.ts` (nouveau), façade
  `member-profile-access-service-facade.ts` + intercepteur (nouveaux), `member-space-service.ts`,
  `member-document-service.ts`, `my-email-service.ts`, `member-email-pending-authors.ts`,
  `incident-report-service.ts`, `member-question-service.ts`, `member-profile-support.ts`,
  `member-invitation-service.ts` (+ types de résultat d'invitation).
- Auth : `src/lib/better-auth/association-membership.ts`, `association-session-guard.ts`,
  `magic-link-integration.ts`, `src/services/authentication/auth-service.ts`.
- Persistance : `src/db/repositories/member-profile-repository.ts` (`updateMyMemberProfilesContactDao`
  borné aux fiches passées) ; aucun modèle, aucune migration.
- Présentation : `src/components/features/member-profile/member-profile-detail.tsx`, action d'invitation
  de `bureau/proprietaires/[id]/actions.ts`, `messages/fr.json` ; formulaire des réglages inchangé (rendu
  généré).
- Seed : `src/db/scripts/tenant-settings-seed.ts`.
- Tests : `src/services/__tests__/*` (nouveaux et mocks ajustés), `src/lib/better-auth/*.test.ts`,
  composants ; `e2e/member-accounts.spec.ts`, `e2e/tenant-isolation.spec.ts`, `e2e/association-settings.spec.ts`.
- Docs : ADR 075, `docs/architecture.md`, recherche, design, plan.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run <chemin>`)** : règle pure d'abord (bornes J-1 / J / J+1, fin de
  mois, bissextile, plusieurs périodes, sans période) ; service d'accès avec horloge doublée
  (`vi.setSystemTime`) pour le critère 3 ; règle de session par branche (SuperAdmin, non membre,
  imitation, bureau, membre ouvert / fermé, exception) ; services membre (exclusion des fiches fermées,
  filtre avant la vente) ; non-régression des lecteurs du bureau.
- **Autorisation** : appels directs avec identifiants forgés (PDF de facture d'après la vente, document
  d'une fiche fermée, invitation d'une fiche fermée) ; aucune confiance dans l'interface.
- **e2e (Playwright, CI)** : coupure prouvée par rechargement réel (ADR 038) ; périodes relatives au jour
  réel ; accès croisé entre TechCorp et Marketing Pro. La RLS ne se teste pas en unitaire.

## Definition of Done

- Une PR, branche `feature/s57-acces-ancien-proprietaire`, un commit de story (aucune migration).
- Les huit critères couverts par un test nommé ; le critère 3 en unitaire avec horloge doublée, la coupure
  en e2e par rechargement.
- Aucun délai en dur : paramètre du registre, seed du premier tenant ; textes dans `messages/fr.json`.
- Rien n'est supprimé par la coupure (aucun appel à `closeMemberAccount` ni à `deleteMemberWithRoleDao`).
- `withTenant` / `getDb()` partout ; accès croisé testé en e2e.
- `/ks-review` passée sans critique ; e2e verts en CI.
- Rappel : la durée attend l'avis du conseil RGPD ; aucune purge codée.
