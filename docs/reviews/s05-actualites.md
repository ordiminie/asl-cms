# Review — Story s05-actualites

> Six passes de revue en contexte neuf, par le subagent `reviewer`, les 22 et 23 septembre 2026.
> Chaque passe a audité le commit de correctif de la précédente **comme du code neuf**, sans se fier
> au rapport précédent.
>
> | Passe | Diff revu                                              | Verdict                                                                                          |
> | ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
> | 1     | `7c59ab4`                                                | `major` / ship yes — invalidation de cache manquante quand une publication est refusée             |
> | 2     | + `bf55bd9`                                              | `major` / ship yes — le correctif avait déplacé l'invalidation **avant** l'écriture du statut      |
> | 3     | + `3939cd8`                                              | `minor` / ship yes — image sans alt possible sur une publiée, titre vidable, e2e non idempotents  |
> | 4     | + `f6d5b7f`                                              | `minor` / ship yes — inventaire RLS faux, barre d'aperçu muette sur un refus, libellés incohérents |
> | 5     | + `bf5091a`                                              | `major` / ship yes — la garde RLS ajoutée cassait `pnpm db:generate`                               |
> | 6     | + `0cfa6d8`                                              | **`minor` / ship yes** — rapport ci-dessous, celui qui fait foi                                    |

## Commandes exécutées par le relecteur (mesurées, pas rapportées)

| Commande                                     | Résultat mesuré                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm test --run`                            | **Test Files 107 passed \| 2 skipped (109)** — **Tests 1181 passed \| 8 skipped (1189)**, 77 s      |
| `pnpm exec tsc --noEmit --incremental false` | 0 erreur (hors `.next/types`, artefact de cache, non lié au code)                                   |
| `pnpm lint`                                  | 0 erreur, 2 avertissements préexistants hors `src` et hors diff                                     |
| `pnpm check:rules`                           | ✅ « Règles et documentation alignées sur le code. »                                                |
| `pnpm db:generate`                           | « No schema changes, nothing to migrate », `git status drizzle/` vide — **porte réparée, vérifiée** |
| Playwright e2e                               | **NON EXÉCUTÉS** par le relecteur. Les 8 scénarios de la tâche 7 sont présents dans `news.spec.ts`. |

## Les six points de `0cfa6d8`, vérifiés dans le code

1. **Garde RLS sortie du glob Drizzle** — `src/db/rls-inventory.test.ts` est hors de `./src/db/models/*`.
   `db:generate` réussit sans diff. Le relecteur a **reproduit lui-même** la régression pour prouver
   que la garde mord : un fichier de test jeté dans `src/db/models/` la fait échouer. Comptes
   revérifiés indépendamment : **26 tables, 7 sous policy forcée**, alignés avec `docs/architecture.md`.
2. **Les trois renforcements sont réels** : motif élargi côté modèles et migrations, contrôle
   bidirectionnel listée ⇔ forcée (vérifié qu'il ne lit que la première colonne du tableau), et
   `sliceSection` qui lève en nommant le titre attendu plutôt que de dégrader silencieusement.
3. **Suppression de code mort — correcte, s04 non affaibli.** Zéro référence restante aux symboles
   retirés. Les six assertions d'upload de `page-block-file.test.ts` sont identiques à celles de
   `main` ; seul le bloc de lecture retiré a disparu. Le comportement de s04 reste prouvé par
   `api/files/[...key]/route.test.ts` (clé `pages` servie sur l'ancienne route, clé `news` refusée).
   **Réserve** : `isPageBlockFileKeyAllowed`, gardée pour la citation de l'ADR 023, n'a plus aucun
   appelant de production — c'est du code mort avec une citation, pas un contrat vivant.
4. **`?page=` en lecture stricte** — pinné par trois tests, y compris la liste des cas qui doivent
   tous rendre 404 sans appeler le DAL.
5. **Notes de plan** — additives, frontmatter intact. La note sur la divergence de cache est exacte ;
   la note sur l'écart 8 (image pleine largeur) **est mal justifiée** : l'article de s05 n'utilise pas
   le même fichier ni la même gouttière que celui de s04, contrairement à ce que dit la note.
6. **`next.config.ts`** — vide sur le diff, rien n'a fui dans un commit.

## Risques permanents — tous propres

RLS forcée sur `news`, chaque accès sous `withTenant` (prouvé par les tests, qui vérifient le scope
**à l'intérieur** du mock de DAO), `getDb()` partout, aucun `withRlsBypass` nouveau, aucune valeur
métier en dur, blog hérité intact, aucun chemin visiteur vers un brouillon, `imageKey` du client
borné avant toute écriture, comportement de s04/s04b inchangé. Aucune API inventée.

## Compromis déjà acceptés par écrit — pas des constats

Divergence de cache compte/liste et écart 8 (notes du plan) ; `readContentFileService` sans
autorisation (ADR 023) ; le logger atteint depuis un scope `'use cache'` (compromis hérité de s04,
documenté) ; six commits au lieu d'un (squashés au merge).

## Findings — tous mineurs

1. **minor** — `docs/plans/s05-actualites.md`, tâche 2 : deux phrases périmées décrivent des
   fonctions depuis supprimées (`getPageFileFormatFromKey` comme enveloppe, `readPageBlockFileService`
   comme délégué). Une ligne sous « Décisions tranchées » suffirait.
2. **minor** — `docs/plans/s05-actualites.md`, note « Écart 8 » : le raisonnement écrit est faux.
   L'article de s05 (`(public)/actualites/[slug]/page.tsx`) n'utilise pas la même gouttière que celui
   de s04 (`(public)/[slug]/page.tsx`) — ce sont deux fichiers distincts. Rendre l'image pleine largeur
   en mobile ne toucherait donc pas s04. La décision de différer reste légitime ; sa justification est
   à corriger.
3. **minor** — `isPageBlockFileKeyAllowed` (`page-block-types.ts:307`) n'a plus d'appelant de
   production, seulement son propre test.
4. **minor** — `news-dal.ts:133-144` : `getNewsItemForBureauDal` ne convertit que `NotFoundError` en
   `undefined`. Un identifiant malformé dans l'URL (`/bureau/actualites/abc`) fait remonter une
   `ValidationParsedZodError` vers une page d'erreur plutôt qu'un 404.
5. **minor** — `actualites/page.tsx:53` : `page ?? '1'` ne couvre pas la chaîne vide ;
   `/actualites?page=` répond 404 au lieu d'afficher la page 1.
6. **minor** (qualité de test) — le test « clé hors préfixe : 404 » de `route.test.ts` simule le rejet
   du service au lieu de laisser le vrai contrôle de préfixe agir ; il passerait même si ce contrôle
   disparaissait. Le comportement reste couvert ailleurs (`content-file-types.test.ts`, route héritée).
7. **minor** (observation) — angles morts restants de la garde RLS : les sous-décomptes par groupe ne
   sont pas vérifiés, un fichier sans suffixe `.test.ts` important vitest passerait inaperçu, et
   `forcedTablesIn` n'accepte qu'une orthographe exacte de `ALTER TABLE`.
8. **minor** (observation) — rien ne garantit qu'une ligne `published` porte un slug non nul (ni la
   colonne, ni le type, ni `publishNewsService`). Inatteignable dans le flux actuel, mais si cela
   arrivait, le lien public deviendrait `/actualites/null`.

## Verdict

Aucun défaut critique ni majeur. Ce qui reste sont des points cosmétiques ou d'observation, dont deux
touchent la documentation du plan plutôt que le comportement du produit.

Max severity: minor
Ship allowed: yes
