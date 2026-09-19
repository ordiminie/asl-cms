# Revue : story s03-connexion-lien-magique (deuxième passe, après `e8bf405`)

> Revue à contexte neuf. Chaque problème est classé critique, majeur ou mineur.
> Diff relu : `git diff main...feature/s03-connexion-lien-magique`, soit 3 commits (`1218a2e`, `5cb5157`, `e8bf405`) et 71 fichiers. L'examen porte surtout sur `e8bf405`.
> Références : `docs/plans/s03-connexion-lien-magique.md` (validated: yes), AGENTS.md, ADR 001 à 017, `docs/design-system.md`, `docs/designs/s03-connexion-lien-magique.md` et la revue précédente (première passe, commit `5cb5157`).
>
> Contexte : la première passe autorisait le ship (sévérité maximale majeure). La CI de la PR 16 a ensuite échoué au build de production sur `/sitemap.xml` (`Cannot access 'et' before initialization`), à cause d'un cycle d'import. `e8bf405` est le correctif.

## Conformité au plan

- [x] Le code fait ce que le plan demande. Les huit tâches sont traitées, comme l'a établi la première passe. `e8bf405` n'ajoute aucune fonction : il change la façon dont l'intégration Better Auth lit l'association, et il reformate le code. Ces deux points ne changent pas la couverture du plan.

## Examen de `e8bf405`

### Le cycle d'import est-il vraiment cassé ?

**Non, il est déplacé. Le build passe, mais le cycle statique existe toujours.** Un script jetable qui résout les imports `@/` et relatifs de `src/` montre qu'un cycle passe encore par l'intégration :

```
lib/better-auth/magic-link-integration.ts
 -> services/facades/association-settings-service-facade.ts
 -> services/facades/interceptors/association-settings-service-logger-interceptor.ts
 -> services/association-settings-service.ts   (importe auth-service)
 -> services/authentication/auth-service.ts
 -> lib/better-auth/auth.ts
 -> lib/better-auth/magic-link-integration.ts
```

La façade d'organisation forme le même cycle, par `organization-service`, puis `auth-service`, puis `auth`.

`createServiceInterceptor` parcourt l'espace de noms du service **au chargement du module** (`Object.entries(serviceMethods)`). Si un service de ce cycle est chargé en premier, la même erreur de zone morte temporelle (TDZ) peut revenir. Seul l'ordre d'évaluation décide, et plus rien ne le garantit.

Des cycles de ce type existaient déjà sur `main` :

- `auth.ts` importait déjà `organization-service-facade` ;
- l'intégration importait déjà `notification-service-facade`.

Le build de production passe donc aujourd'hui, mais la cause invoquée (« la DAL fermait le cycle ») n'est qu'en partie juste.

Le commentaire du code et le message de commit affirment que le cycle est rompu. Ils sont inexacts.

### Le comportement est-il inchangé ?

**Oui.** Chaque point a été vérifié :

- **Tenant résolu par le domaine appelé.** `requestOriginOf` n'a pas changé : `x-forwarded-host` passe avant `host`. `getOrganizationByDomainService` (`organization-service.ts:646`) est le service que `getTenantByDomainDal` appelait déjà. Le filtre `!organization?.domain` reprend exactement celui de la DAL.
- **Logo en PNG seul.** Le code lit `organization.identityLogoKey`, qui existe (`auth-model.ts:203`, `Organization = OrganizationModel`). Il garde la même garde `.endsWith('.png')`.
- **Teinte d'accent.** `getAssociationSettingsService` (`association-settings-service.ts:38`) est celui que la DAL enveloppait. Il ne contrôle aucune autorisation, ce qui est correct pour un visiteur anonyme, et il ouvre lui-même `withTenant`.
- **Rien n'est envoyé pour une adresse inconnue ou un domaine inconnu.** `sendMagicLink` n'a pas changé.
- **Seule différence : le `'use cache'` de la DAL est perdu.** Chaque demande de lien fait deux requêtes SQL de plus. C'est acceptable sur ce chemin, car il est rare et limité en débit.

### Les couches sont-elles respectées ?

**Oui.** `src/lib/better-auth` appelle des façades, jamais un service ni un repository directement. `auth.ts` suit déjà ce modèle avec `getOrganizationMembersService`. L'appel déjà présent à `getUserByEmailDao` n'a pas changé.

