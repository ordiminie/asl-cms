---
validated: yes
---

# Plan — Story s12d-comptes-membres

Branch: `feature/s12d-comptes-membres`

## Target story

**En tant que** membre du bureau **je veux** qu'une fiche dotée d'une adresse email ait un compte
connectable, et qu'il se referme quand l'adresse est retirée, **afin que** chaque propriétaire
joignable par email accède à son espace, et à lui seul. Complexité 3. Dépendances (s03, s03c, s12,
s46, s46b) livrées.

Critères d'acceptation :

1. Renseigner une adresse email sur une fiche « courrier uniquement » lui ouvre un compte connectable
   sur cette association ; la retirer referme l'accès sans supprimer la fiche ni son historique.
2. Une fiche créée avec une adresse email a un compte dès sa création, y compris les fiches qui
   avaient déjà une adresse avant cette story.
3. Une adresse déjà connue du produit réutilise son compte ; fermer l'accès ici ne touche pas à son
   accès ailleurs.
4. Un membre ne voit que ses propres parcelles, actuelles et passées ; l'accès à la fiche d'un autre
   membre est refusé.
5. Après connexion, un propriétaire arrive sur « Mes parcelles » (`/dashboard`, destination de
   s46b, non retouchée).
6. Retirer l'adresse d'une fiche dont le compte a une session ouverte coupe l'accès à la requête
   suivante.

Sources : `docs/research/s12d-comptes-membres.md` (2 octobre, complétée le 20 octobre ; ses passages
sur la coquille `(app)`, `/team` et le tableau de bord factice sont dépassés par s45 à s47, revérifiés
ici), `docs/designs/s12d-comptes-membres.md` (validé le 20 octobre), ADR 037 et 038.

### Arbitrages repris (produit, 20 octobre)

- Changer l'adresse d'une fiche **ferme l'ancien accès et en ouvre un sur la nouvelle**.
- Fiche d'un membre du bureau ou de la présidence : adresse **modifiable, jamais supprimable** ; le
  rôle **suit la nouvelle adresse** (l'ancien compte perd sa ligne dans cette association, le nouveau
  la reçoit avec le même rôle).
- Accès fermé avec une session ouverte : **déconnexion** et message sur `/login`.
- Anciennes parcelles listées avec leur période, **sans l'acquéreur**.

### Ce que la story ne fait pas (à ne pas compter comme un manque)

- **N'envoie rien** : ni invitation (s15), ni lancement (s42).
- **Aucune purge, aucune coupure automatique** (cotisation, vente) : un ancien propriétaire garde son
  accès (état C3) ; le `user` n'est jamais supprimé.
- Pas d'écran où le propriétaire modifie son adresse (s16).
- Ne retouche pas la destination après connexion (s46b).

### Décisions du plan (à confirmer à la validation)

- **Piège 14 de la recherche** : le changement d'adresse hérité de `/account` (Better Auth
  `changeEmail`) modifie `user.email` dans **toutes** les associations sans que la fiche suive. Il est
  **fermé** dans s12d (drapeau `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL` à `false` par défaut) ; s16 le
  rouvrira en synchronisant fiche et compte.
- **Écran C4** : aucune adresse de l'espace membre ne porte l'identifiant d'une fiche. Le seul endroit
  où un membre peut viser la fiche d'un autre est `/bureau/proprietaires/{id}`. Un propriétaire
  (rôle `member`) qui ouvre une page du back-office voit l'écran C4 (titre « Cette page ne vous est
  pas accessible », bouton « Revenir à mon espace » vers `/dashboard`) **à la place** de l'écran de
  refus actuel ; comme le layout ne connaît pas la page visée, la phrase devient « Elle est réservée
  au bureau de l'association. » au lieu de « Elle concerne un autre membre de l'association. ». Les
  autres comptes gardent l'écran de refus actuel.
