# Research — Story s19-factures-liste

Recherche du 9 novembre 2026, sur `origin/main` à `eb32f209` (PR 60 mergée), branche `feature/s19-factures-liste`.
`docs/reviews/stories.md` : `Stories ready: yes`. Dépendances s02, s12, s12d : livrées (revues `Ship allowed: yes`).

## Target story

**Consulter ses factures** — complexité 3, story avec écran (pas encore de `docs/designs/s19-*`).
Un membre propriétaire voit la liste de ses factures et leur statut. La story livre **l'interface**
`MemberBillingProvider` et son **implémentation manuelle** (saisie par le bureau). Pennylane est s20 et
ne doit rien changer ici.

Critères d'acceptation (résumé fidèle, numérotés pour la suite) :

1. Le membre connecté voit ses factures (date, objet, montant, statut), date décroissante.
2. Le statut est affiché **tel que fourni par la source**, intermédiaires compris, jamais réduit à payé/impayé.
3. Une facture porte une **date d'échéance**, distincte de la date d'émission (elle date les relances de s29).
4. La configuration du tenant désigne les statuts qui valent « impayé » ; le prédicat « impayé » qui en
   découle est lisible et testable depuis cette story.
5. Un statut jamais vu n'est **pas** réputé réglé : il est signalé au bureau comme « à classer » et la
   facture reste hors de la cible des relances tant qu'il ne l'est pas.
6. Un membre ne voit aucune facture d'un autre (test d'autorisation croisée, identifiant forgé compris).
7. Une facture est rattachée au **membre facturé** (sa clé primaire), jamais à la parcelle. Test sur une
   parcelle vendue : factures d'avant la vente visibles du vendeur seul, factures d'après de l'acquéreur seul.
8. Le bureau saisit et met à jour une facture pour un membre ; le membre la voit apparaître.
9. Le service est appelé derrière une interface ; un test double l'implémentation sans toucher à la présentation.

Notes agentiques qui contraignent : le statut est **opaque**, le prédicat « impayé » est une **dérivation** déclarée
en configuration de tenant, et s21, s27, s29 le **consomment sans jamais réinterpréter un statut**. Aucun traitement
de paiement, aucune donnée bancaire (cimetière). Ne pas confondre avec Stripe (facturation plateforme).

## Current state of the code

