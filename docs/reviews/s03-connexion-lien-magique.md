# Revue : story s03-connexion-lien-magique (cinquième passe, après `082dc2a`)

> Revue faite à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
>
> **Diff relu** : `git diff main...feature/s03-connexion-lien-magique`, soit 10 commits. L'examen porte surtout sur `082dc2a` (15 fichiers, +348/−51) : la locale de l'email de connexion.
>
> **Références** :
>
> - `docs/plans/s03-connexion-lien-magique.md` (validated: yes) ;
> - AGENTS.md et ADR 001 à 017, dont l'ADR 008 ;
> - la quatrième passe (`4a4e4df`).
>
> **Contexte** : l'e2e de la CI a échoué sur `e2e/magic-link.spec.ts:278`. L'objet de l'email était en anglais (« your sign-in link »). `082dc2a` rend la locale explicite de bout en bout pour corriger ce défaut.
>
> **État de l'arbre** : le relecteur n'a rien modifié. `git status` est propre à la fin, et rien n'a changé sous `drizzle/migrations/meta`. La sonde décrite plus bas vit uniquement dans le scratchpad, hors du dépôt.

## Conformité au plan

- [x] Les tâches 1 à 11 sont faites. Les passes précédentes l'ont établi, et `082dc2a` n'y touche pas.
- [ ] **Le correctif `082dc2a` n'apparaît pas dans le plan.** Aucune tâche ni aucun amendement ne mentionne la locale explicite, la nouvelle forme de `sendMagicLinkEmailService` (paramètre `locale`) ou l'exception ajoutée à la règle. C'est un constat mineur de processus.
- [x] Le correctif ne sort pas de son sujet. Il modifie le formulaire, l'action, l'intégration, le service, le gabarit, le helper, les tests et la règle.

## Anti-hallucination

- [x] **Better Auth 1.7.1 accepte bien `metadata` et le transmet.** Vérifié dans `node_modules/better-auth/dist/plugins/magic-link/index.mjs` :
  - l. 18 : `metadata: z.record(z.string(), z.any()).optional()` dans `signInMagicLinkBodySchema` ;
  - l. 74 : `const { email, metadata } = ctx.body` ;
  - l. 93-98 : `options.sendMagicLink({email, url, token, metadata}, ctx)`.
  - Le type public (`index.d.mts:39`) déclare `metadata?: Record<string, any>`. Le test d'intégration réel (`magic-link-integration.test.ts`, via `localAuth.api.signInMagicLink` et le body `metadata`) le confirme.
