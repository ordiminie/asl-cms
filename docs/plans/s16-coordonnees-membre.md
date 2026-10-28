---
validated: yes
---

# Plan — Story s16-coordonnees-membre

Branch: `feature/s16-coordonnees-membre`

Sources : `docs/research/s16-coordonnees-membre.md` (23/10, sur `e7227836`, vérifiée de nouveau le
28/10 sur `f63eb200` après s14 : les symboles cités n'ont pas bougé), design
`docs/designs/s16-coordonnees-membre.md` (+ `.html`, validé le 28/10), ADR 040 (écrit avec ce
plan).

## Target story

**En tant que** membre propriétaire **je veux** corriger mes informations de contact **afin que** le
bureau puisse me joindre correctement. Complexité 1. Dépendances : s12 et s12d, toutes deux livrées.

Critères d'acceptation, **amendés par l'arbitrage du 23/10/2026** (ADR 040) :

1. Un membre connecté modifie ses coordonnées (adresse postale, téléphone) et voit la valeur
   enregistrée après rechargement. Son adresse email est affichée, pas modifiable : pour la changer,
   il écrit au bureau.
2. Une saisie invalide affiche les erreurs par champ et n'enregistre rien.
3. Un membre ne peut modifier que ses propres coordonnées. Aucun identifiant de fiche n'est visible
   ni transmis par l'écran. Un identifiant glissé dans la requête est ignoré, et les autres
   associations de la personne ne sont pas touchées.
4. Le bureau voit les coordonnées à jour dans la fiche du membre.

## Décisions de plan (questions techniques 5 à 9 de la recherche)

- **D1 — Autorisation (Q5)** : aucune action ajoutée au registre. La propriété est garantie par la
  résolution « session + domaine appelé », comme `getMyParcelsService` : `getAuthUser()` puis
  `withTenant(org)` puis la fiche `(organization_id, user_id)`. Une donnée propre n'a pas de rôle à
  paramétrer (s37). Le SuperAdmin sans fiche obtient `not_found` ; il agit à la place d'un membre via
  s48.
- **D2 — Où vit le service (Q6)** : dans `src/services/member-space-service.ts`, derrière la façade
  et l'intercepteur existants, qui n'écrivent pas de détails dans les journaux. Le service du bureau
  `updateMemberProfileContactService` n'est **pas** réutilisé (double garde `member.profile.manage`,
  id venu du navigateur, logique de compte). La logique de compte n'est pas dupliquée : elle est
  sans objet puisque l'email n'est pas écrit (ADR 040).
- **D3 — Écriture par construction sans email** : un nouveau DAO
  `updateMyMemberProfileContactDao(organizationId, userId, contact)` fait un seul `UPDATE … WHERE
  organization_id = ? AND user_id = ?`. Son type `MemberPostalContactWrite` (phone, addressLine,
  addressComplement, postalCode, city) n'a pas de champ `email`. Il rend la ligne, ou `undefined`.
  Pas de point de sauvegarde : aucun index unique n'est concerné.
- **D4 — Champs (Q7)** : la carte compose les `MemberTextField` existants (cinq champs, sans
  `MemberContactFields` qui porte l'email et l'encart « courrier uniquement »). Les libellés et les
  messages lus sous `BureauMemberProfilesPage` sont neutres (« Téléphone », « Facultatif », « Un
  code postal compte 5 chiffres. ») : ils sont repris tels quels, sans paramétrer le namespace, et
  aucun test du bureau ne bouge. Côté membre, on passe `optional` sur les cinq champs et
  l'autocomplete du design (`tel`, `address-line1`, `address-line2`, `postal-code`,
  `address-level2`). La disposition code postal / commune reprend celle du bureau
  (`sm:grid-cols-[10rem_1fr]`) : la maquette n'est qu'une référence.
