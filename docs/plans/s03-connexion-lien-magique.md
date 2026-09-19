---
validated: yes
---

# Plan — Story s03-connexion-lien-magique

Branch: `feature/s03-connexion-lien-magique`

Sources : `docs/stories.md` §s03 (version scindée, PR 15), `docs/research/s03-connexion-lien-magique.md`,
`docs/designs/s03-connexion-lien-magique.md` (+ `.html`, canevas validé version 1), `docs/design-system.md` (§5, §7),
ADR 003, 005, 008, 009, 015, 016 et **ADR 017** (`docs/decisions/017-resend-conserve-comme-transport.md`, écrit pour ce
plan).

## Target story

**En tant que** membre propriétaire **je veux** recevoir un lien de connexion par email **afin de** consulter mon
espace sans avoir de mot de passe à retenir. Complexité 3. Dépend de s01, s01b, s02.

Critères d'acceptation :

1. Saisir une adresse email connue envoie un lien de connexion à usage unique et affiche un écran d'attente explicite.
2. Le lien ouvre une session valide ; réutilisé une seconde fois, il est refusé avec un message compréhensible et un bouton pour en redemander un.
3. Un lien de plus de 20 minutes est refusé avec le même message et le même bouton.
4. Une adresse email inconnue ne révèle pas si le compte existe (même écran, aucun email envoyé, aucun compte créé).
5. L'email de connexion part par l'adaptateur d'envoi de l'ADR 005 (transport Brevo derrière un contrat maison), jamais par un appel direct à un fournisseur — vérifié par un transport de test qui reçoit l'email à la place de Brevo.
6. L'email de connexion porte en en-tête le logo de l'association du domaine appelé (s01b), ou son nom quand elle n'a pas de logo.

### Décisions déjà prises (à respecter, pas à rediscuter)

- Better Auth gère le lien magique : **configurer, ne pas réécrire** (notes de la story).
- **20 minutes** ; **mot de passe conservé** au moins pour le SuperAdmin, accès par le lien discret « Accès prestataire »
  (arbitrages du 2026-09-19, design validé).
- Écrans, libellés et états : ceux de `docs/designs/s03-connexion-lien-magique.md`.
- Contrat `EmailTransport` + implémentation Brevo (ADR 005). **Budget quotidien global de l'association : s26**, pas
  ici. La **limitation des demandes de lien** (par adresse et par accès internet) est, elle, dans s03 : voir l'amendement
  du 2026-09-19.
- Hors périmètre : rôles et registre (s03b), lien et session sur le domaine de chaque association (s03c).

### Décisions prises à ce plan (à confirmer à la validation)

