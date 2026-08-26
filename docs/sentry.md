# Sentry — suivi des erreurs (optionnel)

Capture automatiquement les exceptions **serveur et navigateur**, les regroupe,
et alerte par email ou Slack. Sans lui, une erreur en production n'existe que
dans les logs de la plateforme — que personne ne lit en temps réel.

> **Intégration optionnelle.** Tout ce qui suit est conçu pour qu'un projet
> **sans compte Sentry fonctionne exactement comme avant** : pas d'erreur au
> démarrage, pas d'échec de build, pas de requête réseau. L'intégration ne
> s'active que si `NEXT_PUBLIC_SENTRY_DSN` est renseignée.

## Ce que ça couvre — et ce que ça ne couvre pas

| Besoin                                 | Sentry | Pourquoi                                                            |
| -------------------------------------- | ------ | ------------------------------------------------------------------- |
| Exception serveur (RSC, Server Action) | ✅     | capturée par le hook `onRequestError` de Next                       |
| Erreur JavaScript chez un visiteur     | ✅     | avec navigateur, parcours et ligne de code                          |
| Saturation d'un pool de connexions     | ⚠️     | vue seulement quand elle **échoue** — donc trop tard                |
| Site entièrement indisponible          | ❌     | il faut une sonde externe : Sentry ne tourne plus si rien ne tourne |
| Tenue sous charge                      | ❌     | ça se mesure avant l'incident (test de charge)                      |

Les deux dernières lignes justifient de garder un moniteur d'uptime externe à
côté : un outil hébergé dans votre application ne peut pas vous prévenir que
votre application est morte.

## Le principe : inactif par défaut

Un seul interrupteur, la présence du DSN. Chaque fichier de configuration sort
immédiatement quand il est absent — aucun SDK initialisé, aucune requête, aucun
surcoût.

## Installation

### 1. Dépendance

```bash
pnpm add @sentry/nextjs
```

### 2. Variables d'environnement

Dans `src/env-schemas.ts`, côté **client** :

```ts
NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
```

côté **serveur** :

```ts
// Jeton d'upload des sourcemaps. Absent = build normal, sans sourcemaps
// lisibles dans Sentry. Ne jamais le committer.
SENTRY_AUTH_TOKEN: z.string().optional(),
```

puis dans `src/env.ts`, `runtimeEnv` :

```ts
NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
```

`.optional()` est ce qui garantit qu'un projet sans Sentry démarre : sans lui,
la validation d'environnement échouerait au boot.

### 3. Initialisation client

`src/instrumentation-client.ts` :

```ts
import * as Sentry from '@sentry/nextjs'

import {env} from '@/env'

// Pas de DSN = intégration inactive. On sort avant d'initialiser quoi que ce
// soit : aucun poids réseau, aucune donnée envoyée.
if (env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    // Échantillonnage des traces de performance. 0 = erreurs seulement, ce qui
    // consomme beaucoup moins de quota.
    tracesSampleRate: 0,
    // RGPD : pas d'adresse IP ni d'en-têtes utilisateur par défaut.
    sendDefaultPii: false,
    // Le SDK ne doit pas écrire dans la console du visiteur.
    debug: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

### 4. Initialisation serveur

`src/instrumentation.ts` :

```ts
import * as Sentry from '@sentry/nextjs'

import {env} from '@/env'

export async function register() {
  if (!env.NEXT_PUBLIC_SENTRY_DSN) return

  Sentry.init({
    dsn: env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

// Hook natif de Next : appelé pour TOUTE erreur serveur — Server Component,
// Server Action, route handler, middleware. Sans DSN, `captureRequestError`
// n'a rien à envoyer et ne fait rien.
export const onRequestError = Sentry.captureRequestError
```

<!-- prettier-ignore -->
> Si un `src/instrumentation.ts` existe déjà dans le projet, **fusionner** :
> ce fichier est une convention Next, il ne peut y en avoir qu'un.

### 5. next.config.ts

Le boilerplate compose déjà plusieurs plugins. Sentry s'ajoute **en dernier**,
et seulement quand il est configuré :

```ts
import {withSentryConfig} from '@sentry/nextjs'

const base = withNextIntl(withMDX(nextConfig))

// Sans DSN, on exporte la configuration inchangée : le plugin Sentry n'est
// jamais appliqué, le build reste strictement identique à avant.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(base, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Sans jeton, l'upload des sourcemaps est ignoré au lieu de faire
      // échouer le build.
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      disableLogger: true,
      // Contourne les bloqueurs de publicité, qui avalent une bonne part des
      // erreurs navigateur.
      tunnelRoute: '/monitoring',
    })
  : base
```

`process.env` est utilisé ici volontairement : `next.config.ts` s'évalue avant
le module `@/env`, il ne peut pas en dépendre.

## Vérifier

Deux contrôles, dans cet ordre :

**Sans DSN** — l'important. Retirer `NEXT_PUBLIC_SENTRY_DSN`, puis :

```bash
pnpm dev     # démarre normalement
pnpm build   # build identique, aucun avertissement Sentry
```

**Avec DSN** — créer temporairement une route qui lève une erreur, l'appeler,
vérifier qu'elle apparaît dans Sentry en moins d'une minute, puis **supprimer
la route**.

```ts
// src/app/api/sentry-check/route.ts — à supprimer après vérification
export async function GET() {
  throw new Error('Vérification Sentry')
}
```

Un dossier préfixé par `_` est ignoré par le routeur de Next : nommer la route
sans underscore, sinon elle répond 404 et le test ne prouve rien.

## En production

| Variable                       | Où                | Secret ?                       |
| ------------------------------ | ----------------- | ------------------------------ |
| `NEXT_PUBLIC_SENTRY_DSN`       | hébergeur + local | non — public par conception    |
| `SENTRY_AUTH_TOKEN`            | hébergeur + local | **oui** — jamais dans le dépôt |
| `SENTRY_ORG`, `SENTRY_PROJECT` | hébergeur         | non                            |

Le DSN part dans le bundle navigateur : c'est normal, il n'autorise que l'envoi
d'événements. Le jeton d'upload, lui, donne accès à l'API de votre organisation.

## Ce qu'il faut savoir avant d'activer

**Poids client** — le SDK navigateur ajoute environ 30 à 40 Ko compressés. Sur
une vitrine de contenu, c'est un arbitrage réel à assumer.

**Quota** — le plan gratuit couvre 5 000 erreurs par mois. Une boucle d'erreurs
en production peut l'épuiser en quelques heures : mieux vaut poser une règle
d'alerte sur le volume dès le premier jour.

**Alertes** — par défaut, Sentry prévient sur une erreur **nouvelle**, pas sur
un volume. Pour être alerté sur un pic (« plus de 20 erreurs en 5 minutes »),
créer une règle dans l'interface.

**Données personnelles** — `sendDefaultPii: false` évite d'envoyer IP et
en-têtes. À conserver tant qu'aucune analyse juridique n'a validé le contraire ;
Sentry héberge aux États-Unis par défaut, une région européenne existe à la
création de l'organisation.

## Désinstaller

```bash
pnpm remove @sentry/nextjs
```

puis supprimer `instrumentation-client.ts`, le bloc Sentry de
`src/instrumentation.ts`, le `withSentryConfig` de `next.config.ts` et les
variables d'environnement. Aucune autre partie de l'application n'en dépend :
c'est le but de l'intégration conditionnelle.