### Les tests ont-ils un sens ?

**En partie.** Les tests de comportement ont été repointés sur les façades et gardent leurs assertions : domaine appelé, `x-forwarded-host`, PNG, WebP, sans logo, domaine inconnu, journaux sans jeton.

Le nouveau test de garde vérifie seulement l'absence de la chaîne `@/app/dal/` dans le source :

- il **passe alors que le cycle existe toujours** ;
- il ne verrait pas un import relatif vers la DAL.

Il protège un indice, pas l'invariant. Les fixtures `tenant(...)` sont castées `as never`, ce qui masquerait une faute de nom de champ.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé. Chaque cible a été ouverte :
  - `getOrganizationByDomainService` et `getAssociationSettingsService` (façades et services) ;
  - le type `Organization` et `identityLogoKey` ;
  - `normalizeTenantHost`, `getIdentityVersionFromKey`, `getAccentHue`, `sendMagicLinkEmailService`.
- [ ] **Une affirmation plausible mais fausse** : « l'import de la DAL fermait un cycle […] » laisse entendre que le cycle est rompu (constat majeur n° 2).

## Conformité aux règles

- [ ] **`pnpm check:rules` échoue : régression introduite par `e8bf405`** (constat critique). Le commit reformate `.claude/rules/02-services/rule-email-service.md` et `rule-service-emails-internationalization.md` sans régénérer les copies `.cursor/rules/*.mdc`. Le job `quality` de la CI (`ci.yml:67`) lance `pnpm check:rules`. La PR tomberait donc de nouveau en rouge. La première passe avait vu `check:rules` vert.
- [x] Aucun ADR accepté n'est contredit (ADR 003, 005, 010, 017). Aucun `withRlsBypass` ajouté, aucun `process.env` hors `env.ts` (la spec e2e porte sa dérogation).
- [x] Le design system : sans changement depuis la première passe, conforme. `e8bf405` ne touche pas l'interface ; ses changements dans `docs/design-system.md` sont du formatage de tableaux.
- [x] Le reformatage de `e8bf405` hors de `src/lib` ne touche que la forme, vérifié avec `git show -w` : `e2e/magic-link.spec.ts`, `action.test.ts`, `layout.test.tsx`, docs.

## Tests et vérifications (lancés par le relecteur)

- [x] `pnpm test --run` : **66 fichiers passent, 2 sont ignorés ; 758 tests passent, 8 sont ignorés.** Le test de plus que la première passe est le test de garde.
- [x] `pnpm build` : **il passe (exit 0)**, `/sitemap.xml` est prérendu (○).
- [ ] L'échec n'a pas pu être reproduit sur `5cb5157`. Dans un worktree jetable, Turbopack refuse le lien symbolique vers `node_modules`. Le worktree a été supprimé, sans checkout en place, pour ne pas toucher l'arbre de travail. Le lien de cause à effet repose donc sur l'échec de la CI et sur le build vert d'aujourd'hui.
- [x] `pnpm lint` : 0 erreur. Le seul avertissement vient de `.remember/tmp/last-ndc.ts`, hors du diff.
- [x] `tsc --noEmit`, après le build qui a régénéré `.next/types` : 0 erreur.
- [ ] `prettier --check` sur les fichiers du diff : **9 fichiers ne sont pas formatés**, dont `magic-link-integration.test.ts`, que `e8bf405` a lui-même modifié (lignes de plus de 80 caractères). Le commit dit pourtant « reformatage Prettier ». Ce n'est pas vérifié par la CI (constat mineur).
- Les e2e n'ont pas été exécutés : le conteneur n'a pas Chromium. La CI les lancera.
- `git status` est propre à la fin de la revue.

## Régressions

- [ ] `check:rules` passe au rouge (constat critique). Aucun chemin métier n'est cassé ; les chemins touchés ont été relus (`auth.ts`, `tenant-dal`, `association-settings-dal`, les intercepteurs).

## Constats

### Nouveaux (`e8bf405`)

- **critique**. `.cursor/rules/02-services/rule-email-service.mdc` et `rule-service-emails-internationalization.mdc` : **ils divergent des règles `.claude` reformatées, et `pnpm check:rules` sort en code 1.**
  - C'est une étape bloquante du job `quality` de la CI, qui était verte avant ce commit.
  - Ce défaut est du même ordre que celui qui a motivé cette seconde passe : la CI serait rouge à l'ouverture de la PR.
  - Correctif : `pnpm check:rules:fix`, puis committer les deux `.mdc`.