- **Tout email passe par le contrat.** `sendEmailService` (le point d'envoi unique de `email-service.ts`) et les deux
  envois directs (`sendSimpleEmailService`, `sendOrganizationInvitation`) passent par `EmailTransport` ; plus aucun code
  métier n'importe un SDK de fournisseur. **Resend est conservé comme transport de secours** (arbitrage du 2026-09-19,
  **ADR 017**, qui amende l'ADR 005 sur ce seul point) : sa dépendance reste, `RESEND_API_KEY` devient facultative.
- **Quatre transports**, choisis par `EMAIL_TRANSPORT` (`@/env`, serveur) : `brevo` (API REST
  `POST https://api.brevo.com/v3/smtp/email` par `fetch`, **aucune dépendance nouvelle** ; `BREVO_API_KEY` exigée
  seulement quand `EMAIL_TRANSPORT=brevo`), `resend` (SDK existant, isolé dans son adaptateur ; `RESEND_API_KEY` exigée
  seulement quand `EMAIL_TRANSPORT=resend`), `file` (écrit chaque message en JSON dans `EMAIL_OUTBOX_DIR` —
  développement et e2e, c'est le « transport de test » du critère 5 côté bout en bout), `memory` (tests unitaires).
  Défaut : `file` hors production ; la production doit déclarer `brevo`.
- **Durée** : constante nommée `MAGIC_LINK_EXPIRES_IN_SECONDS = 20 * 60` dans la configuration d'authentification,
  passée explicitement à `magicLink({expiresIn})` — pas la valeur par défaut de la lib (300 s).
- **Adresse « connue »** = un compte existe (recherche par email) ; l'appartenance à l'association du domaine appelé
  relève de s03c. `disableSignUp: true` : un lien ne crée jamais de compte.
- **Même temps de réponse** (§7) : l'action de demande de lien dure **au moins un plancher fixe** (1,5 s) dans les deux
  cas, adresse connue ou non ; l'envoi reste attendu, pour pouvoir afficher l'état « service d'email en panne ». Écart
  résiduel accepté : un envoi Brevo plus lent que le plancher.
- **Écrans A et B = un seul composant client**, deux vues : l'adresse reste dans l'état du composant, **jamais dans
  l'URL** (donnée personnelle). « Renvoyer un lien » et « Corriger l'adresse » s'en servent.
- **Routes** : `/login` devient l'écran A/B (le proxy y redirige déjà) ; le formulaire par mot de passe existant passe à
  **`/login/prestataire`** ; écran C à **`/login/lien-invalide`** (`errorCallbackURL` de Better Auth). Les helpers de
  connexion des specs e2e sont pointés vers `/login/prestataire`, sans changer leurs assertions.
- **Téléphone du bureau** (manque n° 1 du design) : **aucune clé ajoutée en s03** (il faudrait un nouveau type au
  registre) ; les phrases se lisent sans numéro (« appelez le bureau de votre association »). Le numéro viendra avec
  une clé dédiée, dans une story à désigner.
- **Logo de l'email** (manque n° 2) : affiché **seulement s'il est en PNG** (clé d'identité en `.png`), en URL absolue
  sur l'origine de la requête (`/api/identity/logo?v=…`) ; logo WebP ou absent → **le nom seul**. Aucune retouche de
  s01b.
- **Couleurs de l'email** : `src/lib/emails/theme.ts`, jumelles hexadécimales de §5.3 et triplets des six teintes de
  §1.2, fichier unique (§5.3) ; l'en-tête prend le triplet de la teinte de l'association (réglage s02).
- **Notification en application** : le lien magique ne crée plus de notification (`createTypedNotificationService`
  `magic_link`) ; il s'envoie directement par le service d'email. Un lien secret n'a rien à faire dans la liste des
  notifications.

### Amendement du 2026-09-19 (après revue)

La première revue (`5cb5157`) a relevé trois majeurs sur la demande de lien ; le product owner a tranché, le jour même,
de les corriger **dans s03** plutôt que de livrer avec :

- **Révoquer l'ancien lien** quand un nouveau est demandé : le libellé « Le précédent ne fonctionne plus » devient vrai.
  Suppression, par l'adaptateur de Better Auth, des lignes `verification` du lien magique de l'adresse
  (`value = {"email":…}`, `identifier` différent du nouveau jeton), seulement quand l'envoi part. Better Auth garde
  `storeToken: 'plain'`, dont la révocation dépend.
- **Fermer le point d'accès HTTP direct** `POST /api/auth/sign-in/magic-link` (`disabledPaths`) : seule la server action,
  avec son plancher de durée, demande un lien. `/magic-link/verify` reste ouvert.
- **Limiter les demandes côté serveur**, par adresse et par accès internet, **en base** (un compteur en mémoire repart à
  zéro au redémarrage) : table `rate_limit_event` (`organization_id`, RLS forcée, empreintes HMAC, jamais l'adresse ni
  l'IP en clair), fenêtre glissante d'une heure, purge au-delà de 24 h. Seuils = **réglages d'association** (ADR 010,
  ADR 016) : `login.link_requests_per_address_per_hour` (5), `login.link_requests_per_network_per_hour` (30), visibles
  dans la page Réglages du bureau par le registre. Seuil atteint → **même écran B**, aucun email, plancher conservé ;
  une adresse inconnue est comptée aussi. Le budget quotidien global (300 envois/jour, tous emails) reste s26.

La troisième revue (après `8b1346f`) a relevé deux défauts de cette limitation : le comptage n'est pas atomique, et
l'IP est lue dans la première entrée de `x-forwarded-for`, que le client fournit. Le product owner a tranché le même jour
pour **une règle plus simple**, qui remplace celle des tâches 10 (tâche 11) :

- **Un compteur par adresse et par jour**, en base : une ligne par association, empreinte HMAC de l'adresse et date du
  jour (Europe/Paris). Le changement de jour remet le compteur à zéro sans tâche planifiée ; les lignes des jours passés
  sont purgées à chaque demande.
- **3 demandes par adresse et par jour** par défaut, réglage d'association `login.link_requests_per_address_per_day`
  (ADR 010, ADR 016). Les adresses inconnues sont comptées aussi (aucune énumération par le moment où la limite joue).
- **Comptage atomique** en une requête (insertion ou incrément, puis valeur rendue), sans verrou applicatif.
- **Plus aucune limite par accès internet** : ni lecture d'IP, ni réglage réseau, ni hypothèse sur le proxy.
- Compromis accepté : un tiers peut épuiser les 3 demandes d'un membre pour la journée ; l'écran B renvoie déjà vers le
  bureau. Si tous les membres épuisaient leurs demandes le même jour, le plafond Brevo serait dépassé : jugé improbable.
- **Hors s03** : le budget quotidien global et le **basculement vers un transport de secours gratuit** au-delà des
  300 envois/jour relèvent de **s26** ; le prestataire de secours sera désigné par le product owner à ce moment-là
  (Resend n'est pas retenu pour ce rôle).

Les tâches 9 et 10 sont déjà faites (commits `2c8ea4d`, `8b1346f`) : l'amendement les inscrit au plan. La tâche 11 reste
à faire.

### Taille de la story

**11 tâches**, au-dessus du seuil de dix : dépassement accepté, les tâches 9 à 11 corrigent la story livrée plutôt
qu'elles n'ouvrent un nouveau périmètre fonctionnel.

## Tasks (ordered)

1. [x] **Contrat `EmailTransport` et ses transports.** `src/lib/emails/transport/` : type `EmailTransport`
       (`send(message): Promise<void>`, erreur typée `EmailTransportError`), `createBrevoTransport` (`fetch`, en-tête
       `api-key`, corps `sender`/`to`/`subject`/`htmlContent`/`textContent`), `createResendTransport` (seul fichier à
       importer `resend`), `createFileTransport(dir)`, `createMemoryTransport()`, et `getEmailTransport()` selon
       `EMAIL_TRANSPORT`. Variables `EMAIL_TRANSPORT`, `BREVO_API_KEY`, `EMAIL_OUTBOX_DIR` dans `env-schemas.ts`, `env.ts`,
       `env.example`, `scripts/init-env.ts` ; `RESEND_API_KEY` rendue **facultative** (exigée seulement pour
       `EMAIL_TRANSPORT=resend`) ; CI : `EMAIL_TRANSPORT=file`. `email-service.ts` n'appelle plus que le contrat (`text`
       toujours fourni, §5). **Tests** : requête Brevo exacte (`fetch` mocké), réponse non-2xx → `EmailTransportError` ;
       adaptateur Resend (SDK mocké) ; fichier écrit dans le répertoire ; choix du transport et clé exigée selon
       l'environnement ; `email-service` envoie par le transport (mémoire) ; aucun import de `resend` hors de son
       adaptateur.
2. [x] **Gabarit de l'email de connexion.** `src/lib/emails/theme.ts` (hex §5.3 + six triplets §1.2) ;
       `MagicLinkMail({url, association: {name, logoUrl, hue}})` refait selon la planche D : 600 px, tables, styles en
       ligne, un seul bouton « Ouvrir mon espace » + URL en clair, pied transactionnel, `alt` = nom ; objet
       « {nom} — votre lien de connexion », pré-en-tête et version texte ; libellés `messages/{fr,en,es}.json`
       (`email.user.magicLink`). **Tests** (rendu `react-email`) : logo présent quand `logoUrl` fourni, nom seul sinon ;
       URL en clair présente ; un seul lien d'action ; aucune couleur OKLCH ni variable CSS ; triplet de la teinte
       donnée.
3. [x] **Configuration du lien magique.** `magicLink({expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS, disableSignUp: true,
 sendMagicLink})` ; `sendMagicLink` réécrit : utilisateur inconnu → **rien** ; connu → contexte de l'association
       du domaine de la requête (`ctx`, tenant par domaine, logo PNG ou non, teinte via le DAL des réglages) →
       `sendMagicLinkEmailService` (plus de notification). **Tests** (`magic-link-integration.test.ts` étendu) : inconnu →
       transport jamais appelé ; connu → transport appelé avec l'URL, le nom, le logo PNG ; logo WebP → pas de logo ;
       options du plugin (20 min, `disableSignUp`) vérifiées.
4. [x] **Action de demande de lien.** `requestMagicLinkAction` dans `(auth)/action.ts` (remplace
       `loginMagicLinkAction`) : validation zod de l'adresse (`rule-zod-client-server-internationalization`),
       `auth.api.signInMagicLink({body: {email, callbackURL: '/dashboard', errorCallbackURL: '/login/lien-invalide'}})`,
       plancher de durée, résultat **identique** pour une adresse connue ou non, `EmailTransportError` → résultat
       « service en panne » (jamais levée). **Tests** : même résultat connu / inconnu ; durée ≥ plancher dans les deux cas
       (horloge simulée) ; panne du transport → état dédié ; adresse invalide → erreur de champ.
5. [x] **Écrans A et B.** `/login` : composant client `MagicLinkLogin` (react-hook-form + zod, validation au _blur_ puis
       à l'envoi) ; vue A (champ unique, bouton pleine largeur, encart courrier, état chargement à largeur conservée,
       `alert` ancrée « service en panne ») ; vue B (texte conditionnel, « Rien n'arrive ? » en trois étapes, deux causes,
       « Renvoyer un lien » désactivé 60 s avec compte à rebours écrit, `alert` neutre « renvoyé », « Corriger l'adresse »).
       Layout `(auth)` : en-tête `AssociationMark` taille `public` du tenant ; lien « Accès prestataire ». Libellés i18n.
       **Tests de composant** : vues et états du design ; aucune donnée d'adresse dans l'URL ; bouton de renvoi désactivé
       puis actif (horloge simulée) ; texte B identique quelle que soit l'adresse.
6. [x] **Écran C et accès prestataire.** `/login/lien-invalide` (écran C, un seul état, bouton → `/login`) ;
       `/login/prestataire` porte le formulaire par mot de passe existant (`LoginForm` en mode identifiants), sans
       inscription ni lien magique ; helpers de connexion des specs e2e (`auth`, `authorization`,
       `association-identity`, `association-settings`, `smoke-authenticated`, `tenant-isolation`, `styles`) pointés vers
       `/login/prestataire`. **Tests de composant** : écran C (texte, bouton) ; page prestataire (champ mot de passe
       présent).
7. [x] **Preuve de bout en bout.** CI : `EMAIL_TRANSPORT=file`, `EMAIL_OUTBOX_DIR` jetable. Spec `e2e/magic-link.spec.ts`
       sur `localhost` : adresse connue (`user-owner@gmail.com`) → écran B, un message dans la boîte de sortie, lien
       ouvert → session (page authentifiée) (1) ; même lien rouvert → écran C (2) ; lien dont l'échéance est reculée en base
       au-delà de 20 min → écran C (3) ; adresse inconnue → même écran B, **aucun** message, **aucun** compte créé en base
       (4) ; le message porte le nom de l'association (TechCorp n'a pas de logo PNG au seed) et l'en-tête à son triplet
       (6). Critère 5 prouvé en unitaire (tâches 1, 3) et par la boîte de sortie du transport de test en e2e.
8. [x] **Documentation.** `docs/architecture.md` (contrat `EmailTransport`, quatre transports, variables, ADR 017) ;
       `.claude/rules/02-services/rule-email-service.md` et `rule-service-emails-internationalization.md` (fournisseur direct → contrat `EmailTransport`, Brevo en production, Resend en secours) ;
       `docs/design-system.md` (§5.4 pied transactionnel, §9 retrait de « Erreur du service d'email », téléphone du bureau
       signalé) ; `README.md` si les variables d'environnement y figurent. **Vérification finale** : `pnpm lint`,
       `pnpm check:rules`, `pnpm test --run` verts ; e2e vert en CI sur la PR (pas de Chromium dans le conteneur).
9. [x] **Révocation de l'ancien lien et fermeture du point d'accès HTTP direct.** `sendMagicLink` supprime, avant l'envoi,
       les jetons en attente de l'adresse (adaptateur Better Auth) ; `auth.ts` : `disabledPaths: ['/sign-in/magic-link']`.
       Façades chargées par `import()` à l'appel dans `magic-link-integration.ts` (plus de cycle d'import statique).
       **Tests** : contrat Better Auth réel (deux demandes → le premier lien refusé, le second ouvre la session ; les liens
       d'une autre adresse intacts ; POST HTTP direct → 404, appel serveur et vérification HTTP ouverts) ; garde sur le
       graphe d'imports ; e2e (révocation, 404).
10. [x] **Limitation des demandes de lien.** Modèle `rate_limit_event` + migrations générées (0008, 0009 RLS forcée,
        commit séparé) ; repository (`getDb()`), service (`withTenant`, empreintes HMAC, fenêtre d'une heure, purge
        24 h), validation, façade, intercepteur sans arguments journalisés ; deux réglages au registre (libellés fr/en/es) ;
        `sendMagicLink` : association → quota (adresse et accès) → utilisateur → révocation → envoi. **Tests** : service
        (rôle PUBLIC, repositories mockés : seuils par défaut et réglés, fenêtre, purge, casse, empreintes par
        association, rien en clair) ; intégration (adresse inconnue comptée, seuil atteint sans email ni révocation) ;
        registre ; e2e (seuil atteint → même écran B sans email ; isolation croisée de `rate_limit_event`).
11. [x] **Limitation simplifiée : 3 demandes par adresse et par jour.** Nouvelle migration **générée**
        (`pnpm db:generate`, jamais écrite à la main ; 0008 et 0009 ne sont pas réécrites) qui fait de
        `rate_limit_event` un compteur journalier (`organization_id`, empreinte, jour, compte ; unicité sur les trois
        premiers ; RLS forcée conservée — la migration RLS se refait en `--custom` si la table est recréée) ; repository :
        incrément atomique `insert … on conflict … do update … returning` et purge des jours passés ; service : jour
        Europe/Paris, seuil lu dans le réglage ; registre : `login.link_requests_per_address_per_day` (défaut 3, bornes 1–20,
        libellés fr/en/es) remplace les deux réglages horaires ; `magic-link-integration.ts` : plus de lecture d'IP
        (`requestIpOf` supprimé) ; docs (`docs/architecture.md`, design s03 état « Seuil atteint »). **Tests** : service
        (rôle PUBLIC, repositories mockés : 3 passent, la 4ᵉ est refusée, nouveau jour → remis à zéro, casse de l'adresse,
        empreintes par association, rien en clair, purge) ; repository appelé en une seule requête d'incrément ;
        intégration (seuil atteint → ni email ni révocation ; adresse inconnue comptée) ; registre ; e2e (4ᵉ demande →
        même écran B, pas d'email ; isolation croisée de la table).

## Files touched

**Créés**

- `src/lib/emails/transport/` (contrat, `brevo`, `resend`, `file`, `memory`, sélection) (+ tests)
- `src/lib/emails/theme.ts` (+ test)
- `src/components/features/auth/magic-link-login.tsx` (+ test), composant de l'écran C (+ test)
- `src/app/[locale]/(auth)/login/prestataire/page.tsx`, `src/app/[locale]/(auth)/login/lien-invalide/page.tsx`
- `e2e/magic-link.spec.ts`
- Amendement : `src/db/models/rate-limit-model.ts`, `drizzle/migrations/0008_*`, `0009_rate_limit_event_rls.sql`
  (+ snapshots), `src/db/repositories/rate-limit-repository.ts`, `src/services/rate-limit-service.ts` (+ test),
  `src/services/validation/rate-limit-validation.ts`, `src/services/facades/rate-limit-service-facade.ts` et son
  intercepteur, `src/lib/better-auth/magic-link-integration-imports.test.ts`

**Modifiés**

- `src/services/email-service.ts` (+ test), `src/lib/emails/magic-link-email.tsx`
- `src/lib/better-auth/auth.ts`, `src/lib/better-auth/magic-link-integration.ts` (+ test)
- `src/app/[locale]/(auth)/action.ts`, `src/app/[locale]/(auth)/layout.tsx`, `src/app/[locale]/(auth)/login/page.tsx`,
  `src/components/features/auth/forms/login.tsx`
- `src/env-schemas.ts`, `src/env.ts`, `env.example`, `scripts/init-env.ts`
- `.github/workflows/ci.yml` (`EMAIL_TRANSPORT`, `EMAIL_OUTBOX_DIR`)
- `messages/fr.json`, `messages/en.json`, `messages/es.json`
- specs e2e existantes (helpers de connexion seulement)
- `docs/decisions/017-resend-conserve-comme-transport.md` (déjà écrit)
- `docs/architecture.md`, `docs/design-system.md`, `.claude/rules/02-services/rule-email-service.md`,
  `.claude/rules/02-services/rule-service-emails-internationalization.md`
- `docs/plans/s03-connexion-lien-magique.md` (cases cochées au fil de l'eau)
- Amendement : `src/services/types/domain/association-settings-types.ts` (deux réglages) et son test,
  `.cursor/rules/02-services/*.mdc` (régénérés par `pnpm check:rules:fix`)

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : transports (1), gabarit (2), `sendMagicLink` et options du plugin (3),
  action et plancher de durée (4), composants des écrans A/B et C (5, 6). Le transport `memory` prouve le critère 5.
- **Bout en bout (Playwright, CI)** : `e2e/magic-link.spec.ts` sur les critères 1, 2, 3, 4 et 6, en lisant la boîte de
  sortie du transport `file` ; l'expiration se provoque en reculant l'échéance du jeton en base (pas d'attente de
  20 minutes).
- **Amendement** : contrat Better Auth réel sur adaptateur mémoire pour la révocation et `disabledPaths` ; service de
  limitation en unitaire (repositories mockés) ; RLS de `rate_limit_event` prouvée en e2e (test croisé), pas en unitaire.
- **Non-régression** : toutes les specs existantes passent par `/login/prestataire` ; `e2e/auth.spec.ts` couvre
  toujours le mot de passe et l'inscription existante.

## Definition of Done

- Les 6 critères couverts (1-4 et 6 en e2e, 5 en unitaire et par le transport de test).
- **Aucun appel direct à un fournisseur d'email** : tout envoi passe par `EmailTransport` ; `resend` n'est importé que par
  son adaptateur (ADR 017).
- Aucune inscription par lien magique (`disableSignUp`) ; aucun email pour une adresse inconnue ; même écran et même
  plancher de durée dans les deux cas.
- Aucune adresse email dans une URL ; aucun jeton journalisé.
- Un seul lien valide par adresse à la fois ; aucune demande de lien possible hors de la server action ; demandes
  limitées à 3 par adresse et par jour (réglage d'association), en base, atomiquement ; `rate_limit_event` isolée par RLS forcée (test croisé).
- Écrans conformes au design validé, ordinateur et mobile ; aucun composant hors design system ; rien d'important dans un
  toast ; email conforme à §5 (hexadécimal, tables, URL en clair).
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` verts ; e2e vert en CI.
- Un commit de story (recherche, design, plan compris) ; revue `/ks-review` avec `Ship allowed: yes` avant `/ks-ship`.
