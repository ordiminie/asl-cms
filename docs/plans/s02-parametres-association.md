---
validated: yes
---

# Plan — Story s02-parametres-association

Branch: `feature/s02-parametres-association`

Sources : `docs/stories.md` §s02 (critères 1 et 4 reformulés, PR 11 et 12), `docs/research/s02-parametres-association.md`,
`docs/designs/s02-parametres-association.md` (+ `.html`, canevas validé version 3), `docs/design-system.md`,
ADR 002, 003, 008, 010, 014, 015 et **ADR 016** (`docs/decisions/016-registre-des-parametres-en-code.md`, écrit
pour ce plan).

## Target story

**En tant que** membre du bureau d'une association **je veux** modifier ses réglages **afin de** ne dépendre du
prestataire pour aucune adresse ni aucun seuil. Complexité 3. Dépend de s01 et s01b.

Critères d'acceptation :

1. Le bureau modifie les paramètres déclarés au registre depuis le back-office de l'association, chaque valeur étant validée selon le type déclaré au registre. En s02, le registre déclare l'adresse de contact et l'adresse du responsable forage (définies par `CDCT §4.6`, lues par s08 et s10), modifiées dans la page de réglages de l'association, et la teinte d'accent, choisie dans la page « Identité » avec le logo et le favicon (arbitrage du 19 septembre 2026).
2. La validation du registre est prouvée pour chaque type qu'il sait porter — adresse email, nombre, booléen, choix dans une liste fermée — : une valeur conforme est acceptée, une valeur non conforme est refusée avec un message explicite. Déclarer une clé d'un type existant ne demande aucune modification de la page — vérifié par une clé de test déclarée au registre de test.
3. Modifier un paramètre puis le relire renvoie la nouvelle valeur, sans redéploiement ni redémarrage.
4. Un paramètre jamais renseigné se lit à sa valeur par défaut déclarée au registre ; le renseigner puis le vider le ramène à cette même valeur par défaut. L'adresse du responsable forage a pour valeur par défaut **l'adresse de contact de l'association** (arbitrage du 19 septembre 2026).
5. L'adresse de contact est **obligatoire** : elle est saisie à la création de l'association (formulaire de provisioning de s01, qui refuse une création sans elle) et ne peut pas être vidée — une tentative est refusée avec un message explicite, l'adresse précédente restant en vigueur.
6. Le seed d'un tenant charge les valeurs déclarées dans son jeu de paramètres : après exécution, chaque clé déclarée se lit à sa valeur déclarée — vérifié sur un tenant de test, sans dépendre des données d'un client.
7. Seuls les membres du bureau de l'association du domaine appelé — Bureau et Président(e) — et le SuperAdmin modifient les paramètres : tout autre utilisateur authentifié reçoit un refus, côté interface et côté serveur.
8. Le bureau choisit la **teinte d'accent** de son association **dans la liste des six teintes validées**, jamais au sélecteur libre ; la couleur retenue s'applique au site public après rechargement.
9. Deux associations aux teintes différentes servent bien deux teintes distinctes — vérifié sur les deux domaines (test d'isolation visuelle).
10. Une association qui n'a pas choisi de teinte reçoit la teinte par défaut. Aucun écran cassé faute de personnalisation.

_(Numérotation de ce plan : l'ordre de `docs/stories.md`, le critère « adresse de contact obligatoire » étant le 5.)_

### Décisions déjà prises (à respecter, pas à rediscuter)

- La teinte se choisit dans **« Identité »**, les adresses dans **« Réglages »** (PR 11).
- **L'adresse de contact est l'adresse par défaut** : obligatoire, saisie au provisioning, jamais vidée ; le forage
  vide renvoie vers elle (PR 12).
- Accès : Bureau (`admin` d'association), Président(e) (`owner`) du domaine appelé, `super_admin` ; **pas**
  l'`admin` global (s01b, revue du découpage I-02).
- Monogramme = logotype, dispensé de l'exigence de contraste (2026-09-19).
- Écrans, libellés et états : ceux du design validé (`docs/designs/s02-parametres-association.md`).

### Décisions prises à ce plan (à confirmer à la validation)

- **ADR 016** — registre typé dans le code (type, obligatoire, défaut constant **ou référence à une autre clé**,
  libellés i18n, page d'affichage) ; table `organization_setting` réduite à `organization_id`, `key`, `value`,
  `updated_at`, `updated_by`. **Absence de ligne = défaut** : vider un paramètre facultatif supprime sa ligne.
- **Clés** : `contact.email` (email, obligatoire, sans défaut), `forage.responsable.email` (email, facultatif,
  défaut → `contact.email`), `identity.accent_hue` (choix parmi 195, 150, 255, 40, 300, 95 ; défaut 195).
- **Accès** : `canManageAssociationIdentity` devient **`canManageAssociation`** (même règle), dans
  `association-authorization.ts`, utilisé par l'identité **et** les réglages — un seul point d'accroche pour s03.
- **Lecture** : le service de lecture des paramètres est **sans contrôle d'autorisation**, comme
  `readAssociationIdentityFileService` : la teinte sert le site public, et s08/s10 liront les adresses côté
  serveur sans session. Il n'est appelé que par le DAL et des chemins serveur ; les adresses ne sont affichées
  que dans la page « Réglages », elle-même gardée.
- **Cache** : `getAssociationSettingsDal(organizationId)` en `'use cache'`, `cacheLife('hours')`,
  `cacheTag('association-settings:' + organizationId)` (identifiant, jamais de donnée personnelle dans le tag) ;
  invalidation par `updateTag` dans les actions. Même patron que `getTenantByDomainDal`, **y compris** l'appel de
  façade dans le scope caché (minor 4 de la revue de s01, toujours ouvert) : aucun `logger` ajouté dans la
  fonction cachée.
- **Couleur du favicon par défaut** : le SVG porte `fill="oklch(0.55 0.1 <teinte>)"`, formule du token
  `accent-solid` ; plus de valeur hexadécimale dans le code (`DEFAULT_MONOGRAM_ACCENT_HEX` supprimé). Tranche la
  question 7 de la recherche sans dépendre du tableau hexadécimal de §1.2.
- **Survol des boutons** (manque n° 2 du design) : variantes `outline` et `ghost` de `button.tsx` passées de
  `hover:bg-accent` à `hover:bg-secondary` / `hover:text-secondary-foreground`, conformément à §1.2 — la teinte
  devenant variable, le défaut deviendrait visible dans cette story même.

### Taille de la story

Le plan compte **10 tâches**, au seuil où `/ks-plan` recommande de scinder. Proposition : **ne pas scinder**. Les
tâches sont bornées, l'espace bureau, le contrôle d'accès, le patron RLS et le stockage existent déjà (s01, s01b),
et la teinte partage le registre, le service et le cache des adresses : une s02b « teinte » dupliquerait ces
fondations ou dépendrait d'une s02 sans preuve visible. Le surplus vient de l'arbitrage « adresse de contact
obligatoire » (tâche 4). **Si tu préfères scinder**, la coupe naturelle est : s02 = tâches 1-5, 7, 8, 10 (adresses)
et s02b = tâches 6, 9 et la partie teinte de 10.

## Tasks (ordered)

1. [x] **Table `organization_setting` sous RLS forcée.** Modèle `src/db/models/organization-setting-model.ts`
       (`organization_id` uuid FK `organization` en cascade, `key` text, `value` text non nul, `updated_at`,
       `updated_by` FK `user` en `set null` ; clé primaire `(organization_id, key)`), exporté dans le schéma.
       Migration **générée** (`pnpm db:generate`), puis migration **custom** de policy
       (`drizzle-kit generate --custom`, patron `0004` : `ENABLE`, `FORCE`, policy `tenant_isolation`). Repository
       `src/db/repositories/organization-setting-repository.ts`, **`getDb()` uniquement** :
       `getOrganizationSettingsDao(organizationId)`, `upsertOrganizationSettingsDao(rows)`,
       `deleteOrganizationSettingsDao(organizationId, keys)`. **Vérification** : `pnpm db:generate` ne produit plus
       de diff, `pnpm db:migrate` passe sur une base locale, `pnpm db:check` vert (privilèges d'`asl_app` sur la
       nouvelle table). `docs/architecture.md` : table classée « scopée par une policy RLS forcée », décomptes
       mis à jour (21 tables, 2 scopées).
2. [x] **Registre typé et règles pures.** `src/services/types/domain/association-settings-types.ts` : types de
       définition (`email`, `number` avec bornes et unité, `boolean`, `choice` avec options), obligatoire, défaut
       constant ou `{fromKey}`, clés i18n, page (`settings` | `identity`) ; registre de production (trois clés
       ci-dessus) ; `ACCENT_HUES` (six teintes et leurs noms, défaut 195) ; fonctions pures
       `parseSettingValue(definition, raw)`, `resolveSettings(registry, rows)` (défauts, références, clé inconnue
       ignorée, valeur stockée invalide lue comme absente), `validateSettingsChanges(registry, changes)`
       (tout-ou-rien, obligatoire vidé refusé, facultatif vidé → suppression). **Tests unitaires** sur le registre
       de production **et un registre de test** portant une clé de chaque type : accepté / refusé par type avec
       message, défaut constant, défaut par référence (`forage` vide → `contact`), obligatoire vidé refusé,
       teinte hors liste lue 195, registre sans cycle de références.
3. [x] **Service, autorisation et façade.** `canManageAssociation(user, organizationId)` dans
       `src/services/authorization/association-authorization.ts` (règle de s01b déplacée ; identité et tests de
       s01b rebranchés). `src/services/association-settings-service.ts` : `getAssociationSettingsService(organizationId)`
       (sans autorisation, documenté) et `updateAssociationSettingsService(organizationId, changes)` — `safeParse`
       → `canManageAssociation` → validation du registre → `withTenant(organizationId, …)` → upsert et suppressions
       en une transaction (`…TxnDao`) ; retourne `saved` ou `rejected` avec les erreurs par clé. Façade + intercepteur
       (patron `association-identity-service-facade.ts`). **Tests** (patron `rule-services-tests.md`, DAO mockés) :
       Présidente, Bureau et SuperAdmin acceptés ; membre, bureau d'une autre association, `admin` global, anonyme
       refusés **sans aucun appel DAO** ; valeur invalide → rien écrit ; contact vidé refusé ; forage vidé → ligne
       supprimée ; lecture résolue.
4. [x] **Adresse de contact au provisioning (s01).** `contactEmail` obligatoire dans
       `provisionOrganizationServiceSchema` et `createProvisionOrganizationFormSchema` ; `provisionOrganizationService`
       écrit `contact.email` dans `withTenant(organization.id, …)` après la création de l'organisation ; champ
       « Adresse de contact de l'association » dans la carte « L'association » de `provision-organization-form.tsx`
       (planche D), transmis par l'action `admin/organizations/actions.ts` ; libellés `messages/{fr,en,es}.json`.
       **Tests** : `organization-provisioning-service.test.ts` (paramètre écrit sous le scope du nouveau tenant,
       création refusée sans adresse ou avec une adresse invalide) ; `actions.test.ts` du provisioning.
5. [x] **Lecture cachée et invalidation.** `src/app/dal/association-settings-dal.ts` : `getAssociationSettingsDal`
       (voir décisions), `getCurrentAssociationSettingsDal()` (tenant du domaine appelé), tag exporté
       `associationSettingsTag(organizationId)`. **Tests** (`*-dal.test.ts`, patron `tenant-dal.test.ts`) : valeurs
       résolues, tag par association, deux organisations → deux lectures distinctes.
6. [x] **Teinte appliquée partout.** `[locale]/layout.tsx` lit la teinte du tenant résolu et la passe à `BaseLayout`,
       qui pose `style={{'--accent-hue': hue}}` sur `<html>` (repli 195 si absente ou hors liste) ;
       `renderAssociationMonogramSvg(name, hue)` et la route `/api/identity/[kind]` utilisent la teinte de
       l'association (`oklch`), `DEFAULT_MONOGRAM_ACCENT_HEX` supprimé ; survol `outline`/`ghost` de `button.tsx`
       sur `secondary`. **Tests** : `BaseLayout` porte la teinte reçue et 195 par défaut ; monogramme SVG dans la
       teinte donnée ; route : deux tenants, deux teintes de favicon par défaut ; `button` sans `bg-accent` au survol.
7. [x] **Actions du bureau.** `bureau/reglages/actions.ts` (`updateAssociationSettingsAction`, clés de la page
       `settings`) et, dans `bureau/identite/actions.ts`, `updateAssociationAccentHueAction` : tenant du domaine
       appelé, `requireActionAuth()`, façade, `updateTag(associationSettingsTag(id))` seulement en cas de succès,
       messages `getTranslations`, erreurs rendues comme résultat (jamais levées). **Tests** : refus côté serveur
       pour un non-bureau, erreurs par champ, `updateTag` appelé au seul succès, clé d'une autre page ignorée.
8. [x] **Page « Réglages » générée par le registre.** `bureau/reglages/page.tsx` (contrôle d'accès répété,
       comme `identite`), `AssociationSettingsForm` client rendant chaque définition de la page `settings` selon
       son type (planche C : `input` email, `input` numérique + unité, `checkbox`, `radio-group` ≤ 3 options,
       `select` au-delà), « facultatif » écrit en clair, validation au _blur_ puis à l'envoi, résumé d'erreurs avec
       ancres, `alert` ancrée pour erreur et succès, bouton `default` à largeur conservée. `BureauSidebar` : item
       « Réglages » et **item actif selon la route** (fini le `isActive` codé en dur). Libellés i18n.
       **Tests de composant** : le formulaire rend **une clé du registre de test de chaque type sans modification
       du composant** (critère 2) ; états vide-forage, erreur de saisie, contact vidé, succès ; sidebar active sur la
       bonne page.
9. [x] **Carte « Teinte » de la page « Identité ».** `AssociationAccentHueCard` : `radio-group` des six teintes
       (pastille de **sa** teinte + nom, « par défaut » sur Eau), aperçu qui suit la sélection avant enregistrement
       (`AssociationMark`, filet, encart), ligne d'état `aria-live`, bouton « Enregistrer la teinte », états du
       design ; ajoutée après les cartes Logo et Favicon ; intro de la page mise à jour. **Tests de composant** :
       état vide (Eau), sélection non enregistrée, erreur (ancienne teinte conservée), succès ; chaque pastille
       porte sa propre teinte ; aucun sélecteur libre.
10. [x] **Seed, preuve de bout en bout, documentation.** Seed : jeu de paramètres des tenants de test
        (`localhost` et `127.0.0.1` : `contact.email` fictif propre à chacun, teintes différentes), sous
        `app.bypass_rls`, aucune donnée de client. Spec `e2e/association-settings.spec.ts` : lecture du seed
        (critère 6) ; la Présidente modifie les adresses puis les relit (3) ; adresse invalide refusée (2) ; contact
        vidé refusé, ancienne adresse conservée (5) ; forage vidé → la page affiche le renvoi vers le contact (4) ;
        membre et `admin` global refusés à l'écran **et** par appel direct de l'action (7) ; teinte choisie → le site
        public porte la nouvelle `--accent-hue` après rechargement (8) ; deux domaines, deux teintes, et aucun
        paramètre de l'un visible depuis l'autre (9, isolation RLS) ; association sans teinte → 195 (10) ;
        provisioning refusé sans adresse de contact (5). Documentation : `docs/design-system.md` (sélecteur de
        teintes sorti des manques de §9, règle « type de réglage → composant », survol des boutons),
        `docs/architecture.md` (lien ADR 016). **Vérification finale** : `pnpm lint`, `pnpm check:rules`,
        `pnpm test --run` verts ; e2e vert en CI sur la PR (pas de Chromium dans le conteneur).

## Files touched

**Créés**

- `src/db/models/organization-setting-model.ts`, `src/db/repositories/organization-setting-repository.ts`
- `drizzle/migrations/0006_*.sql` (générée), `drizzle/migrations/0007_*.sql` (custom, policy) + snapshots/journal
  générés
- `src/services/types/domain/association-settings-types.ts` (+ test)
- `src/services/association-settings-service.ts`, `src/services/facades/association-settings-service-facade.ts`,
  `src/services/facades/interceptors/association-settings-service-logger-interceptor.ts` (+ tests)
- `src/services/authorization/association-authorization.ts` (+ test, remplace le module d'identité)
- `src/app/dal/association-settings-dal.ts` (+ test)
- `src/app/[locale]/(bureau)/bureau/reglages/page.tsx`, `…/actions.ts` (+ test)
- `src/components/features/association/association-settings-form.tsx`,
  `association-accent-hue-card.tsx` (+ tests)
- `e2e/association-settings.spec.ts`
- `docs/decisions/016-registre-des-parametres-en-code.md` (déjà écrit)

**Modifiés**

- `src/db/models/` (export du schéma), `src/db/scripts/seed.ts`
- `src/services/organization-service.ts`, `src/services/validation/organization-validation.ts`,
  `src/components/features/admin/organizations/provision-organization-form*.ts(x)`,
  `src/app/[locale]/admin/organizations/actions.ts` (+ tests existants)
- `src/services/association-identity-service.ts`, `src/services/authorization/association-identity-authorization.ts`
  (supprimé ou réduit) et ses tests, `src/app/dal/association-identity-dal.ts`
- `src/app/[locale]/layout.tsx`, `src/app/[locale]/base-layout.tsx`
- `src/lib/helper/association-monogram-svg.ts`, `src/app/api/identity/[kind]/route.ts` (+ tests)
- `src/app/[locale]/(bureau)/bureau/identite/page.tsx`, `…/actions.ts` (+ test)
- `src/components/features/association/bureau-sidebar.tsx`, `src/components/ui/button.tsx`
- `messages/fr.json`, `messages/en.json`, `messages/es.json`
- `docs/architecture.md`, `docs/design-system.md`
- `docs/plans/s02-parametres-association.md` (cases cochées au fil de l'eau)

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : règles du registre (tâche 2) sur deux registres, service par rôle
  (tâche 3, DAO mockés, aucun appel DAO sur refus), provisioning (tâche 4), DAL (5), rendu de la teinte et du
  favicon (6), actions (7), composants (8, 9) — dont la preuve du critère 2 : une clé de test de chaque type rendue
  par le formulaire sans le modifier.
- **Base** : la RLS n'est pas testable en unitaire (`db.ts` refuse la base). `pnpm db:check` après migration
  (tâche 1) ; l'isolation se prouve en **e2e** (tâche 10).
- **Bout en bout (Playwright, CI)** : `e2e/association-settings.spec.ts` sur `localhost` / `127.0.0.1`, comptes
  du seed (`user-owner`, `user-admin`, `user`, `admin`, `superadmin`) ; aucune adresse de client dans les tests.
- **Non-régression** : `e2e/association-identity.spec.ts` et `e2e/tenant-isolation.spec.ts` restent verts ; tests
  de s01b rebranchés sur `canManageAssociation`.

## Definition of Done

- Les 10 critères couverts : 1, 2, 4 en unitaire et e2e ; 3, 5, 6, 7, 8, 9, 10 en e2e (5 et 7 aussi en unitaire).
- `organization_setting` sous RLS forcée, classée dans `docs/architecture.md` ; aucune nouvelle occurrence de
  `withRlsBypass()` hors du seed.
- **Aucune valeur propre à une association dans le code** : le registre ne porte que des défauts neutres
  (teinte 195, référence `forage` → `contact`) ; plus aucune couleur hexadécimale pour la teinte.
- Écrans conformes au design validé, ordinateur et mobile ; aucun composant hors design system ; rien d'important
  dans un toast.
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` verts ; e2e vert en CI.
- **Un commit** de story (recherche, design, ADR 016, plan compris), plus un commit séparé autorisé pour les
  migrations ; revue `/ks-review` avec `Ship allowed: yes` avant `/ks-ship`.
