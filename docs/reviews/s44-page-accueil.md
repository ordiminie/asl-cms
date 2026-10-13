# Revue — Story s44-page-accueil (deuxième passe)

> Revue en contexte neuf (sous-agent `reviewer`). Chaque constat est classé critique / majeur / mineur.
> Diff examiné : `git diff main...feature/s44-page-accueil` (un commit : `6af5967` à la première passe, amendé en `df507dd` après la correction, puis en `08f68ae` pour retirer deux mentions du zip de livraison, supprimé par la propriétaire du produit ; ce dernier amend ne touche qu'un fichier de documentation).
> Références : `docs/plans/s44-page-accueil.md` (validated: yes), `docs/research/s44-page-accueil.md`,
> `docs/designs/s44-page-accueil.md`, AGENTS.md, ADR 032 (qui voyage avec la branche), ADR 003, 010,
> 016, 018, 020, 021, 023, `templates/review-checklist.md`.
> Le design est **volontairement en mode clair seul** (arbitrage du 7 octobre 2026) : l'absence de
> variantes sombres n'est pas un défaut. Les écarts documentés de la maquette (titre de carte du
> bureau en `h3`, monogramme de la barre latérale à 34 px) ne sont pas comptés comme dérive.

**Verdict** : aucun constat critique ni majeur. **Deuxième passe : M2 et M4 sont résolus, M1 est clos sans objet ; seul M3 reste ouvert, mineur et renvoyé à s37.** Le
critère 3 (accès croisé) est tenu à deux niveaux : test de service avec isolation simulée, et
preuve e2e par la base attaquée en direct sous le rôle applicatif.

## Vérifications exécutées par le relecteur

