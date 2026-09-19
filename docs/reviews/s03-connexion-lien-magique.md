# Revue : story s03-connexion-lien-magique

> Revue à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s03-connexion-lien-magique` (1 commit, `1218a2e`, 70 fichiers).
> Références : `docs/plans/s03-connexion-lien-magique.md` (validated: yes), AGENTS.md, ADR 001 à 017, `docs/design-system.md`, `docs/designs/s03-connexion-lien-magique.md`.

## Conformité au plan

- [x] Le code fait ce que le plan demande. Les deux écarts relevés sont mineurs (voir les constats).

J'ai comparé chaque tâche au code :

1. **Contrat `EmailTransport` : fait.** `src/lib/emails/transport/` contient `brevo` (`fetch` sur `https://api.brevo.com/v3/smtp/email`, en-tête `api-key`, corps `sender`/`to`/`subject`/`htmlContent`/`textContent`), `resend` (seul importeur du SDK), `file`, `memory`, ainsi que `getEmailTransport()`. Les variables sont déclarées dans `env-schemas.ts`, `env.ts`, `env.example` et `init-env.ts`. `RESEND_API_KEY` est devenue facultative et la CI passe en `EMAIL_TRANSPORT=file`. `sendEmailService` n'appelle plus que le contrat.
2. **Gabarit de l'email : fait.** `theme.ts` : les douze couleurs hexadécimales de §5.3 et les six triplets de §1.2 correspondent un à un au design system (vérifié en les cherchant dans le fichier). Le gabarit fait 600 px, en tables et styles en ligne, avec un seul bouton, l'URL en clair et le pied transactionnel. Le texte alternatif du logo est le nom de l'association.
3. **Configuration du lien : faite.** `magicLinkOptions = {expiresIn: 1200, disableSignUp: true, sendMagicLink}`. Pour une adresse inconnue, rien n'est envoyé. Pour une adresse connue : tenant résolu par le domaine, logo seulement s'il est en PNG, teinte lue par le DAL, puis `sendMagicLinkEmailService`. Le lien ne crée plus de notification.
4. **Action : faite.** `requestMagicLinkAction` applique le zod traduit, un plancher de 1,5 s, un résultat identique pour une adresse connue ou non, et l'état `unavailable` en cas d'échec.
5. **Écrans A et B : faits.** Voir la partie design.
6. **Écran C et `/login/prestataire` : faits.** Les helpers des sept specs e2e sont pointés vers `/login/prestataire`.
7. **Preuve de bout en bout : faite.** `e2e/magic-link.spec.ts` couvre les critères 1, 2, 3, 4 et 6 en lisant la boîte de sortie ; le jeton est vieilli en base.
8. **Documentation : faite.** `architecture.md`, les deux règles `.claude` et leurs copies `.cursor`, design system §5.4 et §9, README.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. J'ai ouvert chaque cible :
  - `getTenantByDomainDal` et `TenantDTO` (`src/app/dal/tenant-dal.ts`).
  - `getAssociationSettingsDal` (`association-settings-dal.ts`).
  - `normalizeTenantHost` (`tenant-helper.ts`).
  - `getIdentityVersionFromKey` (`association-identity-types.ts:178`).
  - `getAccentHue`, `isAccentHue`, `DEFAULT_ACCENT_HUE` (`association-settings-types.ts`).
  - `sendMagicLinkEmailService` dans la façade ; son intercepteur exclut bien la journalisation des arguments.
  - `AssociationMark` avec `size="public"`.
  - `render` de `react-email`.
  - Better Auth 1.7.1 (`node_modules/better-auth/dist/plugins/magic-link/index.mjs`) : les options `expiresIn`, `disableSignUp`, la signature `sendMagicLink(data, ctx)` et le `errorCallbackURL` du corps existent tels qu'utilisés. `new_user_signup_disabled` et `INVALID_TOKEN` redirigent bien vers l'`errorCallbackURL`.
- [ ] **Une logique plausible mais fausse** : la phrase « Le précédent ne fonctionne plus » (constat majeur n° 3).
- [x] Le code fait ce qu'il annonce, avec les réserves des constats majeurs n° 1 et 2 sur l'égalité de traitement et le renvoi.