- [x] **`hasLocale` existe** (`use-intl/core`, réexporté par les entrées client et react-server de `next-intl`). `routing.locales` vaut bien `['en','fr','es']`.
- [ ] **CRITIQUE : la locale explicite est ignorée par `src/i18n/request.ts`. Le correctif ne corrige donc pas le défaut que la CI a trouvé.**
  - **Ce que fait next-intl 4.13.5.** Dans `dist/esm/development/server/react-server/getConfig.js`, `getTranslations({locale})` appelle `getConfig(locale)`. Celui-ci passe `{locale: localeOverride, requestLocale}` à la fonction de `getRequestConfig`, puis **utilise la `locale` et les `messages` que cette fonction rend**. Le type `GetRequestConfigParams` (`dist/types/server/react-server/getRequestConfig.d.ts`) le dit : la locale explicite « will be passed via `locale` to `getRequestConfig` **so you can use it** ». C'est au projet de la lire.
  - **Ce que fait le projet.** `src/i18n/request.ts` (non modifié) ignore le paramètre : `getRequestConfig(async () => …)`. Il lit `rootParams.locale()`, qui lève dans une Server Action. Il retombe alors sur le cookie `NEXT_LOCALE`, sinon sur `routing.defaultLocale` (`en`), et rend `en` avec `messages/en.json`.
  - **Vérifié par une sonde exécutée.** Vitest dans le scratchpad, avec la **vraie** entrée react-server de `next-intl/server`, `next-intl/config` aliasé sur le vrai `src/i18n/request.ts`, `next/root-params` qui lève (cas d'une Server Action) et des cookies vides :

    ```
    getTranslations({locale: 'fr', namespace: 'email.user.magicLink'})('subject', …)
    → "ASL — your sign-in link"
    getTranslations({locale: 'es', …}) → "ASL — your sign-in link"
    ```

  - **Conséquences.**
    - L'email de connexion part toujours en anglais pour un navigateur neuf. L'objet, le texte et le corps sont tous touchés.
    - Seul `<Html lang={locale}>` suit la locale, d'où un HTML `lang="fr"` au contenu anglais.
    - L'erreur de champ serveur de `requestMagicLinkAction` est touchée de la même façon.
    - L'e2e `magic-link.spec.ts:278` échouera de nouveau en CI.
  - **Pourquoi les tests unitaires sont verts.** Ils ne passent jamais par `request.ts` : `getTranslations` y est remplacé par `getTranslationsWithoutLocaleCookie` (`src/__tests__/translations-without-locale-cookie.ts`). Ce double **affirme** reproduire `request.ts` (« Une locale explicite est servie telle quelle »), ce qui est faux pour le vrai `request.ts`. Le cas « sans locale → `defaultLocale` » est bien simulé. Le cas « locale explicite » est inventé. C'est un filet de sécurité halluciné.
  - **Pistes de correction** (le relecteur ne corrige pas) :
    - dans `request.ts`, lire `params.locale` d'abord (`getRequestConfig(async ({locale}) => …)`), vérifié par `hasLocale`, puis seulement root-params et le cookie. Déstructurer `locale` ne touche pas l'accesseur `requestLocale`, que le commentaire du fichier interdit de résoudre ;
    - ajouter un test qui passe par le vrai `getTranslations` et le vrai `request.ts`, comme la sonde, et non par un double écrit à la main.
- [x] Les commentaires et le message de commit décrivent fidèlement le chemin (formulaire → action → metadata → `sendMagicLink` → service → gabarit). Seule leur prémisse sur next-intl est fausse (voir ci-dessus).

## Conformité aux règles

- [x] **Locale fournie par le client : validée des deux côtés, sans injection.**
  - `resolveSupportedLocale` n'accepte qu'une `string` présente dans `routing.locales`. Sinon il rend `fr`.
  - Les tests couvrent `'../fr'`, un tableau, `null`, `''` et un objet muni de `toString`.
  - L'action valide la locale, puis `sendMagicLink` la revalide.
  - Aucune valeur non vérifiée n'atteint `messages/${locale}.json`, puisque `request.ts` n'utilise même pas la locale. Aucune voie de plantage.
  - La route HTTP `/sign-in/magic-link` reste fermée (`disabledPaths`) : `metadata` ne vient que de l'action.
- [x] **Pas de régression d'énumération ni de timing.**
  - La locale est résolue de façon synchrone avant la validation, de la même façon pour une adresse connue ou inconnue.
  - `metadata` ne change aucune branche de `sendMagicLink` (domaine → quota → compte).
  - Le plancher de 1,5 s est inchangé.
- [x] **Garde sur les imports paresseux** : `magic-link-integration-imports.test.ts` reste vert. `locale-helper` n'importe que `next-intl` et `@/i18n/routing`, déjà importés par `src/proxy.ts`. Le build de production est vert.
- [x] **ADR 008 et 010.** `PRODUCT_LOCALE = 'fr'` est cohérent avec l'ADR 008, et sa justification hors ADR 010 est écrite. `en` et `es` restent acceptés tant que le routage les sert, ce qui est cohérent (l'application de l'ADR 008 au routage est hors périmètre).
- [ ] **Exception ajoutée à `rule-service-emails-internationalization.md` : cohérente dans son principe, fausse dans sa recette.** Elle présente `getTranslations({locale, namespace})` comme suffisant, alors que sans lecture de `params.locale` dans `request.ts` ce n'est pas le cas. Elle fait partie du constat critique : à corriger avec lui. `check:rules` passe, et la copie `.cursor` est alignée.
- [x] Design system : aucun changement visuel. Le formulaire envoie un champ caché de plus, par `FormData`, sans nouveau composant.

## Tests et vérifications, lancés par le relecteur

- [x] `pnpm test --run` : **69 fichiers passent, 2 sont ignorés ; 795 tests passent, 8 sont ignorés.** Code 0.
- [x] `pnpm build` : exit 0, et `/sitemap.xml` est prérendu. Le seul avertissement Turbopack existait déjà.
- [x] `pnpm exec tsc --noEmit` : 0 erreur.
- [x] `pnpm lint` : 0 erreur. Le seul avertissement vient de `.remember/tmp/last-ndc.ts`, hors du diff.
- [x] `pnpm check:rules` : « Règles et documentation alignées sur le code ».
- [ ] `prettier --check` sur les fichiers de `082dc2a` : 5 fichiers en écart.
  - Trois l'étaient déjà : `magic-link-login.test.tsx`, `magic-link-email.test.tsx` et `email-service.test.tsx`.
  - `magic-link-login.tsx` et `magic-link-email.tsx` font partie des 8 déjà signalés. `082dc2a` y ajoute deux lignes de plus de 80 colonnes : `requestAction({status: 'idle'}, toFormData(email, locale))`.
- [ ] **Les assertions ne fixent pas le critère réel.** Les nouveaux cas « sans cookie de locale » réussiraient avec l'implémentation actuelle, qui est cassée en production :
  - `action.test.ts`, erreur de champ ;
  - `magic-link-integration.test.ts`, « écrit l'email dans la locale de la page… » ;
  - `email-service.test.tsx` et `magic-link-email.test.tsx`.

  Ce point fait partie du constat critique.

- [x] **Le `beforeAll` de préchauffage est légitime.** `sendMagicLink` charge ses façades par `import()` au premier appel (`loadServices`). Le préchauffage paie ce coût hors du délai de 5 s. La « promesse orpheline » décrite était la suite du dépassement de délai du test, pas une fuite du code de production. Une fois le module en cache, il n'y a plus d'appel pendant entre deux tests.
- **E2E non exécutés** : le conteneur n'a pas Chromium. D'après l'analyse ci-dessus, `magic-link.spec.ts:278` devrait échouer de nouveau.

## Régressions

- [x] `locale-helper.ts` est aussi importé par `src/proxy.ts`, `lang-toggle.tsx` et `user-preferences-sync.tsx`. L'ajout de `hasLocale` et `routing` n'y change rien, et le build et les tests sont verts.
- [x] Le seul appelant de `sendMagicLinkEmailService` est `magic-link-integration.ts`. Le nouveau paramètre obligatoire `locale` est fourni, et `tsc` est vert.
- **Pour mémoire, hors constat s03** : les autres emails envoyés hors rendu de page gardent l'appel implicite et partent aussi en anglais sans cookie. Ce sont la réinitialisation du mot de passe, la vérification, l'invitation d'organisation, le changement d'email, l'OTP et les emails Stripe. Le diff ne les aggrave pas, et la règle le dit.

## Constats

### Nouveau (`082dc2a`)

- **critique** — `src/i18n/request.ts` (non modifié), `src/services/email-service.ts:209`, `src/lib/emails/magic-link-email.tsx:71`, `src/app/[locale]/(auth)/action.ts:213` :
  - `getTranslations({locale, namespace})` est sans effet, parce que `getRequestConfig` ignore `params.locale` et rend `en` depuis une Server Action sans cookie ;
  - l'email de connexion reste en anglais, et l'échec CI n'est pas corrigé ;
  - vérifié en exécutant le vrai next-intl 4.13.5 contre le vrai `request.ts`.
- **critique (même cause, côté tests)** — `src/__tests__/translations-without-locale-cookie.ts` :
  - ce double prétend reproduire `request.ts` mais honore la locale explicite, ce que le vrai `request.ts` ne fait pas ;
  - les nouveaux tests « sans cookie de locale » sont donc un filet halluciné ;
  - l'exception ajoutée à `rule-service-emails-internationalization.md` (et à sa copie `.cursor`) documente la même recette incomplète.
- **mineur** — Le plan ne mentionne pas le correctif de locale : aucune tâche ou note d'amendement, ni les fichiers `locale-helper.ts` et `translations-without-locale-cookie.ts` dans « Files touched ».
- **mineur** — Formatage : deux lignes de plus de 80 colonnes ajoutées dans `magic-link-login.tsx` (appels à `toFormData(email, locale)`), s'ajoutant au constat Prettier existant.

### Constats des passes antérieures, toujours ouverts (mineurs)

- **mineur** — Deux demandes concurrentes pour la même adresse peuvent se révoquer l'une l'autre (`revokeEarlierMagicLinks`).
- **mineur** — La purge des compteurs ne s'exécute qu'à une demande ultérieure de la même association. Le « purgé sous 24 h » n'est donc pas strictement tenu (piste : `scheduled_job`, ADR 006).
- **mineur** — Le registre n'a pas de `whenEmptyKey` pour `login.link_requests_per_address_per_day`.
- **mineur** — 8 fichiers `src` du diff ne passent pas `prettier --check`.
- **mineur** — Le cadre de `(auth)/layout.tsx` dégrade `register`, `auth-error`, `verify-request/recovery` et `loading`.
- **mineur** — `registerMagicLinkAction` est une impasse silencieuse avec `disableSignUp`, et elle consomme le quota.
- **mineur** — `requestMagicLinkAction` ne vérifie pas `NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`.
- **mineur** — Écart au plan dans `e2e/auth.spec.ts` : le test « login pages do not offer sign-up » en remplace un autre.
- **mineur** — Test tautologique « même résultat, adresse connue ou non » (`action.test.ts`).
- **mineur** — Expéditeur par défaut `onboarding@resend.dev`.
- **mineur** — Code mort `magic_link` dans `notification-service.ts`.
- **mineur** — Au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».
- **mineur n° 1** — Phrases périmées dans le plan : l. 35, l. 110-111, l. 228, et « Files touched » incomplet.
- **mineur n° 2** — `0010_long_baron_zemo.sql:2` ajoute `day date NOT NULL` sans valeur par défaut. Cela ne touche qu'une base intermédiaire.
- **mineur n° 3** — Trous de test : minuit en heure d'hiver et au changement d'heure ; scope tenant de la purge.
- **mineur n° 4** — L'aide du réglage n'indique ni la valeur par défaut (3) ni le compromis accepté.

## Verdict

Le raccordement Better Auth est réel : `metadata` est accepté et transmis, et la locale est bien validée des deux côtés, sans voie d'injection ni régression d'énumération. Tests, build, `tsc`, lint et `check:rules` sont verts.

Mais le correctif repose sur une hypothèse fausse sur next-intl. Une locale passée à `getTranslations` n'est prise en compte que si `src/i18n/request.ts` lit `params.locale`, et ce n'est pas le cas. Exécuté contre le vrai code, l'objet reste « your sign-in link » pour `fr` comme pour `es`. Les tests ne le voient pas parce qu'ils remplacent `request.ts` par un double qui fait ce que le vrai ne fait pas. Le défaut trouvé par la CI est intact, et l'e2e devrait échouer de nouveau.

À faire en mode correctif :

1. Lire `params.locale` dans `request.ts`, avec `hasLocale`.
2. Tester le chemin réel `getTranslations` → `request.ts`, sans double pour ce cas.
3. Ajuster la recette de l'exception dans la règle.
4. Amender le plan.

Max severity: critical
Ship allowed: no
