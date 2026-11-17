# Research — Story s19-factures-liste

Recherche du 9 novembre 2026, **mise à jour le 17 novembre 2026** sur `main` à `936c7209` (s55 mergée, PR 72),
branche `feature/s19-factures-liste` rebasée sur ce commit. `docs/reviews/stories.md` : `Stories ready: yes`.
Dépendances s02, s12, s12d, s53 : livrées. La version du 9/11 précédait s53 (un accès, plusieurs terrains),
s54 (plusieurs adresses par fiche), s55 (domicile/terrain), s52 (budget d'envoi en base) et l'amendement des
critères du 15/11 ; elle est remplacée ici. Ce qui y restait vrai est repris, revérifié dans le code.

## Target story

**Consulter ses factures** — complexité 3, story avec écran (pas encore de `docs/designs/s19-*`).
Un membre propriétaire voit la liste de ses factures et leur statut. La story livre **l'interface**
`MemberBillingProvider` et son **implémentation manuelle** (saisie par le bureau). Pennylane est s20 et ne doit
rien changer ici.

Critères d'acceptation (résumé fidèle, numérotés pour la suite) :

1. Le membre connecté voit ses factures (date, objet, montant, statut), date décroissante ; un propriétaire de
   plusieurs terrains (s53) voit celles de **tous ses terrains au même endroit**, chacune indiquant son terrain
   (**parcelle et compteur**).
2. Statut affiché **tel que fourni par la source**, intermédiaires compris, jamais réduit à payé/impayé.
3. **Date d'échéance** distincte de la date d'émission (elle datera les relances de s29). Chez La Fourche, la
   même pour tous.
4. **Objet** = texte standard composé par le site (nature et année), jamais le libellé brut de la source ; le texte
   est un **paramètre de tenant**, valeur de seed à valider avec le bureau.
5. La configuration du tenant désigne les statuts qui valent « impayé » ; le prédicat qui en découle est lisible et
   testable depuis cette story.
6. Statut jamais vu : **pas** réputé réglé ; signalé **par email au destinataire désigné en paramètre du tenant**
   (la présidente pour La Fourche) ; la facture reste hors de la cible des relances tant qu'il n'est pas classé.
   Pas d'écran de classement en V1 : classer = ranger le statut dans la configuration du tenant.
7. Aucune facture d'un autre membre, identifiant forgé compris (test d'autorisation croisée).
8. Facture rattachée au **membre facturé** (clé primaire), jamais à la parcelle. Test sur parcelle vendue : avant la
   vente visibles du vendeur seul, après la vente de l'acquéreur seul.
9. Le bureau (Bureau et Président(e), action déclarée au registre) saisit et met à jour une facture ; le membre la
   voit. Une facture porte sa **source** (site / Pennylane) : Pennylane = lecture seule, modification refusée **en
   interface et sur l'appel serveur direct**. Aucun historique des corrections en V1.
10. Le service est appelé derrière une interface : changer d'implémentation ne touche pas la présentation (test
    doublant l'implémentation).

Notes agentiques qui contraignent : statut **opaque** ; prédicat « impayé » = **dérivation** en configuration de
tenant, consommée par s21, s27, s29 qui ne réinterprètent jamais un statut ; comportement prudent sur statut inconnu ;
l'échéance est saisissable même si la source ne la fournit pas. Amendement du 15/11 : la liste réelle des statuts se
relève sur l'API en s20 — **aucune valeur n'est écrite dans le code ni dans la configuration livrée** ; libellés
« en mots simples » prévus comme table de libellés par statut en configuration, avec repli sur le brut (« à
confirmer quand la liste est connue ») ; une facture par terrain et par an ; la saisie manuelle devient un secours,
et son maintien une fois Pennylane actif est **à trancher en `/ks-design`**. Cimetière : aucun paiement, aucune
donnée bancaire, aucun appel de fonds, aucun tantième. Ne jamais confondre avec Stripe.

## Current state of the code

