# ADR 031 — Rediriger les anciens préfixes de langue par `redirects()` de `next.config.ts`

- Status: accepted
- Date: 2026-10-06
- Scope: story s43-locale-unique

## Context

L'ADR 008 fixe une locale unique, `fr`, avec `localePrefix: 'never'`. Le critère 2 de s43 exige
qu'une adresse préfixée par `/fr`, `/en` ou `/es` ne serve plus aucune page et **redirige de façon
permanente** vers la même adresse sans préfixe. Ces adresses ont existé : elles ont pu être partagées,
imprimées ou indexées avant la mise en ligne.

La recherche de s43 (`docs/research/s43-locale-unique.md`) a vérifié dans le code de next-intl
4.13.5 que le middleware ne suffit pas :

- en mode `'never'`, il ne redirige que les préfixes de **locales déclarées** — donc `/fr/…` seul,
  puisque `en` et `es` disparaissent du routage ;
- cette redirection passe par `NextResponse.redirect(url)` sans statut, soit un **307 temporaire** ;
- `/en/actualites` serait traité comme un chemin ordinaire, réécrit en `/fr/en/actualites`, et finirait
  en 404 ou dans la page CMS `[slug]`.

La redirection doit donc être portée par le projet. Il faut choisir où.

## Decision

Les trois préfixes historiques sont redirigés par la fonction `redirects()` de `next.config.ts`,
avec `permanent: true` (statut **308**). Les règles sont produites par un module sans dépendance
d'exécution, `src/lib/routing/legacy-locale-prefixes.ts`, qui exporte la liste
`LEGACY_LOCALE_PREFIXES` (`fr`, `en`, `es`) et le générateur des règles. La même liste alimente
`robots.txt` et les slugs réservés du CMS : un préfixe se déclare à un seul endroit.

## Considered options

- **Laisser faire next-intl** — rejeté : 307 et non permanent, et ne couvre que `/fr` ; `/en` et
  `/es` finiraient en 404 (vérifié dans `middleware.js`).
- **Une branche de plus dans `src/proxy.ts`** — rejeté : fonctionne et se teste en unitaire, mais
  ajoute une responsabilité impérative au fichier que l'ADR 008 désigne comme le point de rupture le
  plus probable, alors que le besoin est une table de correspondance statique. La doc Next
  (`proxy.md`, « Execution order ») place les `redirects` de `next.config` **avant** le proxy : le
  proxy ne voit plus jamais d'adresse préfixée et peut oublier les locales.
- **Garder la locale dans la liste de next-intl avec `localePrefix: 'as-needed'`** — rejeté : c'est
  l'option « préfixe toléré » que l'ADR 008 a déjà écartée ; les pages préfixées resteraient servies.

## Consequences

**Plus simple** : le proxy n'a plus à connaître la locale ; la redirection est déclarative, conserve
la méthode (308) et la query string (comportement documenté de `redirects`).

**Plus difficile** : `next.config.ts` s'évalue avant `@/env` et hors de l'alias `@/` — le module
partagé ne doit importer ni l'un ni l'autre. Les `redirects()` ne se testent pas en unitaire au-delà
de la forme des règles : leur effet se prouve en e2e.

**À surveiller** : une page CMS dont le slug serait `fr`, `en` ou `es` deviendrait injoignable ; ces
slugs sont donc réservés. Rouvrir une seconde locale un jour demandera de retirer son préfixe de la
liste avant de l'ajouter au routage.
