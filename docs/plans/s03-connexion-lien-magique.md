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
- Contrat `EmailTransport` + implémentation Brevo (ADR 005). **Budget quotidien : s26**, pas ici.
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

### Taille de la story

**8 tâches**, sous le seuil de dix : pas de scission supplémentaire.

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

## Files touched

**Créés**

- `src/lib/emails/transport/` (contrat, `brevo`, `resend`, `file`, `memory`, sélection) (+ tests)
- `src/lib/emails/theme.ts` (+ test)
- `src/components/features/auth/magic-link-login.tsx` (+ test), composant de l'écran C (+ test)
- `src/app/[locale]/(auth)/login/prestataire/page.tsx`, `src/app/[locale]/(auth)/login/lien-invalide/page.tsx`
- `e2e/magic-link.spec.ts`

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

## Test strategy

- **Unitaire (Vitest, `pnpm test --run`)** : transports (1), gabarit (2), `sendMagicLink` et options du plugin (3),
  action et plancher de durée (4), composants des écrans A/B et C (5, 6). Le transport `memory` prouve le critère 5.
- **Bout en bout (Playwright, CI)** : `e2e/magic-link.spec.ts` sur les critères 1, 2, 3, 4 et 6, en lisant la boîte de
  sortie du transport `file` ; l'expiration se provoque en reculant l'échéance du jeton en base (pas d'attente de
  20 minutes).
- **Non-régression** : toutes les specs existantes passent par `/login/prestataire` ; `e2e/auth.spec.ts` couvre
  toujours le mot de passe et l'inscription existante.

## Definition of Done

- Les 6 critères couverts (1-4 et 6 en e2e, 5 en unitaire et par le transport de test).
- **Aucun appel direct à un fournisseur d'email** : tout envoi passe par `EmailTransport` ; `resend` n'est importé que par
  son adaptateur (ADR 017).
- Aucune inscription par lien magique (`disableSignUp`) ; aucun email pour une adresse inconnue ; même écran et même
  plancher de durée dans les deux cas.
- Aucune adresse email dans une URL ; aucun jeton journalisé.
- Écrans conformes au design validé, ordinateur et mobile ; aucun composant hors design system ; rien d'important dans un
  toast ; email conforme à §5 (hexadécimal, tables, URL en clair).
- `pnpm lint`, `pnpm check:rules`, `pnpm test --run` verts ; e2e vert en CI.
- Un commit de story (recherche, design, plan compris) ; revue `/ks-review` avec `Ship allowed: yes` avant `/ks-ship`.
