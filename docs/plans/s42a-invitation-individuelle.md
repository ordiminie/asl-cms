---
validated: yes
---

# Plan — Story s42a-invitation-individuelle

Branch: `feature/s42a-invitation-individuelle`, créée depuis `origin/main` **après la fusion de la PR 83**
(scission de s42 dans `docs/stories.md`, recherche renommée). Ne pas embarquer `docs/logs/`.

Sources : `docs/stories.md` (s42a), `docs/research/s42a-invitation-individuelle.md` (les deux parties ; le
complément du 24/11 fait foi sur la fiche), `docs/designs/s42a-invitation-individuelle.md` + `.html`,
[ADR 071](../decisions/071-lien-d-invitation-par-le-generateur-du-lien-magique.md).

## Target story

Le bureau envoie, depuis la fiche d'un membre, une invitation à chaque adresse active, chacune avec son
propre lien de connexion. Critères (numérotés dans l'ordre de la story) :

1. Invitation depuis la fiche, à chaque adresse active, un lien propre et valide par adresse.
2. Canal transactionnel du lien magique, en-tête au logo (ou nom), nom de l'association.
3. Texte de l'invitation = paramètre de tenant, effet à l'email suivant.
4. Durée propre du lien, paramètre de tenant (seed 7 jours) ; les 20 minutes du lien demandé inchangées ;
   lien expiré ou utilisé → page du lien invalide.
5. État par adresse sur la fiche : jamais invitée / invitée le / connectée le — première connexion réussie
   sur **cette** association, hors connexion à la place du membre (s48).
6. Refus lisible pour un membre « courrier uniquement ».
7. Réinviter remplace l'invitation de chaque adresse ; les anciens liens ne marchent plus.
8. Adaptateur + budget (s52), nature « Invitation », reportée au lendemain, rejouée avec un lien **neuf**,
   jamais conservé.
9. Aucun membre d'une autre association.
10. Lien sur le domaine de l'association, session ouverte — deux associations, envoi immédiat **et**
    invitation reportée rejouée hors requête.

Arbitrages du 24/11/2026 : durée 7 jours (seed) ; invitation reportable avec lien neuf.

## Tasks (ordered)

1. [x] **Réglages et libellés.** Dans `ASSOCIATION_SETTINGS_REGISTRY`
   (`src/services/types/domain/association-settings-types.ts`) : section `'invitation'` ; clé
   `invitation.text` (`text`, `multiline`, `maxLength` 2000, facultative, sans défaut, `whenEmptyKey` qui
   cite le défaut) ; clé `invitation.link_days` (`number`, `integer`, `min` 1, `max` 30, défaut
   `{value: '7'}`, `unitKey: 'units.days'`, patron exact de `member.email_confirmation_days`) ; accesseurs
   `getInvitationText(settings): string | null` et `getInvitationLinkDays(settings): number`. Seed du
   premier tenant (`tenant-settings-seed.ts`) : `invitation.link_days = 7`. Libellés `messages/fr.json`
   (section, champs, aides, erreurs, défaut du texte — **aucune fonctionnalité postérieure citée**).
   Tests : registre et accesseurs (absent → `null` / 7 ; hors bornes refusé par la validation existante).
2. [x] **Traces d'invitation et de connexion.** Modèle `member_invitation_state` (`src/db/models/`) :
   `organization_id`, `user_id` (FK `user` `CASCADE`), `last_invited_at`, `first_signed_in_at`, unique
   `(organization_id, user_id)` ; migration par `pnpm db:generate`, puis RLS forcée + policy
   `tenant_isolation` par `drizzle-kit generate --custom` (patron `0078_unpaid_reminder_rls.sql`).
   Repository (`getDb()`) : `markInvitedTxnDao`, `markFirstSignInTxnDao` (n'écrit que si nul : `on conflict
   … coalesce`), `getInvitationStatesByUserIdsDao`. Classement RLS de `docs/architecture.md` (+1 table) et
   inventaire de s12c/s38 si le dépôt en tient un. Tests : règle pure d'état (`invitationStateOf` :
   connectée prime sur invitée, sinon invitée, sinon jamais) en unitaire ; le reste prouvé en e2e.
3. [x] **Générateur du lien d'invitation (ADR 071).** `src/lib/better-auth/invitation-link.ts` :
   `issueInvitationLink({organization, email, expiresInDays})` → `{url, token}` ; appelle
   `auth.api.signInMagicLink` avec `new Headers({host: <domaine>})`, sans `Request`,
   `callbackURL: '/login/destination'`, `errorCallbackURL` à motif invitation, `metadata.invitation =
   {organizationId, deliver}`. Dans `sendMagicLink` (`magic-link-integration.ts`), branche invitation :
   association lue par identifiant (façade chargée par `import()`), **pas de quota**, `canOpenSessionOn`,
   `revokeEarlierMagicLinks`, prolongation de la ligne `verification` du jeton par l'adaptateur du contexte,
   `rebaseMagicLinkUrl`, `deliver({url, token})` ; **aucun envoi**. Le chemin de la demande est inchangé.
   L'adresse passée est celle du compte (`user.email`, minuscules : sinon la révocation rate). Tests
   **sur le vrai Better Auth** (patron `*.real-auth.test.ts`) : appel sans requête, URL sur l'origine de
   l'association A puis B, ligne expirant à J+7, lien précédent révoqué, quota de la demande non consommé,
   compte non membre → rien ; `magic-link-integration-imports.test.ts` reste vert (aucune arête statique
   vers les façades).
4. [x] **Première connexion.** Hook `databaseHooks.session.create.after` dans le plugin local
   (`association-session-guard.ts`, ou un plugin voisin placé juste après) : association par l'hôte (comme
   le `before`), session **sans** `impersonatedBy`, compte membre de l'association → `markFirstSignInTxnDao`
   sous `withTenant`, service chargé par `import()` dynamique. Un échec d'écriture est journalisé (sans
   adresse) et **n'empêche jamais** la connexion. Tests unitaires du hook : écrit pour un membre, rien pour
   une imitation, rien pour un SuperAdmin hors association, rien sur une autre association, erreur
   avalée.
5. [x] **Email d'invitation.** Extraire l'en-tête `AssociationHeader` de `magic-link-email.tsx` en module
   partagé (`src/lib/emails/association-header.tsx`) utilisé par le lien magique et l'invitation (pas de
   quatrième copie ; les deux copies de s08/s10 peuvent rester hors périmètre). Gabarit
   `src/lib/emails/invitation-email.tsx` (design, écran 3 : titre, texte du tenant **rendu comme texte**,
   bouton + URL en clair, trois étapes, pied transactionnel, jumelles sombres §5.2 ajoutées à `theme.ts` si
   absentes). `sendInvitationEmailService` (`email-service.ts`) : locale explicite, version texte complète,
   `sendEmailService(…, {scope: 'tenant', organizationId, nature: 'invitation'}, {recipientType: 'system'})`,
   rend l'`EmailSendResult`. Ajouter `'invitation'` à `TENANT_EMAIL_NATURES` et le libellé
   `EmailSendingBureau.pending.natures.invitation` (« Invitation »). Tests `*.real-i18n.test.tsx` : texte du
   tenant échappé (une balise reste du texte), défaut quand le réglage est vide, date de validité, nom et
   logo PNG seulement, aucune URL dans un journal.
6. [x] **Report et rejeu avec lien neuf.** Dans `sendTenantEmail` / `keepDeferredEmail` : pour la nature
   `invitation`, l'email conservé remplace URL et date de validité par des marques (patron
   `withoutConfirmationLink`), et le jeton émis est révoqué. Dans `deferredEmailToSend` : une ligne
   `invitation` relit le compte de son destinataire et son association, vérifie qu'il est encore membre
   avec une adresse active, régénère le lien par `issueInvitationLink` (sans requête), remplace les
   marques, puis, une fois parti, écrit `last_invited_at` ; plus membre ou adresse retirée → rien ne part.
   Tests : contenu conservé sans jeton ni URL ; rejeu = jeton neuf sur l'origine de l'association ; rejeu
   pour une adresse retirée = rien ; trace écrite seulement au départ réel.
7. [x] **Service d'invitation.** `inviteMemberProfileService({organizationId, memberProfileId})`
   (`src/services/member-invitation-service.ts` + façade + intercepteur **sans arguments ni résultat
   journalisés**) : validation Zod, `canPerformAction(…, 'member.profile.manage')`, `withTenant` ; fiche
   introuvable sous le tenant → `NotFoundError` ; aucune adresse active → `{status: 'mail_only'}` ; pour
   chaque adresse active, dans l'ordre de la fiche : compte de l'adresse (lien de s54), lien
   (`issueInvitationLink`, durée du tenant), envoi ; `sent` → `markInvitedTxnDao`. Rend `{status: 'sent' |
   'deferred' | 'partial', sent: string[], deferred: string[]}` ; une erreur de transport après un premier
   envoi rend `partial`, jamais une exception qui masquerait ce qui est parti. Tests (invité, membre,
   bureau, présidence, SuperAdmin) : refus d'autorisation, refus courrier, deux adresses = deux liens
   distincts, adresse en attente ignorée, report, échec partiel, réinvitation = nouvel appel au générateur
   (la révocation est prouvée en tâche 3).
8. [x] **Lecture de l'état sur la fiche.** Le DTO des adresses de la fiche (`MemberProfileEmailDTO`, lu par
   `member-profile-service.ts`) gagne `invitation: {state: 'never' | 'invited' | 'signed_in', at: string |
   null}` pour chaque adresse **active**, depuis `getInvitationStatesByUserIdsDao` (compte de l'adresse) ;
   une adresse en attente n'en a pas. Aucun type Drizzle côté présentation. Tests du service : trois états,
   adresse portée par deux fiches = même état, autre association sans effet.
9. [x] **Écrans.** Server Action `inviteMemberProfileAction` dans `bureau/proprietaires/actions.ts` (patron
   des actions voisines : tenant, `getTranslations`, `requireActionAuth`, façade, résultat typé, messages
   `messages/fr.json`). Carte « Accès à l'espace membre » (`member-profile-detail.tsx`) : états 2a à 2g du
   design (bouton `outline` + `Send`, `meta`, alertes ancrées, aucun toast) ; carte « Adresses email »
   (`member-profile-emails-card.tsx`) : `meta` d'état sous « Active », table et cartes mobiles. Section
   « Invitation des membres » des Réglages : rendue par le registre (vérifier seulement l'ordre et les
   libellés). Page `/login/lien-invalide` : explication « invitation » quand le motif est présent, durée lue
   dans les réglages de l'association du domaine. Tests de composants et d'action (succès, report, partiel,
   courrier, échec, refus d'autorisation) ; tests existants de la fiche et de la page mis à jour.
10. [x] **e2e (CI).** `e2e/member-invitations.spec.ts` : sur l'association A puis B, le bureau invite une
    fiche à deux adresses → deux emails dans la boîte du transport `file`, deux liens distincts ; chaque
    lien ouvre la session **sur le domaine de son association** ; la fiche affiche « Connectée le » pour
    l'adresse utilisée et « Invitée le » pour l'autre ; réinviter rend l'ancien lien inopérant (page du lien
    invalide, variante invitation) ; fiche « courrier uniquement » sans bouton ; le bureau de A ne peut
    inviter aucune fiche de B (appel direct de l'action) ; imitation (s48) sans effet sur l'état. Si l'e2e
    de s52 (`email-budget.spec.ts`) sait épuiser le budget et déclencher le planificateur, y ajouter le cas
    « invitation reportée puis rejouée » sur les deux domaines ; sinon la preuve hors requête reste celle des
    tâches 3 et 6, et la PR le dit. Seed (`seed.ts`) seulement si la spec en dépend.

## Files touched

- `docs/decisions/071-lien-d-invitation-par-le-generateur-du-lien-magique.md` (nouveau), `docs/architecture.md`
  (classement RLS), `docs/design-system.md` (§9 : gap « envoi partiel » si retenu en revue)
- `src/services/types/domain/association-settings-types.ts`, `src/db/scripts/tenant-settings-seed.ts`,
  `messages/fr.json`
- `src/db/models/member-invitation-state-model.ts` (nouveau), schéma exporté, `drizzle/migrations/*`
  (générés), `src/db/repositories/member-invitation-state-repository.ts` (nouveau)
- `src/lib/better-auth/invitation-link.ts` (nouveau), `magic-link-integration.ts`,
  `association-session-guard.ts`, `auth.ts` (si un plugin voisin est ajouté)
- `src/lib/emails/association-header.tsx` (nouveau), `magic-link-email.tsx`, `invitation-email.tsx`
  (nouveau), `theme.ts`
- `src/services/types/domain/email-send-types.ts`, `src/services/email-service.ts`,
  `src/services/rules/email-budget-rules.ts` (si la nature y est classée)
- `src/services/member-invitation-service.ts` (nouveau), `src/services/facades/…` + intercepteur,
  `src/services/rules/member-invitation-rules.ts` (nouveau), `src/services/member-profile-service.ts`,
  `src/services/types/domain/member-profile-types.ts`
- `src/app/[locale]/(bureau)/bureau/proprietaires/actions.ts`, `[id]/page.tsx`,
  `src/components/features/member-profile/member-profile-detail.tsx`, `member-profile-emails-card.tsx`
- `src/app/[locale]/(auth)/login/lien-invalide/*`
- Tests colocalisés de chacun, `e2e/member-invitations.spec.ts` (nouveau)

## Test strategy

- **Unitaires (Vitest, `pnpm test --run`)** : règles pures (état d'invitation), registre, service (cinq
  profils d'utilisateur, refus, issues), hook de session, gabarit et service email (`real-i18n`), report et
  rejeu, composants et action. Base et Better Auth mockés, sauf :
- **Vrai Better Auth** (tâche 3, patron `*.real-auth.test.ts`) : génération sans requête, prolongation,
  révocation, rebasage sur deux origines, canal `metadata` transmis tel quel — c'est la preuve de l'ADR 071.
- **e2e (Playwright, CI seulement)** : parcours complet sur deux associations, réinvitation, isolation par
  appel direct, imitation. La RLS de la nouvelle table n'est testable qu'ici.
- Montage 9p lent : valider la suite unitaire sur une copie en disque local ; un timeout n'est jamais vert.

## Definition of Done

- Une PR `feature/s42a-invitation-individuelle`, un commit de story (plus un pour la migration si elle doit
  pouvoir se défaire seule), recherche, design, plan et revue embarqués.
- Les dix critères couverts par un test nommé ; le texte par défaut relu en revue (aucune fonctionnalité
  postérieure).
- Aucune seconde génération de lien (revue : un seul appel à `signInMagicLink` hors de l'action de
  connexion) ; aucun lien ni jeton dans un journal, une archive ou un email conservé.
- Nouvelle table : `organization_id`, RLS forcée, accès croisé prouvé en e2e ; aucun `withRlsBypass`.
- Rien en dur : texte et durée en réglages, libellés dans `messages/fr.json`.
- Suite unitaire verte, e2e verte en CI, revue `/ks-review` passée (`Ship allowed: yes`).
- Rappel de déploiement : migration à appliquer ; aucune minuterie nouvelle (le rejeu passe par
  `asl-cms-planificateur`, déjà requis).