## Conformité aux règles

- [x] Conventions du dépôt respectées :
  - aucun `process.env` hors `env.ts`, sauf dans la spec e2e, qui porte une désactivation eslint justifiée ;
  - libellés dans `messages/*.json` ;
  - aucun `withRlsBypass` ajouté ;
  - aucun jeton ni URL journalisé, ce qu'un test vérifie.
- [x] Aucun ADR accepté n'est contredit. ADR 005 est respecté, et ADR 017 (accepté) l'amende sur le seul maintien de Resend. Le test `provider-imports.test.ts` vérifie que seul l'adaptateur importe `resend`. ADR 003 : le tenant est résolu par le domaine, côté serveur. ADR 010 : les durées sont des constantes nommées, conformes aux arbitrages de la story.
- [x] Le design system est respecté :
  - composants `card`, `input` (h-14/sm:h-12, conforme aux 48/56 px), `button` `default`/`outline`/`link`, `alert` destructive et neutre avec `CircleCheck` en `primary` ;
  - icônes lucide avec un trait de 1.75 ; `AssociationMark` en en-tête ;
  - carte de 440 px (`max-w-110`) sur fond `muted` ;
  - aucun composant, token ni couleur hors du système ; rien d'important dans un toast.
  - Les manques du design sont tranchés comme le plan le prévoit : pas de téléphone du bureau, logo seulement en PNG.

## Tests

- [x] **J'ai lancé la suite moi-même** avec `pnpm test --run` : **66 fichiers passent, 2 sont ignorés ; 757 tests passent, 8 sont ignorés.**
  - `pnpm lint` : 0 erreur. Un seul avertissement, dans `.remember/tmp/last-ndc.ts`, un fichier hors du diff.
  - `pnpm check:rules` : vert.
  - `tsc --noEmit` sur `src`, `e2e` et `scripts`, en excluant `.next` qui masque les vraies erreurs : **0 erreur**.
  - Les e2e n'ont pas été exécutés : le conteneur n'a pas Chromium. Ils le seront par la CI sur la PR.
- [x] Les assertions vérifient réellement les critères :
  - les options du plugin sont vérifiées ;
  - un contrat Better Auth réel, sur adaptateur mémoire, montre le rejeu refusé, l'expiration et l'absence de compte créé ;
  - le transport mémoire reçoit l'email, avec le logo PNG ou le nom seul ;
  - le plancher est testé avec une horloge simulée ;
  - l'écran B est identique pour une adresse connue ou non, dans le composant comme en e2e ;
  - l'URL ne contient pas l'adresse.
  - Seule faiblesse : un test de l'action est tautologique (constat mineur).

## Régressions

- [ ] Deux effets de bord mineurs hors du périmètre de la story : la mise en page des autres pages `(auth)` et l'inscription par lien (voir les constats). Aucun chemin métier n'est cassé. Les connexions e2e par mot de passe passent par `/login/prestataire`.

## Constats