- **Textes corrigés** (manques du design) : A3 « Il recevra les envois par courrier. » devient « Les
  envois partiront par courrier. » (pas d'accord de pronom) ; D « Votre accès à l'espace de
  {association} est fermé. » devient « Votre accès à l'espace membre est fermé. » (pas d'élision ;
  le nom de l'association est déjà dans l'en-tête de la page).
- **Aide du champ email** placée sous le champ (design system), pas entre libellé et champ.
- **Lien d'ancien email** : un lien envoyé avant la fermeture donne l'écran de lien invalide existant,
  pas le message D (ADR 038, erreur d'un compte inconnu de l'ADR 034).
- **Fiches existantes (critère 2)** : aucun environnement ne porte de vraies fiches (le serveur n'est
  pas encore déployé). La reprise passe par **le seed**, qui ouvre les comptes de ses fiches à email
  avec le même service ; s13 importera par ce service. Pas de migration de données.
- **Autorisation** : l'ouverture et la fermeture sont des effets de l'enregistrement d'une fiche,
  sous `member.profile.manage` ; pas d'action nouvelle au registre. La lecture de l'état du compte
  d'un tiers passe par un `can*` (ADR 014) qui s'appuie sur la même action.

## Tasks (ordered)

1. [x] **Lien fiche ↔ compte (ADR 037).** Colonne `user_id` sur `member_profile`
       (`src/db/models/member-profile-model.ts`) : nullable, FK `user(id)` `ON DELETE SET NULL`,
       index unique partiel `(organization_id, user_id) WHERE user_id IS NOT NULL` ; migration par
       `pnpm db:generate` (jamais à la main). Mettre à jour la description de `member_profile` dans
       `docs/architecture.md` (le classement RLS ne change pas ; `src/db/rls-inventory.test.ts` doit
       rester vert). Test : le modèle expose la colonne et l'index (test du modèle existant ou
       nouveau).

2. [x] **Règle pure du compte d'une fiche.** `src/services/rules/member-account-rules.ts` : à partir
       de l'adresse enregistrée, de la nouvelle adresse et du rôle actuel du compte lié dans cette
       association, rend une décision : `none`, `open`, `close`, `replace` (avec le rôle à reporter)
       ou `refuse_board_removal`. Comparaison d'adresses insensible à la casse ; une adresse
       inchangée à la casse près ne fait rien. Tests unitaires exhaustifs (fiche courrier → email,
       email → vide, email → autre, bureau vidé, bureau remplacé, présidence remplacée, casse seule).