- **D5 — Schémas (Q8)** : côté client, `createMemberPostalContactFormSchema(t)` =
  `createMemberContactFormSchema(t).omit({email: true})` et `MEMBER_POSTAL_CONTACT_FORM_FIELDS`
  (sans `email`), dans `member-profile-form-validation.ts`. Côté serveur,
  `updateMyContactServiceSchema = z.object({organizationId, ...postalContactShape})`, où
  `postalContactShape` est extrait de `contactShape` (qui devient `{email, ...postalContactShape}`).
  Les clés inconnues (`email`, `memberProfileId`) sont retirées par Zod.
- **D6 — Revalidation (Q9)** : `revalidatePath('/[locale]/(app)/dashboard', 'page')` après un
  succès. La carte affiche aussitôt les valeurs rendues par l'action. Les DAL du bureau sont
  dynamiques : le critère 4 tient sans rien revalider de son côté.
- **D7 — Lecture séparée** : `getMyContactService` / `getMyContactDal` rendent `MyContactDTO`
  (`email`, `phone`, `addressLine`, `addressComplement`, `postalCode`, `city`, chacun
  `string | null` ; ni `id`, ni nom, ni compte). `MyParcelsDTO` ne change pas. La page passe les
  deux promesses ; « la fiche existe » se lit sur `contact !== undefined`.

## Tasks (ordered)