- **majeur**. `src/lib/better-auth/magic-link-integration.ts`, avec le commentaire de `associationOfRequest` et le message de `e8bf405` : **le cycle d'import n'est pas rompu, seulement déplacé.**
  - Le cycle subsiste : `magic-link-integration`, puis `association-settings-service-facade` ou `organization-service-facade`, puis l'intercepteur (`Object.entries` au chargement), le service, `auth-service`, `auth` et de nouveau `magic-link-integration`.
  - Le build passe grâce à l'ordre d'évaluation actuel, que rien ne garantit.
  - Le test de garde (`magic-link-integration.test.ts`, qui cherche l'absence de `@/app/dal/`) passerait sur une version qui casse de nouveau.
  - Correctif durable, au choix :
    - (a) importer les façades de façon paresseuse dans `associationOfRequest` (`await import(...)`) ;
    - (b) injecter la résolution de l'association dans `magicLinkOptions` depuis un module qui n'est pas importé par `auth.ts` ;
    - (c) rendre `createServiceInterceptor` paresseux, c'est-à-dire envelopper à l'appel plutôt qu'au chargement.
  - Dans tous les cas, corriger le commentaire et remplacer la garde par une vérification de l'absence de cycle, par exemple un parcours du graphe d'imports depuis `magic-link-integration.ts`.
- **mineur**. `magic-link-integration.test.ts` et 8 autres fichiers du diff ne passent pas `prettier --check`, alors que le commit annonce un reformatage.
- **mineur**. `magic-link-integration.test.ts` : la fixture `tenant(...)` est castée `as never`. Une faute sur `identityLogoKey` ne serait pas vue par le typage. Mieux vaut `satisfies Partial<Organization>` ou un cast vers `Organization`.

### Constats de la première passe : tous encore valides, aucun corrigé

- **majeur** (ouvert). `POST /api/auth/sign-in/magic-link` reste exposé en HTTP direct. Il contourne le plancher de 1,5 s et permet de deviner si un compte existe. `disabledPaths` est absent de `auth.ts`.
- **majeur** (ouvert). `requestMagicLinkAction` n'a aucune limitation côté serveur, ni par adresse ni par IP. Le plafond Brevo de 300 envois par jour peut être épuisé.
- **majeur** (ouvert). `messages/fr.json:1004` (et `en`, `es`) : « Le précédent ne fonctionne plus » est toujours faux, car Better Auth ne révoque pas les jetons précédents.
- **mineur** (ouvert). Le cadre de `(auth)/layout.tsx` dégrade la mise en page de `register`, `auth-error`, `verify-request/recovery` et `loading`.
- **mineur** (ouvert). L'inscription par lien (`registerMagicLinkAction`) est une impasse silencieuse avec `disableSignUp`.
- **mineur** (ouvert). `requestMagicLinkAction` ne vérifie pas `NEXT_PUBLIC_AUTH_METHODS.includes('magiclink')`. La vérification n'existe que plus bas dans `action.ts:419`.
- **mineur** (ouvert). Écart au plan dans `e2e/auth.spec.ts` : un test est remplacé par « login pages do not offer sign-up ».
- **mineur** (ouvert). Le test tautologique « rend le même résultat, adresse connue ou non » dans `action.test.ts`.
- **mineur** (ouvert). L'expéditeur par défaut `onboarding@resend.dev` n'est pas adapté à Brevo en production.
- **mineur** (ouvert). Du code mort `magic_link` subsiste dans `notification-service.ts` (lignes 200 et 346).
- **mineur** (ouvert). Au renvoi, un résultat `invalid` affiche l'alerte « service en panne ».

## Verdict

Le correctif de `e8bf405` produit un build de production vert et ne change pas le comportement : même tenant, `x-forwarded-host`, PNG seul, teinte, rien envoyé pour une adresse ou un domaine inconnu. Il respecte aussi les couches.

Mais le même commit casse `pnpm check:rules`, une étape bloquante de la CI. La PR tomberait en rouge, comme lors du premier échec. Le correctif tient en une commande, mais il est obligatoire avant de livrer.

Le cycle d'import subsiste sous une autre forme (majeur).

Max severity: critical
Ship allowed: no