**Rien n'existe pour les factures.** Aucun modèle, repository, service, route ni libellé : `grep -ri
'MemberBillingProvider\|invoice\|facture' src` ne trouve que `messages/fr.json:3214` (texte de vente de parcelle :
« Les factures, relevés et documents antérieurs au {date} restent ceux de {name} »), Stripe (facturation plateforme,
sans rapport) et `src/components/features/member-profile/sale-form.test.tsx`. Aucune colonne monétaire dans les
modèles : **pas de précédent de montant** dans le dépôt.

Ce qui existe et que s19 réutilise :

- **Fiche membre** `member_profile` (`src/db/models/member-profile-model.ts`) : `id` uuid (seule identité),
  `organization_id`, `user_id` (compte, nullable, unique par association), `pennylane_customer_id` (attribut d'import
  s13, ADR 048, unique par association). Une fiche existe sans compte.
- **Propriété datée** `parcel` / `parcel_ownership` (`src/db/models/parcel-model.ts`) : période demi-ouverte
  `[starts_on, ends_on)`, aucune colonne « propriétaire actuel ». Les colonnes de date sont `date(..., {mode: 'string'})`.
- **Espace membre** : `src/app/[locale]/(app)/dashboard/page.tsx` rend `<MemberSpace>` (cartes « Mes parcelles » et
  « Mes coordonnées »), alimenté par `src/app/dal/member-space-dal.ts` → `src/services/facades/member-space-service-facade.ts`
  → `src/services/member-space-service.ts`. Le service résout la fiche **par la session et le domaine appelé**,
  jamais par un identifiant d'entrée (`getMemberProfileByUserIdDao(organizationId, authUser.id)`), sous `withTenant`.
- **Back-office** : `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx` est la fiche d'un propriétaire
  vue par le bureau (rendu `MemberProfileDetail`, actions dans `../actions.ts`), gardée par
  `canManageCurrentMemberProfilesDal`. Barre latérale : `src/components/features/association/bureau-sidebar.tsx`
  (`NAV_GROUPS`, entrées `memberProfiles`, `identity`, `settings`…).
- **Réglages de tenant** : registre typé `ASSOCIATION_SETTINGS_REGISTRY`
  (`src/services/types/domain/association-settings-types.ts:202`), valeurs seules dans `organization_setting`
  (clé `(organization_id, key)`), lecture `getAssociationSettingsService` (sans contrôle d'accès, voulu),
  écriture `updateAssociationSettingsService` sous `ActionIdConst.ASSOCIATION_SETTINGS_UPDATE`.
- **Registre d'actions** : `ACTION_REGISTRY` / `ActionIdConst` (`src/services/types/domain/action-registry-types.ts`),
  contrôle par `canPerformAction(user, organizationId, actionId)` (`src/services/authorization/action-registry-authorization.ts`).
  Défaut fermé : une action absente est refusée.
- **Précédents de couture par fournisseur** : `createStorage(type, config)` (`src/lib/files/storage/storage-factory.ts`,
  cité par l'ADR 011) et `resolveEmailTransport(config)` (`src/lib/emails/transport/get-email-transport.ts`,
  `EmailTransport` + implémentations `brevo`, `file`, `memory`, `resend`). Fonctionnels, sans classe à état.

## Anchor points

| Besoin                                | Où s'accroche s19                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table de factures                     | nouveau modèle dans `src/db/models/` + export dans `src/db/models/db.ts` (liste de schémas, cf. lignes 27 et 57 pour `water-analysis`)                                   |
| Migration + RLS                       | `pnpm db:generate` puis `drizzle-kit generate --custom` pour la RLS ; dernière migration `0039_burly_frank_castle.sql`, la suivante sera `0040`                          |
| Contrat `MemberBillingProvider`       | couche service (ADR 011) : un module de contrat + deux implémentations (`manuel`, et le double de test) ; **pas** de sélection par variable d'environnement              |
| Choix de l'implémentation par tenant  | réglage d'association (ADR 010/011) ; la clé d'API Pennylane sera un secret dans `@/env` (s20), pas un réglage                                                          |
| Lecture membre                        | nouvelle fonction dans `member-space-service.ts` (ou service dédié) → façade → `member-space-dal.ts` (ou DAL dédié, **sans `'use cache'`**) → carte dans `MemberSpace` |
| Saisie par le bureau                  | écran sur la fiche `bureau/proprietaires/[id]` (ou sous-page), Server Action, action au registre                                                                        |
| Statuts « à classer » vus du bureau   | aucun mécanisme existant de compteur ou de file d'alerte dans la barre latérale (voir Open questions)                                                                    |
| Seed et e2e                           | `src/db/scripts/seed.ts` (étape 15, propriétaires/parcelles/périodes, deux tenants), `tenant-member-profiles-seed.ts`, `e2e/tenant-isolation.spec.ts`                    |

## Verified APIs / functions

Toutes ouvertes dans le code, pas déduites des docs.

- `getMemberProfileByUserIdDao(organizationId: string, userId: string): Promise<MemberProfileModel | undefined>`
  — `src/db/repositories/member-profile-repository.ts:297`.
- `getMemberProfileByPennylaneIdDao` — `member-profile-repository.ts:360` ; `findMemberProfileIdByPennylaneIdService`
  — `src/services/member-profile-service.ts:395`.
- `withTenant(organizationId, callback)` et `getDb()` — `src/db/tenant-scope.ts`. Un repository appelle `getDb()`,
  jamais `db`. Hors scope, la RLS ne rend rien.
- `getMyParcelsService(organizationId)` — `src/services/member-space-service.ts` : **le patron à suivre** pour une
  lecture côté membre (`safeParse` → `getAuthUser()` → `AuthorizationError` sans session → `withTenant` → fiche par
  `userId`). Retourne `undefined` pour un compte sans fiche.
- `getParcelOwnerAtService(organizationId, parcelId, date)` — `src/services/parcel-ownership-service.ts:247`,
  décrit par `docs/architecture.md` comme « le point d'entrée de s18, s19, s28 et s32 ». **Voir le piège n° 1 :**
  pour s19, le rattachement est au membre facturé, pas à la parcelle.
- `canPerformAction(user, organizationId, actionId)` — `action-registry-authorization.ts`. `ActionIdConst` a 13 entrées
  (dernière : `MEMBER_ROLE_ASSIGN`, s14) ; chaque entrée a `defaultRoles: ['owner', 'board']`.
- `ASSOCIATION_SETTINGS_REGISTRY` : types de définition **`email`, `number`, `boolean`, `choice`, `text`**
  (`association-settings-types.ts:42-77`). `page: 'settings' | 'identity'`, `section?: 'seo'`. **Aucun type « liste »**.
- `createServiceInterceptor(methods, 'NOM', {shouldLogDetails})` — `src/services/facades/interceptors/create-service-interceptor.ts` ;
  `member-space-service-logger-interceptor.ts` passe `shouldLogDetails: () => false` « le résultat nomme un propriétaire ».
- `requireCurrentTenantDal()` — `src/app/dal/tenant-dal.ts` (tenant résolu par le domaine, ADR 003).
- Composants : `Badge` (`src/components/ui/badge.tsx`), `Table`, `Card`, `Skeleton` ; le design system dit « `badge` = statut,
  jamais une action », lignes de tableau 56 px, chiffres en `font-mono` + `tabular-nums`, **cartes empilées sous 640 px**,
  date `02/09/2026` en tableau (`docs/design-system.md` §3.5, tableau des composants).
- `calendarDayOf` (`src/services/types/domain/water-analysis-types.ts`) et `formatContentDate`
  (`src/lib/cms/format-content-date.ts`) pour les dates calendaires.
- RLS : patron de `drizzle/migrations/0027_incident_report_rls.sql` (`ENABLE` + `FORCE ROW LEVEL SECURITY`, policy
  `tenant_isolation` sur `organization_id`, ou `app.bypass_rls = 'on'`).

## Traps & constraints

1. **Piège de rattachement : le rôle de `getParcelOwnerAtService` ici.** L'architecture désigne ce service comme point
   d'entrée de s19, mais le critère 7 rattache la facture au **membre facturé** (`member_profile.id`), pas à la parcelle.
   Une facture portant `member_profile_id` donne le comportement attendu **sans** relire `parcel_ownership` : le vendeur
   garde ses factures d'avant, l'acquéreur reçoit celles émises à son nom. `getParcelOwnerAtService` ne servirait que
   si la facture naissait d'une parcelle (c'est le cas de s17/s18, pas de s19). Ne pas ajouter de colonne `parcel_id`
   « pour la forme » : ce serait la FK que l'architecture interdit. Le test du critère 7 se joue en **vrai** sur deux fiches
   et une période close (`recordSaleService`), pas sur un mock de la lecture.
2. **Le statut est du texte opaque, pas un énuméré.** ADR 011 et la story l'interdisent : ni booléen, ni enum fermé
   déduit des statuts connus. Colonne `text`, sans `CHECK` sur des valeurs.
3. **Le prédicat « impayé » est une dérivation en configuration, et le registre de réglages ne sait pas porter une
   liste** (voir Open questions n° 1). Il faut en outre une notion **trois états** : impayé / classé non impayé /
   à classer (critère 5). Un statut absent des deux listes ne doit jamais valoir « réglé ».
4. **Le prédicat doit être une fonction pure, exportée, isomorphe et testée** (critère 4) : s21, s27 et s29 l'importent.
   Précédent de forme : `src/services/rules/*-rules.ts` (`member-account-rules`, `parcel-ownership-rules`), modules purs sans
   dépendance serveur, avec leur `.test.ts`.
5. **Données personnelles dans les journaux.** Les factures nomment un membre et un montant : l'intercepteur doit passer
   `shouldLogDetails: () => false` comme `member-space-service-logger-interceptor.ts`. Règle d'architecture : un service
   n'importe jamais sa façade.
6. **Ordre des couches** : présentation → DAL → façade → service → repository. La présentation n'importe rien de
   `src/db/models` ni de `src/db/repositories`. Les types utiles à l'écran vont dans `src/services/types/domain/`.
7. **Cache Components** : donnée par utilisateur = **aucun `'use cache'`**, streamée derrière un `<Suspense>`
   (`member-space-dal.ts` le dit en tête ; ADR 038). `cache()` de React seulement pour dédupliquer. Ni `logger` ni
   `new Date()` dans un scope caché.
8. **Où placer la route.** `/account/billing/*` est **retiré et répond 404** (s46 a supprimé les routes ; aucun fichier
   `*billing*` ne reste dans `src/app`, et `e2e/account-legacy-routes.spec.ts` épingle le 404 par le motif
   `account/(settings|…|billing)`) : ne pas réutiliser ce chemin, une route portant ce nom casserait cette spec.
   `AUTHENTICATED_SEGMENTS` (`src/lib/routing/authenticated-segments.ts`) ne contient que `/account`, `/admin`, `/bureau`,
   `/dashboard` : une route membre hors de ces segments ne serait **pas protégée par le proxy** ni exclue de `robots.txt`.
   Une carte « Mes factures » sur `/dashboard`, ou une sous-route `/dashboard/…`, hérite des deux protections.
9. **Isolation : test e2e obligatoire, pas unitaire.** `db.ts` refuse toute connexion en test unitaire et les repositories
   y sont mockés (`e2e/tenant-isolation.spec.ts`, deux tenants : `localhost` = TechCorp Solutions, `127.0.0.1` =
   Marketing Pro). La table porte `organization_id` + RLS forcée, comme `0027_…_rls.sql`.
10. **Rien en dur.** Les noms de statuts « impayé » ne sont pas des constantes du code : ce sont des valeurs de seed du premier
    tenant (ADR 010, `AGENTS.md`). L'intitulé exact des statuts de La Fourche n'est **pas connu** (Annexe A de V5 :
    « exemple de facturation Pennylane » à obtenir).
11. **Fichiers de migration** : jamais de SQL écrit à la main hors `drizzle-kit generate --custom` ; la RLS est un fichier
    « custom », comme 0025/0027/0036/0038. Les modèles doivent être ajoutés à `db.ts`.
12. **Tests de registre épinglés** : `src/services/types/domain/action-registry-types.test.ts` teste le registre par action ;
    `association-settings-test-registry.ts`, `tenant-settings-seed.test.ts` et `association-settings-dal.test.ts` utilisent
    `ASSOCIATION_SETTINGS_REGISTRY`. Toute nouvelle entrée doit y être couverte et les tests existants relus.
13. **Seed déterministe** : `src/db/scripts/seed.ts` (étape 15) doit recevoir des factures de test pour les deux tenants si
    l'e2e en dépend, via un module de seed dédié sur le modèle de `tenant-member-profiles-seed.ts`.
14. **Sauvegarde** : `src/db/file-key-inventory.test.ts` échoue sur toute colonne `_key` non déclarée. Une facture PDF (s20)
    n'est **pas** stockée par s19 ; si la table porte une clé de fichier plus tard, l'inventaire s'étend dans le même commit.
15. **Accès d'un ex-propriétaire** (V5 §5.1 : accès tant que redevable) : règle de s12d/compte, **pas de s19**. À ne pas
    câbler ici, et la rétention est « à valider RGPD » (CDCT §5.1 : ne pas coder).
16. **Imitation (s48)** : le compte vu est celui de l'utilisateur imité ; la lecture membre par `getAuthUser()` lui est
    cohérente. L'écriture bureau doit passer par le même helper de trace que les autres écrivains si elle enregistre un auteur
    (`docs/architecture.md`, « tout nouvel écrivain de trace passe par ce helper »).

## Open questions

À trancher au `/ks-plan`, ou à porter au `/ks-design` pour ce qui touche l'écran.

1. **Comment le tenant désigne-t-il les statuts « impayé » ?** Le registre de réglages n'a pas de type liste. Pistes à
   départager au plan : (a) un réglage `text` multiligne (statuts séparés), (b) un nouveau type de définition « liste de
   valeurs » dans le registre (touche `association-settings-types.ts`, le formulaire et leurs tests), (c) une table
   `invoice_status_class` par tenant (`status` → `impayé` / `classé`), dont les lignes **absentes** sont justement les
   « à classer » du critère 5. Je n'ai pas tranché : (c) donne naturellement l'état « à classer » et son signalement, (a)/(b)
   exigent de dériver « à classer » par comparaison à chaque lecture.
2. **Comment « à classer » est-il signalé au bureau ?** Le critère dit « signalé au bureau ». Il n'existe ni compteur dans
   `bureau-sidebar.tsx`, ni file d'alertes, et les envois d'email sont plafonnés (300/jour Brevo, budget en base, s26 pas encore livré).
   Un badge ou un encart dans l'écran de saisie est le seul signalement sans dépendance ; un email ne l'est pas. À décider.
3. **Quels statuts propose la saisie manuelle ?** Texte libre (risque de dérive typographique : « Payée » / « payee »,
   chacun « à classer »), liste proposée construite sur les statuts déjà vus, ou liste de seed du tenant ? Sans la réponse, le
   formulaire de s19 et le critère 5 ne se testent pas de bout en bout.
4. **Représentation du montant** : aucun précédent. Entier en centimes + devise, ou `numeric(12,2)` ? Une devise par facture
   ou une devise de tenant ? Le contrat doit rester **sans moyen de paiement** (ADR 011).
5. **Contenu exact du contrat `MemberBillingProvider`** (ADR 011) : « liste des factures d'un membre, statut remonté tel quel,
   téléchargement du PDF quand le fournisseur le permet ». Le PDF est s20 ; faut-il déjà un champ ou une méthode « PDF
   disponible ? » dans le contrat de s19, ou l'ajouter en s20 sans toucher la présentation (critère 9) ?
6. **La saisie manuelle est-elle une implémentation du contrat ou un module à part ?** ADR 011 : les deux implémentations
   `pennylane` et `manuel` ; mais « lecture seule » pour Pennylane contre écriture pour le manuel. Où vit l'**écriture** (mettre à
   jour une facture) dans une interface pensée pour la lecture ?
7. **Quel jeu de factures pour « l'objet » et la « date d'émission » ?** L'objet est-il un champ libre du bureau ? V5 §5.2 ne
   dit rien du libellé. Et la facture est-elle **consolidée par membre** (CDCT §5.1 : « une facture de cotisation et une
   facture d'eau », produites par Pennylane) — donc une ligne par facture, jamais par parcelle ?
8. **Clé de rapprochement avec Pennylane** : non tranchée (CDCT §5.1, V5 Annexe A) ; elle est **s20**, mais la forme du contrat
   ne doit pas la déduire (ADR 011). `member_profile.pennylane_customer_id` existe déjà côté fiche, sans usage en lecture.
9. **Seed de statuts pour La Fourche** : valeurs initiales de la configuration (« payée », « en attente », « en retard »…) à
   obtenir du client ; sans exemple de facturation Pennylane (Annexe A), les noms réels des statuts restent inconnus. À
   traiter comme **valeurs de seed**, jamais constantes.
10. **Route et navigation du membre** : carte sur `/dashboard` (déjà streamée) ou sous-page `/dashboard/factures` ? Pas de
    design `docs/designs/s19-*` encore ; le design tranchera la mise en page, y compris la bascule en cartes sous 640 px.
11. **Module activable ?** `organizationModuleEnum` ne contient que `vote`, `voirie`, `annonces` : la facturation n'en est pas
    un. À confirmer : s19 est-elle toujours active, la désactivation passant par le choix de fournisseur ?