3. [x] **Service d'ouverture et de fermeture** (`src/services/member-account-service.ts`, sans
       façade : appelé par d'autres services dans leur `withTenant`, jamais par la présentation). DAO
       nouveaux ou étendus, tous par `getDb()`. (a) Trouver ou créer le `user` par l'adresse **mise
       en minuscules**, `name` = nom de la fiche à la création seulement, `emailVerified` laissé
       faux ; jamais par Better Auth (hook d'inscription, Stripe) ni par
       `createOrganizationMemberService` (plafond du plan). (b) Poser la ligne `member` si absente
       (rôle `member`, `createdAt` fourni) ; ne jamais changer un rôle existant. (c) Retirer la ligne
       `member` avec la condition **`role = 'member'` dans la requête**. (d) Déplacer un rôle
       `board` / `owner` d'un compte à l'autre (remplacement sur une fiche du bureau). (e) Écrire ou
       vider `member_profile.user_id`. Les écritures de `user` et `member` passent dans un **point
       de sauvegarde** : une violation d'unicité concurrente relit l'existant au lieu de condamner
       la transaction. Une fonction de lot `openMemberAccountsForOrganization` (idempotente :
       relancer ne crée rien de plus) pour le seed et s13. Tests unitaires (DAO simulés) :
       réutilisation d'un `user` connu, création en minuscules, rôle existant intact, fermeture qui
       n'appelle que la suppression conditionnée, déplacement de rôle, idempotence du lot.

4. [x] **Branchement dans les fiches.** `createMemberProfileService` et
       `updateMemberProfileContactService` (`src/services/member-profile-service.ts`) appliquent la
       décision de la tâche 2 **dans le même `withTenant`** que l'écriture de la fiche. Nouveau
       résultat `board_email_required` (rien n'est écrit) ; un résultat `saved` porte le changement
       d'accès (`opened`, `closed`, `replaced`, ou aucun) pour les messages. `MemberProfileDTO`
       (`member-profile-types.ts`) gagne l'état du compte : `open` (adresse de connexion, rôle au
       bureau éventuel) ou `mail_only`, lu sous un `can*` (ADR 014). Mettre à jour
       `member-profile-service.test.ts` (`accountDaos()` ne vaut plus que sans email) et l'en-tête du
       service, du repository et de `member-profile-detail.tsx` (« s12 n'ouvre aucun compte »). Seed
       (`src/db/scripts/seed.ts`, `tenant-member-profiles-seed.ts`) : les fiches à email ont un
       compte, par la fonction de lot ; ajouter si besoin une fiche propriétaire (rôle `member`) avec
       parcelles actuelle et ancienne, et une même adresse sur deux associations, pour les e2e. Jeux
       fictifs (`*.test`, `example.test`).

5. [x] **Coupure à la lecture (ADR 038).** `getAuthUser()`
       (`src/services/authentication/auth-service.ts`) applique `canOpenSessionOn` avec
       l'organisation du domaine appelé (`organizationOfRequest`, `requestHostOf`) et rend
       `undefined` sinon ; SuperAdmin toujours accepté. Respecter la garde d'imports de s46b
       (`magic-link-integration-imports.test.ts` : pas de cycle `auth.ts` → façade). Tests : membre
       de l'association accepté, compte sans ligne `member` refusé, SuperAdmin accepté sur tout
       domaine, domaine sans association refusé hors SuperAdmin.

6. [x] **Déconnexion et message après fermeture (écran D).** `withAuth` : session présente mais
       `getAuthUser()` vide → redirection vers `/login/acces-ferme`. Route Handler
       `src/app/[locale]/(auth)/login/acces-ferme/route.ts` : ferme la session courante par Better
       Auth (cookie effacé dans la réponse ; API exacte à vérifier dans `node_modules/better-auth`),
       `307` vers `/login?acces=ferme`. La page `/login` affiche, avec ce paramètre seulement,
       l'encadré neutre `role="status"` (icône `Info`) : « Votre accès à l'espace membre est fermé. »
       puis « Pour le rouvrir, écrivez au bureau. » + lien « Page Contact ». Rien d'autre ne change sur
       la page. Tests : `withAuth` (trois cas), la route (session fermée, redirection relative), la
       page (encadré présent seulement avec le paramètre).

7. [x] **Fermer le changement d'adresse hérité.** `NEXT_PUBLIC_BETTER_AUTH_CHANGE_EMAIL` par défaut
       à `false` (`src/env-schemas.ts`), et à `false` dans `env.example` et
       `ops/env.production.example` avec un commentaire qui renvoie à s16. La carte « Adresse email »
       disparaît de `/account`, la route Better Auth refuse. Test : `security-section` sans la carte
       quand le drapeau est faux ; mettre à jour `account/page.test.tsx` si elle l'attend.

8. [x] **Écrans du bureau (A et B).** `member-profile-detail.tsx` : carte « Accès à l'espace
       membre » (`Lock`, aucune action, état enregistré, meta du rôle au bureau), confirmations
       (retrait, ajout, remplacement, création avec ou sans adresse), refus du bureau (résumé
       `role="alert"` + message sous le champ, pas de « Facultatif » pour le bureau), avertissements
       `warning` sous le champ pendant la modification (adresse vidée, remplacée, rôle qui suit).
       `member-contact-fields.tsx` : nouvelle aide sous le champ. `proprietaires/actions.ts` :
       `board_email_required` et le changement d'accès dans le résultat. Libellés dans
       `messages/fr.json` (`BureauMemberProfilesPage`). Reprendre les patrons d'état de s12 : message
       dérivé des props courantes, nettoyage en `useLayoutEffect`, tests sous un vrai `<Activity>`.
       Une adresse connue ailleurs donne exactement le même message qu'une adresse neuve. Remplacer
       le test « ne livre pas la carte Accès (s12d) ».

9. [x] **« Mes parcelles » (écran C) et refus C4.** Service de lecture **côté membre**
       (`getMyParcelsService` ou nom équivalent) : aucun identifiant de fiche en entrée ; résout la
       fiche par `(association du domaine, user_id de la session)` sous `withTenant` ; rend parcelles
       actuelles et anciennes **sans l'acquéreur** (DTO propre, pas `MemberParcelsDTO`) ; rien pour
       un compte sans fiche. Façade + DAL sans `'use cache'` (donnée par utilisateur, derrière
       `<Suspense>`). `src/app/[locale]/(app)/dashboard/page.tsx` : marqueur `Lock` + « Espace
       personnel » + résumé, `h1` « Bonjour {nom} », carte « Mes parcelles » (lignes de 56 px, `Map`,
       numéro en `font-mono`, dates en clair par `formatContentDate`, fin = veille de la vente),
       phrase de l'ancien propriétaire, pied « Une erreur ? Écrivez au bureau. » + « Page Contact »,
       puis la carte Sécurité de s46 inchangée ; chargement en `skeleton` sans marqueur ; compte sans
       fiche = page s46 actuelle (C5). Aucun état client qui survivrait à un changement d'utilisateur.
       Refus C4 dans le layout `(bureau)` pour un compte de rôle `member` de l'association (voir
       décisions). Tests : service (fiche d'un autre jamais lue, acquéreur absent, compte sans
       fiche), page (C1, C2, C3, C5, chargement), layout du bureau (C4 pour un membre, refus actuel
       pour les autres).

10. [x] **Preuves e2e** (CI de la PR, pas en local). Mettre à jour `e2e/member-profiles.spec.ts` :
        `accountsBornFrom` et l'assertion « renseigner un email n'ouvre aucun compte (s12d) »
        s'inversent ; `cleanUpRun` supprime aussi les `user` et `member` créés par l'essai. Nouvelles
        preuves : critère 1 (ajout puis retrait d'adresse : connexion possible puis refusée, fiche et
        parcelles intactes) ; critère 2 (fiche du seed à email connectable) ; critère 3 (même
        adresse sur deux associations : un seul `user`, fermer sur A laisse B ouvert) ; critère 4
        (deux tenants : chaque domaine montre la fiche de cette association seulement ; un membre
        sur `/bureau/proprietaires/{id}` voit C4) ; critère 6 (session ouverte, adresse retirée par le
        bureau, **rechargement réel** → `/login?acces=ferme` et l'encadré ; navigation suivante
        toujours refusée) ; fiche du bureau : retrait refusé, rien n'est écrit. Sélecteurs par rôle.
        Vérifier que `authorization.spec.ts`, `smoke-authenticated.spec.ts` et `magic-link.spec.ts`
        restent verts.

## Files touched

- Modèle et migration : `src/db/models/member-profile-model.ts`, `drizzle/migrations/0033_*.sql` +
  `meta/` (générés).
- Persistance : `src/db/repositories/member-profile-repository.ts`, `user-repository.ts`,
  `organization-repository.ts` (DAO conditionnés au rôle, point de sauvegarde).
- Services : `src/services/rules/member-account-rules.ts` (nouveau),
  `src/services/member-account-service.ts` (nouveau), `member-profile-service.ts`, service de
  lecture côté membre (nouveau ou dans `parcel-ownership-service.ts`), façade et intercepteur
  associés, `src/services/authorization/` (`can*` de l'état du compte),
  `src/services/types/domain/member-profile-types.ts` (+ type du DTO côté membre),
  `src/services/authentication/auth-service.ts`.
- DAL : `src/app/dal/` (lecture « Mes parcelles », sans cache).
- Présentation : `src/app/[locale]/(app)/dashboard/page.tsx`, `src/components/features/auth/with-auth.tsx`,
  `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/login/acces-ferme/route.ts`
  (nouveau), `src/app/[locale]/(bureau)/layout.tsx`, composant de refus C4 (nouveau, à côté de
  `bureau-access-denied.tsx`), `src/components/features/member-profile/member-profile-detail.tsx`,
  `member-contact-fields.tsx`, `member-profile-form.tsx` si la confirmation de création y passe,
  `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`, composant(s) « Mes parcelles »
  (nouveau, `src/components/features/member-space/`).
- Configuration : `src/env-schemas.ts`, `env.example`, `ops/env.production.example`.
- Libellés : `messages/fr.json` (et `en.json` / `es.json` seulement si `page-i18n.test.ts` exige la
  parité d'un espace touché, par exemple `MemberSpacePage`).
- Seed : `src/db/scripts/seed.ts`, `src/db/scripts/tenant-member-profiles-seed.ts`.
- Docs : `docs/architecture.md`, ADR 037 et 038 (déjà écrits), ce plan.
- Tests : à côté de chaque fichier (`*.test.ts(x)`), `e2e/member-profiles.spec.ts`, nouvelle spec
  e2e de l'espace membre.

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : la règle de décision (tâche 2) porte la logique
  métier, testée cas par cas ; services avec DAO simulés (ouverture, fermeture conditionnée,
  déplacement de rôle, idempotence, résultat `board_email_required`, DTO côté membre sans acquéreur) ;
  `getAuthUser` (règle de l'ADR 034 à la lecture) ; `withAuth`, route `/login/acces-ferme`, page
  `/login` ; composants sous un vrai `<Activity>` (fiche, « Mes parcelles », C4). Montage 9p lent :
  valider la suite complète sur une copie en disque local ; un timeout de worker n'est pas vert.
- **e2e (Playwright, CI de la PR sur build de production, Postgres éphémère seedé)** : la RLS et la
  coupure de session ne sont pas testables en unitaire. Isolation entre deux tenants (critère 4),
  compte partagé (critère 3), coupure au rechargement (critère 6), cycle ouvrir / fermer (critère 1),
  reprise du seed (critère 2). Pas d'e2e ni de build en local (machine trop juste).
- Pas de nouvelle occurrence de `withRlsBypass`.

## Definition of Done

- Une seule PR depuis `feature/s12d-comptes-membres`, un commit de story (plus, au besoin, un commit
  séparé pour la migration), squash au merge.
- Les six critères prouvés : règle et services en unitaire, parcours en e2e sur la CI.
- Aucune régression : suite unitaire complète verte, e2e verts sur la CI (dont `authorization`,
  `smoke-authenticated`, `magic-link`, `member-profiles`).
- Rien envoyé à l'ouverture d'un compte ; aucun `user` supprimé ; aucune ligne `board` / `owner`
  retirée par une fermeture.
- Écrans conformes à `docs/designs/s12d-comptes-membres.md` (composants du design system seulement),
  avec les textes corrigés listés plus haut.
- Revue passée (`docs/reviews/s12d-comptes-membres.md`, `Ship allowed: yes`).
- Mise en production : pas dans cette story ; **le premier déploiement sur le VPS (recette de s12b)
  est à faire juste après sa livraison**.

## Écarts d'exécution

- **« Président(e) »** (revue n° 1, mineur 4) : le libellé de présidence de la carte « Accès » est
  écrit « Président(e) » au lieu de « Présidente » / « Président » du design, faute de donnée de
  genre sur le rôle `owner`. Consigné comme manque du design system dans
  `docs/designs/s12d-comptes-membres.md` ; aucun changement de code.