1. [x] **Documents de cadrage de la story** : amender les critères 1 et 3 de s16 dans
       `docs/stories.md` (texte ci-dessus, avec renvoi à l'ADR 040). Fermer le manque du
       design system §9 (`docs/design-system.md:1138`, « via le bureau, ADR 040 »). Réécrire le
       commentaire de `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL` (`src/env-schemas.ts:153-157` : fermé
       définitivement, ADR 040) et le titre du test `src/env-schemas.test.ts:149` (« fermé par
       défaut : … avant s16 »). Vérification : `pnpm check:rules` et le test d'env verts.
2. [x] **Persistance** : `MemberPostalContactWrite` et `updateMyMemberProfileContactDao` dans
       `src/db/repositories/member-profile-repository.ts` (D3), avec `getDb()`. Pas de test
       unitaire : la RLS et le SQL réel sont couverts par l'e2e (tâche 9). Le DAO est mocké dans
       les tests de service.
3. [x] **Validation + types** (TDD) : `postalContactShape` et `updateMyContactServiceSchema` (D5,
       serveur) ; `MyContactDTO`, `UpdateMyContactResult = {status: 'saved'; contact: MyContactDTO} |
       {status: 'not_found'}` dans `member-space-types.ts`. Tests : le vide ou les espaces donnent
       `null` ; code postal à 4 chiffres et téléphone avec des lettres refusés ; `email` et
       `memberProfileId` absents de la sortie.
4. [x] **Service** (TDD, autorisation testée d'abord) : `getMyContactService(organizationId)` et
       `updateMyContactService(input)` dans `member-space-service.ts`, exposés par
       `member-space-service-facade.ts`. Ordre : Zod, puis `getAuthUser()` (sinon
       `AuthorizationError`), puis `withTenant`, puis le DAO avec `authUser.id`. Tests
       (`src/services/__tests__/member-space-service.test.ts`, créé ou complété) :
       - sans session → `AuthorizationError`, et aucun DAO appelé ;
       - le DAO reçoit `(organizationId, authUser.id, …)` même quand l'entrée contient un
         `memberProfileId` ou un `email` d'un autre membre ;
       - le DAO n'est jamais appelé avec une clé `email` ;
       - pas de fiche → `not_found` (écriture) ou `undefined` (lecture) ;
       - le DTO rendu n'a ni `id` ni `userId` ;
       - `withTenant` est appelé avec l'association donnée.
5. [x] **DAL + Server Action** (TDD) : `getMyContactDal` dans `src/app/dal/member-space-dal.ts`
       (`cache()`, sans `'use cache'`). Créer `src/app/[locale]/(app)/dashboard/actions.ts` :
       `updateMyContactAction(_prev, formData): Promise<MyContactActionResult>`. Ordre :
       `requireCurrentTenantDal`, `getTranslations('BureauMemberProfilesPage')` pour les messages de
       validation, `requireActionAuth`, puis `createMemberPostalContactFormSchema(t).safeParse` sur
       les seuls champs postaux. Le patron `readFields` / `toFieldErrors` du bureau est repris
       localement. Résultats : `saved{contact}`, `invalid{errors}`, ou `error` avec le message
       technique, aussi pour `not_found` ; puis `revalidatePath` (D6). Le type
       `MyContactActionResult` et `createMemberPostalContactFormSchema` vont dans
       `member-profile-form-validation.ts`. Tests (`actions.test.ts`) :
       - saisie invalide → `invalid` par champ, service non appelé ;
       - `memberProfileId` et `email` présents dans le `FormData` → absents de l'appel au service ;
       - erreur du service → `error`, sans détail technique ;
       - succès → `revalidatePath` appelé.
6. [x] **Libellés** : `MemberSpacePage.contact.*` dans `messages/fr.json`, avec les textes exacts du
       design : titre, « Adresse email », mention + « Page Contact », « Téléphone », « Adresse
       postale », « Non renseigné » / « Non renseignée », « Modifier mes coordonnées »,
       « Enregistrer mes coordonnées », « Enregistrement… », « Annuler », résumé d'erreurs, échec
       technique (titre + détail), confirmation (titre + détail). Puis
       `MemberSpacePage.security.description` = « Votre mot de passe et les appareils connectés à
       votre compte. ». Couvert par les tests des tâches 7 et 8.
7. [x] **Carte « Mes coordonnées »** (TDD, composant client) :
       `src/components/features/member-space/my-contact-card.tsx`, props `contact: MyContactDTO`
       et `action`. Elle suit l'écran C du design : lecture, puis modification en place (RHF +
       `zodResolver(createMemberPostalContactFormSchema(t))`, `mode: 'onBlur'` comme `ContactForm`),
       email toujours en texte. Elle compose `card`, `alert` et `button` du design system. Le
       résumé d'erreurs `destructive` (lien par champ, libellé du champ) reçoit le focus après un
       échec ; l'alerte `role="status"` le reçoit après un succès. Bouton « Enregistrement… »
       désactivé, largeur conservée. Tests (`my-contact-card.test.tsx`, jsdom) :
       - C1 : valeurs affichées ;
       - C2 : « Non renseigné » / « Non renseignée » ;
       - aucun champ email, et l'adresse affichée en texte ;
       - C4 : erreurs client par champ, action non appelée ;
       - erreurs rendues par le serveur posées sur les champs ;
       - C5 : retour en lecture avec les nouvelles valeurs, alerte de confirmation focalisée ;
       - C6 : la carte reste en modification, saisies conservées ;
       - « Annuler » rend les valeurs d'origine ;
       - aucun `memberProfileId` dans le `FormData` envoyé.
8. [x] **Espace membre** (TDD) : `MemberSpace` reçoit `contactPromise`. Avec des parcelles : marqueur,
       salutation, « Mes parcelles », « Mes coordonnées », « Sécurité du compte » (C1). Fiche sans
       parcelle (C7) : `h1` « Votre espace membre », « Mes coordonnées », « Sécurité du compte ».
       Sans fiche : page de s46 inchangée. `MemberSpaceLoading` ajoute la carte « Mes
       coordonnées » en `skeleton` (C8). `dashboard/page.tsx` passe
       `getMyContactDal()` et `updateMyContactAction`. Mettre à jour
       `dashboard/page.test.tsx` : nouveau texte de sécurité, les cas C1, C7, sans fiche, et
       chargement. `account/page.test.tsx` ne bouge pas : il lit `AccountPage.description`, hors
       périmètre.
9. [x] **e2e** (GitHub uniquement) : un `describe` « s16 » dans `e2e/member-accounts.spec.ts`, pour
       réutiliser `requestLink`, `loginByLink` et `inTenant`. Scénarios :
       - Lucie Moreau (TechCorp) se connecte, modifie téléphone et complément, recharge : valeurs
         conservées (critère 1). Un compte du bureau de TechCorp ouvre sa fiche et y voit les
         nouvelles valeurs (critère 4) ;
       - code postal « 1310 » → message sous le champ, et la base est inchangée après rechargement
         (critère 2) ;
       - Gérard Pommier modifie son téléphone sur TechCorp : sa fiche Marketing Pro est inchangée en
         base, et son email reste identique sur les deux (critère 3 + ADR 040) ;
       - fiche sans parcelle : la carte s'affiche (C7).
       Restaurer les valeurs du seed en fin de `describe`. Vérification : `pnpm lint`, typecheck,
       `pnpm test --run`, puis CI verte sur la PR.

## Files touched

- `docs/stories.md`, `docs/design-system.md` (§9), `docs/decisions/040-…md` (nouveau, écrit avec ce
  plan)
- `src/env-schemas.ts`, `src/env-schemas.test.ts` (commentaire et titre seulement)
- `src/db/repositories/member-profile-repository.ts`
- `src/services/validation/member-profile-validation.ts` (+ test)
- `src/services/types/domain/member-space-types.ts`
- `src/services/member-space-service.ts`, `src/services/facades/member-space-service-facade.ts`,
  `src/services/__tests__/member-space-service.test.ts`
- `src/app/dal/member-space-dal.ts`
- `src/app/[locale]/(app)/dashboard/actions.ts` (nouveau) + `actions.test.ts`,
  `dashboard/page.tsx`, `dashboard/page.test.tsx`
- `src/components/features/member-profile/member-profile-form-validation.ts`
- `src/components/features/member-space/member-space.tsx`, `my-contact-card.tsx` (nouveau) +
  `my-contact-card.test.tsx`
- `messages/fr.json`
- `e2e/member-accounts.spec.ts`
- Docs de la story : `docs/research/…`, `docs/designs/s16-coordonnees-membre*`, ce plan

**Non touchés** : la fiche côté bureau (`member-profile-detail.tsx`, `member-contact-fields.tsx` et
leurs tests), le service du bureau, `member-account-service`, `/account`, Better Auth, le registre
d'actions. Pas de migration ni de nouvelle table : RLS existante sur `member_profile`.

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : validation (normalisation, refus, clés retirées),
  service (autorisation d'abord : sans session, id étranger ignoré, email jamais écrit), action
  (invalide / succès / échec, `FormData` filtré), carte (états C1 à C6) et espace membre (C1, C7,
  C8, sans fiche). DB et session mockées.
- **e2e (Playwright, en CI seulement)** : la seule preuve de la RLS et du `WHERE user_id` réel. Elle
  couvre l'aller-retour membre → bureau, l'isolation entre les deux associations de Gérard Pommier
  et l'email inchangé.
- Rappel du montage 9p : un timeout de worker Vitest n'est pas un vert. Valider sur une copie en
  disque local si besoin.

## Definition of Done

- Une PR `feature/s16-coordonnees-membre`, un seul commit de story (pas de migration).
- Les quatre critères amendés sont couverts par des tests verts (unitaires + e2e en CI).
- Aucune régression : tests du bureau (`member-profile-*`) et de `/account` inchangés et verts.
- Aucun identifiant de fiche dans le HTML ni dans le `FormData` de l'espace membre. Aucune nouvelle
  occurrence de `withRlsBypass`. Aucun texte en dur hors de `messages/fr.json`.
- Écran conforme au design (C1 à C8, desktop et mobile), composants du design system seulement.
- `/ks-review` passé (`Ship allowed: yes`).
