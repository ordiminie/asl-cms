# ADR 008 — Locale unique `fr`, sans préfixe d'URL

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le boilerplate est multilingue : `src/i18n/routing.ts` déclare `locales: ['en', 'fr', 'es']` avec `defaultLocale: 'en'`, toutes les routes vivent sous `src/app/[locale]/`, et `messages/` contient trois fichiers de traduction.

ASL-CMS s'adresse à des associations syndicales libres françaises, à des propriétaires souvent âgés et peu à l'aise avec l'informatique. Ni le PRD, ni le cahier des charges contractuel, ni aucune des 42 stories ne mentionne une seconde langue.

Deux exigences rendent la forme des URL structurante : s11 demande un site référençable (sitemap, métadonnées, Search Console), et l'ADR 003 donne à chaque association son propre domaine.

## Decision

Une seule locale, `fr`, avec `localePrefix: 'never'`.

- `routing.ts` déclare `locales: ['fr']`, `defaultLocale: 'fr'`, `localePrefix: 'never'`.
- Les routes restent physiquement sous `src/app/[locale]/` : c'est la structure du boilerplate, et la conserver évite de déplacer une centaine de fichiers pour un gain nul. Le segment disparaît simplement de l'URL visible.
- **next-intl est conservé.** Les libellés restent dans `messages/fr.json`, hors du code. C'est déjà la convention du boilerplate (`useTranslations`, `getTranslations`), c'est ce que supposent les règles `rule-translation.md`, `rule-server-actions-internationalization.md` et `rule-zod-client-server-internationalization.md`, et c'est ce qui rendra une seconde locale possible sans réécriture si le besoin apparaît.
- `messages/en.json` et `messages/es.json` sont retirés.

## Considered options

- **Garder le préfixe, en basculant simplement `defaultLocale` sur `fr`** — rejeté : zéro travail, mais laisse `asl-exemple.test/fr/actualites` en URL publique. Un segment de langue sans autre langue est du bruit dans chaque URL, un canonique de plus à gérer pour s11, et une source de liens cassés quand le bureau partage une adresse.
- **Retirer complètement next-intl et écrire les libellés en dur** — rejeté : contredit trois règles du projet, casserait les patterns de validation Zod traduite et de Server Actions traduites que tout le code suit, et rendrait toute évolution multilingue prohibitive. Le gain — un fichier de moins — est dérisoire.
- **Rester multilingue (fr/en)** — rejeté : double le coût de rédaction de chaque contenu CMS et de chaque modèle d'email, pour un besoin absent de la spécification contractuelle. Le contenu éditorial est saisi par des bénévoles ; leur demander deux versions de chaque actualité est le meilleur moyen de rendre le produit inutilisable.

## Consequences

**Ce qui devient plus simple**

- URL publiques directes et référençables, ce que s11 attend.
- Un seul fichier de messages à tenir, une seule version de chaque contenu à saisir.
- Les liens partagés par le bureau, souvent par email ou par courrier, sont plus courts et plus stables.

**Ce qui devient plus difficile**

- Ajouter une locale plus tard demandera de rebasculer `localePrefix` et de traiter les redirections des URL existantes. Le coût est réel mais contenu, précisément parce que next-intl est conservé.

**À surveiller**

- Vérifier que le middleware `src/proxy.ts` se comporte correctement avec `localePrefix: 'never'` : il manipule aujourd'hui explicitement le préfixe de locale (`localeOf`, `stripLocalePrefix`) pour déterminer les segments authentifiés. C'est le point de rupture le plus probable de cette décision.
- Les liens de désinscription et les URL insérées dans les emails et les PDF de publipostage doivent être générés sans préfixe : ils sont imprimés sur du papier et ne peuvent pas être corrigés après coup.