| Contrôle                 | Résultat                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test --run`        | 2554 passés, 1 échoué, 4 ignorés. L'échec est `src/app/[locale]/docs/docs-locale.test.ts` : un délai de 5 000 ms dépassé sur le montage lent, code hérité, **hors diff**. |
| Relance du fichier seul  | `--project client docs-locale` : **5/5 passés**. Le délai n'a pas été compté pour vert ; il a été revalidé.                                                               |
| `tsc --noEmit`           | aucune erreur hors `.next/`                                                                                                                                               |
| ESLint                   | propre sur les fichiers `src` et `e2e` touchés                                                                                                                            |
| `pnpm build`, Playwright | **non exécutés** (consigne : build et e2e en CI). Les trois specs e2e ont été relues.                                                                                     |

## Plan compliance

- [x] Le code fait ce que le plan spécifie, rien de plus. Aucune migration, aucun changement des
      actions de s04, du menu ni de `/actualites`. Seuls écarts au-delà des nouveaux fichiers :
      l'entrée de la barre latérale, le troisième argument optionnel de `resolvePageSeo`, le sitemap.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé.
- [x] Aucune valeur ou logique plausible mais fausse relevée.
- [x] Le code correspond à ce qu'il annonce.

## Les points à risque de la story

1. **Cache et tags — conforme.** `readPublicHomePageCached` (`src/app/dal/home-page-dal.ts`) pose
   `home-page:<org>` d'abord, puis `pageTag(org, slug)` dès que la page est connue, **quel que soit
   son statut**. Le filtre `published` est hors du scope caché, dans `getPublicHomePageDal`. Un test
   fige les deux tags pour une page en brouillon. `saveHomePageAction` n'appelle `updateTag` qu'après
   une écriture réussie.
2. **Refus inter-associations — conforme.** `setHomePageService` : `safeParse` → autorisation →
   lecture de la page sous `withTenant`. Page absente → `NotFoundError` ; page non publiée →
   `not_published` ; **aucune écriture dans les deux cas**. Test unitaire `[CROSS-TENANT]`. L'e2e
   interroge la base avec `set_config('app.organization_id')` sous le rôle applicatif : depuis le
   scope de B, ni la ligne de réglage de A ni sa page ne sortent (0 ligne).
3. **Autorisation — conforme.** `site.home.manage` (owner, board) est contrôlée **dans le service**,
   en écriture et en lecture du bureau. Tests : membre, bureau d'une autre association, admin
   global, public.
4. **Scope `'use cache'` — conforme.** Aucun appel direct à `logger`, aucune horloge, aucune API de
   requête. Seule journalisation : l'intercepteur de facade (`shouldLogDetails: false`), compromis
   déjà documenté dans `page-dal.ts`.
5. **Sitemap et canonique — conforme.** `/` figure une fois, daté de `updatedAt` de la page ; son
   slug est retiré de la liste. `/<slug>` déclare `/` canonique via `resolvePageSeo(…, {canonicalPath})` ;
   l'aperçu d'un brouillon ne correspond pas.
6. **Vitrine — conforme.** `src/app/[locale]/page.tsx` est supprimé. `HomeMinimal` ne contient que le
   nom, la description et les actualités. Aucun texte, lien ou bouton de la vitrine n'est atteignable
   sur `/`.
7. **Suppressions — conformes.** Plus aucune référence à `ButtonConnexionDashboard`, `image-theme`,
   `vapour-text-effect` dans `src`, `e2e`, `messages` (seul reste un `.mdx` documentaire hérité, hors
   diff). Le bloc `HomePage` des messages est retiré ; toutes les clés `PublicHome` et `BureauHomePage`
   sont utilisées.
8. **Extraction de `PublicPageArticle` — conforme.** Balisage et classes identiques à l'ancienne
   version en ligne ; le bandeau d'aperçu se comporte de même (`isPreview` à `false` par défaut).
   Composant couvert par son propre fichier de test.
9. **Périmètre — conforme.** ADR 032 respecté : clé hors registre, pas d'intégrité référentielle,
   référence pendante lue comme « accueil automatique ».

## Rules compliance

- [x] Conventions du dépôt respectées (AGENTS.md).
- [x] Aucun ADR accepté contredit.
- [x] Design system respecté : aucun composant, jeton ou couleur hors système. Les valeurs en pixels
      arbitraires suivent les pages publiques existantes. L'`alert` d'avertissement est composée avec
      les classes existantes (`border-warning-border bg-warning text-warning-foreground`), comme dans
      `provision-organization-form.tsx` : aucun nouveau jeton ni variante.

## Tests

- [x] Suite lancée par le relecteur, passante (le seul délai dépassé revalidé en isolation).
- [x] Les assertions pinent les critères d'acceptation.

## Écarts déclarés par l'implémenteur — appréciation

- **`canManageHomePageService` ajoutée** : acceptable. Lecture seule, pour que l'interface affiche
  l'écran de refus ; les écritures revérifient dans le service.
- **Copie privée de `toPageWithBlocksDto`** dans `home-page-service.ts` : acceptable, mineur (M2).
- **Message d'échec « Rien n'a changé pour les visiteurs. »** : acceptable. Le design disait « les
  visiteurs voient toujours l'accueil automatique », ce que l'action serveur ne sait pas ; la
  reformulation est exacte. Tests unitaires et e2e alignés sur `fr.json`.
- **Dépendance de l'écran du bureau à `page.manage`** : mineur, latent (M3).
- **Signature du commit** : mineur (M1).

## Findings

- **M1 — clos, sans objet — commit** — la signature `Co-Authored-By: Claude Opus 5.5` est conservée :
  c'est le modèle qui a réellement écrit le commit. La demande initiale d'une ligne `Sonnet 5.5` était
  erronée pour un commit rédigé par un autre modèle.
- **M2 — résolu — `src/services/home-page-service.ts`** — la copie privée de `toPageWithBlocksDto` est
  supprimée ; le service importe l'original, désormais exporté de `page-service.ts` (seul changement
  de ce fichier : le mot `export`). Pas de cycle d'import ; un service qui importe la fonction d'un
  autre service respecte la règle d'architecture (jamais une facade).
- **M3 — ouvert, mineur, non bloquant — `getPagesForBureauDal`** — l'écran « Page d'accueil » liste
  les pages par un DAL gardé par `page.manage`. Rien ne casse tant que `site.home.manage` et
  `page.manage` ont les mêmes rôles par défaut ; quand s37 rendra les droits ajustables par action,
  une lecture dédiée sera nécessaire. Correction **moyennement coûteuse** : **à reporter dans le plan
  de s37**, pas à corriger ici.
- **M4 — résolu — `e2e/home-page.spec.ts`** — le `if (await pageChoice.isEnabled())` est remplacé par
  `await expect(pageChoice).toBeEnabled()`. Le scénario est déterministe : le bureau de B crée et
  publie sa propre page (`unique('Page B')`) avant d'ouvrir `/bureau/page-accueil`, vérifie que sa
  page est proposée et que celle de A ne l'est jamais (0 occurrence). Les libellés correspondent à
  `messages/fr.json`. La page publiée qui reste chez Marketing Pro ne gêne pas les autres specs
  (`page-cms`, `seo`, `site-navigation`). Risque résiduel : scénario long, sensible à l'hydratation
  de l'éditeur, protégé par les mêmes reprises que les helpers existants ; **non exécuté en local**,
  sa première exécution sera celle de la CI.

## Vérifications de la deuxième passe

- `pnpm test --run` : 2554 passés, 1 échoué, 4 ignorés. L'échec est le même délai de 5 000 ms de
  `src/app/[locale]/docs/docs-locale.test.ts` (code hérité, hors diff, montage lent) ; relancé seul :
  **5/5 passés**. Le délai n'est pas compté pour vert.
- `npx prettier --check docs/research/s44-page-accueil.md` : passe.
- Le reste du diff (tags de cache, refus inter-associations, autorisation dans le service,
  sitemap et canonique, vitrine retirée) repose sur la première passe et sur la lecture de la
  statistique du diff ; il n'a pas été relu ligne à ligne.

## Verdict

Max severity: minor
Ship allowed: yes