- **majeur**. `src/app/api/auth/[...all]/route.ts` (exposé tel quel) et `src/lib/better-auth/magic-link-integration.ts` : **le point d'accès HTTP direct `POST /api/auth/sign-in/magic-link` contourne le plancher de durée et permet de deviner si un compte existe.**
  - Le plancher de 1,5 s ne vit que dans la server action. Appelé directement (le client `magicLinkClient` l'expose), l'endpoint répond en une requête SQL pour une adresse inconnue. Pour une adresse connue, il répond après la résolution du tenant, le rendu et l'appel à Brevo, soit un écart de plusieurs centaines de millisecondes.
  - Il renvoie aussi une erreur (500) sur panne du transport **uniquement** pour une adresse connue.
  - Le critère 4 et §7 (« même temps de réponse ») restent vrais à l'écran, mais pas au niveau du service. L'écart est borné par la limite de Better Auth (5 requêtes par 60 s et par IP).
  - Correctif : fermer ce chemin HTTP avec `disabledPaths: ['/sign-in/magic-link']`. Le rate limiter et `disabledPaths` ne s'appliquent que dans `router.onRequest`, donc `auth.api` (la server action) continue de fonctionner. À défaut, déplacer le plancher dans `sendMagicLink`, qui est appelé dans les deux cas.
- **majeur**. `src/app/[locale]/(auth)/action.ts` (`requestMagicLinkAction`) : **aucune limitation côté serveur.**
  - `auth.api.signInMagicLink` ne passe pas par le rate limiter de Better Auth (`node_modules/better-auth/dist/api/index.mjs:168`, appliqué seulement au routeur HTTP).
  - Le délai de 60 s avant renvoi n'existe que côté client. Un script qui rejoue l'action peut inonder une adresse connue et épuiser le plafond Brevo de 300 envois par jour, que tous les emails partagent.
  - Le défaut existait déjà avec `loginMagicLinkAction` et le budget quotidien relève de s26. Mais la story met Brevo en production : il faut un plafond minimal par adresse et par IP, ou reporter explicitement ce point dans s26.
- **majeur**. `messages/{fr,en,es}.json`, clé `Auth.MagicLinkLogin.sent.resent` : **le texte « Le précédent ne fonctionne plus » est faux.**
  - Better Auth crée un nouveau jeton sans supprimer les précédents (`createVerificationValue` seul dans `signInMagicLink`). Les deux liens restent donc valides 20 minutes.
  - C'est une affirmation de sécurité inexacte montrée au membre, reprise du design sans vérification. Aucun test ne la prouve.
  - Correctif : corriger le libellé (et le design), ou supprimer les jetons en attente pour cette adresse avant d'en émettre un nouveau.
- **mineur**. `src/app/[locale]/(auth)/layout.tsx` : le nouveau cadre (en-tête `AssociationMark`, colonne de 440 px) enveloppe aussi `register`, `auth-error`, `verify-request/recovery` et `loading.tsx`. Ces pages gardent leur propre conteneur plein écran (`min-h-svh`, `lg:grid-cols-2`), dont la mise en page se dégrade à l'intérieur de la colonne.
- **mineur**. `register-magic-link-form.tsx` et `registerMagicLinkAction` (toujours présents) : avec `disableSignUp` et l'absence d'envoi pour une adresse inconnue, l'inscription par lien devient une impasse silencieuse. L'utilisateur est redirigé vers `/verify-request` et aucun email ne part. La page n'est plus liée, mais elle reste accessible.
- **mineur**. `requestMagicLinkAction` ne vérifie plus `NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`, contrairement à `loginMagicLinkAction`, qu'elle remplace.
- **mineur**. Écart au plan dans `e2e/auth.spec.ts` : le test « navigate from login to register » est remplacé par « login pages do not offer sign-up ». Le plan disait « sans changer leurs assertions ». C'est une conséquence cohérente du retrait du lien d'inscription (tâche 6), mais elle n'était pas prévue.
- **mineur**. `src/app/[locale]/(auth)/action.test.ts`, test « rend le même résultat, adresse connue ou non » : il est tautologique, puisque le mock de `signInMagicLink` est identique dans les deux cas. La distinction réelle est prouvée ailleurs (`magic-link-integration.test.ts` et l'e2e du critère 4).
- **mineur**. Expéditeur par défaut `onboarding@resend.dev` (`env-schemas.ts` `EMAIL_FROM` et `DEFAULT_EMAIL_FROM` dans `email-service.ts`) : il ne convient pas à Brevo, qui refuse un expéditeur non vérifié. Si `EMAIL_FROM` est oublié en production, toute demande de lien tombe dans l'état « service en panne ». À exiger en production, comme `EMAIL_TRANSPORT`.
- **mineur**. `src/services/notification-service.ts` : le type de notification `magic_link` et ses branches (lignes 200 et 346) sont devenus du code mort.
- **mineur**. `magic-link-login.tsx` (`SentView.resend`) : un résultat `invalid` au renvoi affiche l'alerte « service en panne ». C'est peu probable puisque l'adresse a déjà été validée.

## Verdict

Trois constats majeurs, aucun critique : le ship est autorisé. Les trois majeurs (endpoint direct, absence de limitation serveur, texte « Le précédent ne fonctionne plus ») sont à corriger au prochain cycle, idéalement avant d'activer Brevo en production.

Max severity: major
Ship allowed: yes
