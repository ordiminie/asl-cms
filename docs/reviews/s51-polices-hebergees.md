# Review — Story s51-polices-hebergees

Diff jugé : `git diff main...feature/s51-polices-hebergees` (1 commit, `04dfe07f`). Revue faite par le
sous-agent `reviewer`, contexte neuf.

## Vérifications

- **Tests unitaires** : sur `/workspace` (montage 9p lent), `fonts.test.ts` et `base-layout.test.tsx`
  donnent 11 passés, 1 échec — le scan de `src/` dépasse le délai de 5 s de Vitest (7,6 s). Non compté
  comme vert. Sur une copie de la branche en disque local : 2 fichiers, 12 tests sur 12 passés.
- **Types, lint, format** : `tsc --noEmit` propre ; ESLint et Prettier propres sur les fichiers touchés.
- **Import Google** : `next/font/google` n'apparaît plus que dans le test de garde et le README des
  polices.
- **Fichiers `woff2`** : les trois commencent par `wOF2`, longueur d'en-tête égale à la taille du
  fichier, SHA-256 identiques à ceux du README. La table `cmap` de chacun contient é à ç œ Œ ’ « » €.
- **Licences** : les trois fichiers contiennent la SIL Open Font License 1.1 (Public Sans : le
  `LICENSE.md` amont de USWDS, avec son préambule, puis l'OFL).
- **Plan** : les 7 tâches sont présentes, rien au-delà du plan. ADR 046, recherche et plan voyagent avec
  la branche.
- **Design system** : seules les mentions du mécanisme changent (extrait de chargement, ligne « Trois
  polices à installer ») ; familles, variables CSS, plages de graisse, tokens et composants intacts.
- **`base-layout.tsx`** : options `localFont` conformes au plan ; `src` relatifs résolus vers des
  fichiers existants ; l'import `GoogleAnalytics` est conservé.
- **E2E (lu, non exécuté)** : route `/bureau/reglages`, compte `user-owner@gmail.com` et helper de
  connexion existent ; les assertions (HTML, feuilles `/_next/static/`, requêtes sortantes,
  `document.fonts` à `loaded`) échoueraient sur un chemin de police cassé ou un retour à Google.
- **Garde** : `GOOGLE_FONT_IMPORT` reconnaît `from 'next/font/google'` et ignore
  `@next/third-parties/google`.

## Checklist

- [x] Tests exécutés par le reviewer ; l'unique échec est un délai, revalidé vert en disque local
- [x] Imports, API et chemins vérifiés
- [x] Diff conforme au plan, tâche par tâche, sans dérive
- [x] Tests ancrés sur les critères (1, 4, 5 en unitaire ; 2 et 3 en e2e CI)
- [x] AGENTS.md et ADR 046 respectés ; design system : mécanisme seul
- [x] Aucune régression constatée sur les chemins touchés
- [ ] Build et e2e non exécutés, par consigne (ils tournent en CI sur la PR)

## Findings

1. **Minor** — `src/app/[locale]/fonts.test.ts` l. 27 : le scan de `src/` n'a pas de délai explicite ; sur
   le montage 9p il prend 7,6 s et dépasse les 5 s par défaut de Vitest. Passe en disque local et devrait
   passer en CI. Suggestion : `it(…, 15_000)` ou un scan plus ciblé.

Non vérifié : que les fichiers soient octet pour octet ceux que Google servait (affirmé seulement par le
README, avec les adresses d'origine). Le contenu (glyphes, versions, WOFF2 valide) est, lui, vérifié.

Max severity: minor
Ship allowed: yes