**Rien n'existe pour les factures.** `grep -rli 'invoice\|facture' src` ne trouve que Stripe (webhook,
`stripe-events.ts`, sans rapport), le commentaire Pennylane de `member-profile-model.ts` et `campaign-types.ts`
(mention de la cible « impayés » à venir, s27). Aucune colonne monétaire dans les modèles : **pas de précédent de
montant**.

Ce que s19 réutilise, tel qu'il est aujourd'hui :

- **Fiche membre** `member_profile` (`src/db/models/member-profile-model.ts`) : `id` uuid (seule identité),
  `organization_id`, `pennylane_customer_id` (attribut d'import s13, ADR 048, unique par association quand non nul).
  **Plus de colonne `user_id`** : le lien fiche ↔ compte est la table **`member_profile_account`**
  (`src/db/models/member-profile-account-model.ts`, s53/ADR 054, plusieurs comptes par fiche depuis s54/ADR 056).
  Une fiche existe sans compte.
- **Terrain = fiche** (s53, ADR 054) : une fiche par client Pennylane, donc par terrain ; un compte en voit plusieurs.
  « Mes terrains » : `getMyLandsService(organizationId)` (`src/services/member-space-service.ts:67`) lit les fiches
  du compte par `getMyMemberProfiles(organizationId, userId)` (`src/services/member-account-service.ts:416`, ordre
  `orderMyProfiles`, ADR 054 §7), puis pour chacune `getCurrentParcelsByMemberDao` / `getMemberFormerParcelsDao`
  (`MyLandDTO` : `name`, `current[{number, startsOn, meterNumber}]`, `former[…]`).
- **Parcelle et compteur** : `parcel.number` (texte) et `parcel.meter_number` (facultatif, s13) —
  `src/db/models/parcel-model.ts`. Propriété datée `parcel_ownership` `[starts_on, ends_on)`, aucune colonne
  « propriétaire actuel ».
- **Espace membre** : `src/app/[locale]/(app)/dashboard/page.tsx` rend `<MemberSpace>`
  (`src/components/features/member-space/member-space.tsx`) avec ses cartes (contact, emails, question, signalements).
  **Sous-routes existantes** : `dashboard/question` et `dashboard/signaler` — précédent d'une sous-page membre sous
  le segment protégé. Actions : `dashboard/actions.ts`, `email-actions.ts`.
- **Back-office** : fiche d'un propriétaire `src/app/[locale]/(bureau)/bureau/proprietaires/[id]/page.tsx`
  (+ `actions.ts`, sous-route `vente/`).
- **Réglages de tenant** : `ASSOCIATION_SETTINGS_REGISTRY` (`src/services/types/domain/association-settings-types.ts:272`),
  valeurs dans `organization_setting`. Types de définition : `email`, `number`, `boolean`, `choice`, `text`
  (`text` : `maxLength`, `multiline`, `format?` `'verification-code' | 'postal-code'`). Options transverses :
  `default` (valeur ou `{fromKey}` — `forage.responsable.email` se replie sur `contact.email`), `editableBy:
  'super_admin'` (s52), `page: 'settings' | 'identity'`. **Toujours aucun type « liste »**.
- **Registre d'actions** : `ActionIdConst` (`src/services/types/domain/action-registry-types.ts`), désormais
  **16 entrées**, dernière `QUESTION_MANAGE: 'question.manage'` (s23). Contrôle par `canPerformAction(user,
  organizationId, actionId)` (`src/services/authorization/action-registry-authorization.ts`), défaut fermé.
- **Envoi d'email au bureau** (s23, le précédent direct du critère 6) : `createMyQuestionService` →
  `notifyBoardOfNewQuestion` → `sendMemberQuestionNotificationEmailService` (`src/services/email-service.ts:1298`)
  → `sendEmailService(payload, context, options)` (`email-service.ts:404`). Le `context` est **obligatoire** (s52,
  ADR 053) : `{scope: 'tenant', organizationId, nature, reference: {type, id}}` ; `nature` ∈ `TENANT_EMAIL_NATURES`
  (`src/services/types/domain/email-send-types.ts:13` : `login`, `campaign`, `board_notification`,
  `member_email_confirmation`). L'envoi décompte le **budget quotidien en base** et se **reporte** au lendemain s'il
  est épuisé (file `deferred_email`). Un échec d'envoi **ne fait pas échouer** l'opération métier : témoin d'échec
  posé, erreur journalisée sans contenu personnel (`flagNotificationFailed`).
- **Coutures par fournisseur** (précédents de forme d'ADR 011) : `createStorage(type, config)`
  (`src/lib/files/storage/storage-factory.ts`) et `resolveEmailTransport(config)`
  (`src/lib/emails/transport/get-email-transport.ts`). Fonctionnels, sans classe à état.
- **Dernière migration** : `drizzle/migrations/0062_shocking_mathemanic.sql` ; la suivante sera `0063`.

## Anchor points

| Besoin                               | Où s'accroche s19                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table de factures                    | nouveau modèle `src/db/models/` + export dans `src/db/models/db.ts`                                                                                                   |
| Migration + RLS                      | `pnpm db:generate`, puis `drizzle-kit generate --custom` pour la RLS (patron `ENABLE` + `FORCE`, policy `tenant_isolation`, cf. migrations RLS existantes)              |
| Contrat `MemberBillingProvider`      | couche service (ADR 011) : contrat + implémentation `manuel` + double de test ; sélection par **réglage d'association**, jamais par variable d'environnement           |
| Prédicat « impayé »                  | module pur `src/services/rules/<…>-rules.ts` + `.test.ts` (précédents : `member-account-rules`, `parcel-ownership-rules`, `campaign-rules`)                           |
| Lecture membre multi-terrains        | à côté de `getMyLandsService` : fiches du compte par `getMyMemberProfiles`, factures par fiche, terrain par fiche → façade → `member-space-dal.ts` (sans `'use cache'`) |
| Écran membre                         | carte dans `MemberSpace` ou sous-page `dashboard/factures` (précédents `dashboard/question`, `dashboard/signaler`) — au design                                        |
| Saisie bureau                        | fiche `bureau/proprietaires/[id]` (ou sous-route, précédent `vente/`), Server Action dans `actions.ts`, nouvelle action au registre                                   |
| Objet composé, destinataire          | nouvelles entrées du registre de réglages (`text` pour l'objet, `email` pour le destinataire avec repli éventuel `{fromKey}`)                                          |
| Signalement statut inconnu           | `sendEmailService` contexte `tenant` ; nature `board_notification` existante ou nouvelle nature (la liste le prévoit : « s29 et s42 y ajoutent la leur »)              |
| Seed et e2e                          | `src/db/scripts/seed.ts`, `tenant-member-profiles-seed.ts` (deux tenants) ; e2e `tenant-isolation.spec.ts`, `member-profiles.spec.ts`, `member-accounts.spec.ts`       |

## Verified APIs / functions

Toutes ouvertes dans le code le 17/11, pas déduites des docs.

- `getMyMemberProfiles(organizationId, userId): Promise<MyMemberProfileRow[]>` — `src/services/member-account-service.ts:416`
  (sous `withTenant`, triées) ; `getFirstMemberProfile` — `:425`.
- `getMemberProfilesByUserIdDao(organizationId, userId)` — `src/db/repositories/member-profile-repository.ts:482`.
  **`getMemberProfileByUserIdDao` (singulier) n'existe plus** : la version du 9/11 la citait.
- `getMyLandsService(organizationId): Promise<MyLandsDTO | undefined>` — `member-space-service.ts:67` : **le patron**
  d'une lecture côté membre (`safeParse` → `getAuthUser()` → `AuthorizationError` sans session → `withTenant` →
  fiches du compte). `undefined` pour un compte sans fiche.
- `getMemberProfileByIdDao` — `member-profile-repository.ts:144` ; `getMemberProfileByPennylaneIdDao` — `:558` ;
  `getCurrentParcelNumbersByProfileDao` — `:575`.
- `getParcelOwnerAtService(organizationId, parcelId, date)` — `src/services/parcel-ownership-service.ts`, désigné par
  `docs/architecture.md:297` comme « point d'entrée de s18, s19, s28 et s32 ». Voir piège n° 1.
- `withTenant(organizationId, callback)` et `getDb()` — `src/db/tenant-scope.ts`.
- `sendEmailService(payload, context, options?)` — `src/services/email-service.ts:404` ; `options.recipientType`
  (`'client'` par défaut, `'system'` pour une notification au bureau, comme s23).
- `getAssociationSettingsService` — `src/services/association-settings-service.ts` (lecture des réglages, utilisée
  par s23 pour l'adresse de notification).
- `canPerformAction(user, organizationId, actionId)` — `action-registry-authorization.ts`.
- `createServiceInterceptor(methods, 'NOM', {shouldLogDetails})` — `src/services/facades/interceptors/create-service-interceptor.ts` ;
  l'espace membre passe `shouldLogDetails: () => false`.
- `requireCurrentTenantDal()` — `src/app/dal/tenant-dal.ts`.
- Design system (`docs/design-system.md`) : `Badge` = statut, jamais une action ; chiffres `font-mono tabular-nums` ;
  tableaux en cartes empilées sous 640 px ; date `02/09/2026` en tableau.

## Traps & constraints

1. **Rattachement au membre, et affichage du terrain.** Le critère 8 rattache la facture à `member_profile.id`.
   Comme terrain = fiche (s53), « son terrain » se lit **par la fiche**, pas par une FK `parcel → membre`.
   **Mais** une fiche peut avoir des parcelles anciennes et actuelles : afficher les parcelles **actuelles** de la
   fiche sur une facture ancienne serait faux après une vente. L'architecture désigne `getParcelOwnerAtService`
   comme point d'entrée de s19 : la lecture datée est le seul moyen correct de dire « quelle parcelle, à la date de
   la facture ». Voir Open questions n° 1. Le test du critère 8 se joue **en vrai** (deux fiches, une période close
   par la vente), pas sur un mock de la lecture.
2. **Statut = texte opaque**, colonne `text` sans `CHECK` de valeurs ; ni booléen ni énumération (ADR 011, story).
3. **Trois états, pas deux** : impayé / non impayé / **à classer**. Un statut absent de la configuration ne vaut
   jamais « réglé ». Le registre de réglages n'a pas de type liste.
4. **Le prédicat est une fonction pure, exportée, testée** ; s21, s27 et s29 l'importent.
5. **Aucune valeur de statut livrée** (amendement 15/11) : ni constante dans le code, ni valeur de seed « réelle »
   pour La Fourche. Les tests et le seed de démo peuvent porter des valeurs fictives, à condition qu'elles ne soient
   pas la configuration de production. À rapprocher de l'ADR 010 (seed du premier tenant).
6. **Lecture seule Pennylane côté serveur** (critère 9) : le refus doit être dans le **service**, pas seulement dans
   l'interface (un appel direct à la Server Action doit être refusé). Il n'y a pas encore d'implémentation Pennylane
   (s20) : le refus se teste sur une facture seedée avec `source = pennylane`.
7. **Envoi d'email** : passer par `sendEmailService` avec contexte `tenant` (budget, report) ; un échec ne fait pas
   échouer la saisie ; rien de nominatif dans les logs. **Quand** l'email part (à la saisie d'un statut inconnu ? une
   seule fois par statut ? à chaque facture ?) n'est pas dit : voir Open questions n° 3. Le plafond de 300/jour est
   partagé par tout le tenant : un signalement par facture en lot pourrait le consommer.
8. **Données personnelles dans les journaux** : intercepteur avec `shouldLogDetails: () => false`. Un service
   n'importe jamais sa façade.
9. **Cache Components** : donnée par utilisateur → aucun `'use cache'`, `<Suspense>` + stream ; `cache()` React pour
   dédupliquer seulement ; ni `logger` ni `new Date()` dans un scope caché.
10. **Route** : `/account/billing/*` est retiré et épinglé en 404 par `e2e/account-legacy-routes.spec.ts` — ne pas
    réutiliser. `AUTHENTICATED_SEGMENTS` (`src/lib/routing/authenticated-segments.ts`) couvre `/dashboard` et
    `/bureau` : rester sous ces segments.
11. **Isolation : e2e obligatoire** (la RLS n'est pas testable en unitaire, `db.ts` refuse la connexion en test).
    Table avec `organization_id` + RLS forcée. Les e2e tournent en CI, pas en local (mémoire projet).
12. **Migrations** : jamais de SQL à la main hors `drizzle-kit generate --custom` ; modèle ajouté à `db.ts`.
13. **Tests de registre épinglés** : `action-registry-types.test.ts`, `association-settings-test-registry.ts`,
    `tenant-settings-seed.test.ts`, `association-settings-dal.test.ts`, et le formulaire des réglages : toute
    nouvelle entrée y est couverte.
14. **Nature d'email** : en ajouter une touche `TENANT_EMAIL_NATURES` et `PendingSendNature` (report) ; réutiliser
    `board_notification` n'en touche aucun.
15. **Sauvegarde** : `src/db/file-key-inventory.test.ts` échoue sur toute colonne `_key` non déclarée. s19 ne
    stocke pas de PDF (s20).
16. **Imitation (s48)** : la lecture membre par `getAuthUser()` voit le compte imité, cohérent ; tout auteur
    enregistré passe par le helper de trace existant.
17. **Documentation périmée** : `docs/architecture.md:446` dit encore Pennylane « **Bloque s20** » alors que la story
    a été levée le 15/11. Hors périmètre de s19 de le corriger, mais à ne pas prendre pour l'état réel.

## Open questions

À trancher au `/ks-plan`, ou au `/ks-design` pour ce qui touche l'écran.

1. **Comment une facture désigne-t-elle son terrain (parcelle et compteur) ?** (a) Par la fiche seule, en affichant
   ses parcelles **à la date d'émission** via la lecture datée ; (b) une colonne descriptive `parcel_id` sur la
   facture (le terrain facturé), contrôlée à la saisie par `getParcelOwnerAtService` (propriétaire à la date =
   membre facturé), qui n'est **pas** la clé de rattachement ; (c) parcelles actuelles de la fiche (faux après une
   vente). (b) reflète « une facture par terrain » et suit l'architecture ; il faut vérifier qu'elle ne réintroduit
   pas la FK interdite (elle n'est pas `parcel → membre_courant`).
2. **Classement des statuts** : réglage `text` multiligne, nouveau type « liste » au registre, ou table par tenant
   (`statut → impayé / non impayé`, absence = « à classer ») portant aussi le **libellé affiché** (amendement 15/11).
3. **Déclenchement du signalement email** : une fois par statut inconnu et par tenant (mémorisé), ou à chaque facture
   portant un statut inconnu ? Destinataire : nouveau réglage `email` avec repli `{fromKey: contact.email}`, ou
   réglage obligatoire ?
4. **Statuts proposés à la saisie manuelle** : liste issue de la configuration, texte libre (dérive typographique =
   « à classer »), ou les deux ?
5. **Montant** : entier en centimes + devise de tenant, ou `numeric(12,2)` ? Aucun précédent.
6. **Objet composé** : quelle « nature » (cotisation + eau regroupées, une facture par terrain et par an) — une
   nature unique par tenant (« Cotisation et eau {année} ») ou une nature par facture choisie dans une liste ?
   L'année : celle de l'émission ou une année d'exercice saisie ?
7. **Écriture dans le contrat** : `MemberBillingProvider` est pensé pour la lecture (ADR 011) ; la saisie manuelle
   vit-elle dans l'implémentation `manuel` ou dans un service à part ?
8. **PDF dans le contrat** : le prévoir dès s19 (champ « PDF disponible ») ou l'ajouter en s20 sans toucher la
   présentation (critère 10) ?
9. **Saisie manuelle une fois Pennylane actif** (laissé au `/ks-design` par la story) : toujours proposée pour de
   nouvelles factures, ou masquée (s20 critère 1 : « remplace la saisie manuelle ») ?
10. **Route membre** : carte sur `/dashboard` ou sous-page `dashboard/factures` — au design.
11. **Module activable ?** `organizationModuleEnum` (`vote`, `voirie`, `annonces`) n'inclut pas la facturation ;
    toujours active, la variation passant par le choix de fournisseur ?
