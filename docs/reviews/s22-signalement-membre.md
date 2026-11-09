# Review — Story s22-signalement-membre

Diff jugé : `git diff main...feature/s22-signalement-membre` (commit `b391b6a2`). Revue par le sous-agent `reviewer`, contexte neuf, lecture seule.

## 1. Tests (relancés par le reviewer)

- `pnpm test --run` : 3632 passés, 9 échecs dans 6 fichiers, aucun lié à s22.
  - 6 échecs `scripts/ops/*` : séparateurs de chemin Windows (`\srv`), hors story.
  - 3 délais d'attente sous charge de la suite complète : `news-editor` et `page-editor-seo` passent isolés (avec `member-space` : 6 fichiers, 65 tests) ; `board-member-form` et `pages-list` repassent isolés (2 fichiers, 17 tests, vérifiés après la revue).
- e2e non exécuté (le scénario inter-association exige un build de production en CI) ; jugé par lecture, voir §5.

## 2. Points demandés par l'implémenteur

1. **Compte sans fiche sur `/dashboard/signaler`** : `notFound()` ; l'action renvoie l'échec générique sur `not_found`. Cohérent avec l'arbitrage « pas de carte » et couvert par un e2e. Décision non écrite au plan (minor).
2. **Isolation de la lecture membre : OK.** `readForMyProfile` ne prend que `organizationId` ; sous `withTenant`, la fiche se résout par la session ; `getMyIncidentReportsDao(memberId)` filtre sur ce `memberId`. Aucun identifiant de fiche accepté depuis l'UI, l'action ou le DAL.
3. **Ce que reçoit le membre : OK.** `MyIncidentReportDTO` = id, catégorie, lieu, statut, dates. Ni `notificationFailed`, ni `organization_id`, ni `author_name`, ni `on_behalf_of_*`, ni description.
4. **Le public n'écrit jamais `member_id` : OK**, assertion e2e avec l'email exact d'une fiche.
5. **Aucun `'use cache'` sur la lecture par utilisateur : OK** (`cache()` de React seul, derrière un `<Suspense>`).
6. **Migration : OK.** `0040_great_grim_reaper.sql` avec entrée de journal (idx 40) et snapshot ; FK vers `member_profile.id`, `ON DELETE restrict` ; index `(organization_id, member_id, created_at DESC)`.
7. **Valeurs en dur : aucune.** Libellés dans `messages/fr.json` ; destinataires par `resolveReportRecipients`, comme le public.
8. **`docs/designs/s22.zip` : absent du diff**, resté non suivi ; `/ks-ship` ne doit pas l'ajouter.

## 3. Plan vs diff

Toutes les couches du plan sont couvertes (migration, modèle, DAO, service, validation, façade, intercepteur, DAL, action, page, formulaire, carte, câblage du tableau de bord, mention « Membre » du bureau), avec tests colocalisés et un bloc e2e. Seul ajout hors plan : le refactor `notifyBoardOfNewReport`, partagé avec le chemin public, sans changement de comportement.

## 4. Références vérifiées

`getMemberProfileByUserIdDao(organizationId, userId)`, `getActiveReportCategoriesDal`, `requireCurrentTenantDal`, `requireActionAuth`, `resolveSupportedLocale` et `withTenant` existent et sont appelés avec la bonne signature. Le schéma Zod retire tout champ d'identité injecté. Couches respectées : page → DAL → façade → service → repository, `getDb()` partout.

## 5. e2e jugé par lecture : sain

Mode `serial`. Couvre : déclaration sans ressaisie, « Membre · email » au bureau, deux emails vers les mêmes destinataires que le public, isolation entre membres dans les deux sens, isolation entre associations (Pommier chez Marketing Pro ne voit rien de TechCorp, contrôle RLS direct A=2, B=0), statut changé par le bureau visible du membre, `member_id` nul côté public, compte sans fiche sans carte. Assertions précises. **À confirmer en CI** sur le build de production, le scénario inter-association n'ayant pas pu tourner sur le serveur de développement.

## 6. Findings

- **minor** — Le plan ne dit pas qu'un compte sans fiche obtient `notFound()` sur `/dashboard/signaler` : comportement cohérent et testé, à consigner.
- **minor** — Tailles Tailwind arbitraires (`text-[17px]`, `text-[15px]`, `text-[34px]`) dans `my-report-form.tsx`, `my-reports-card.tsx` et `signaler/page.tsx` ; même motif que les fonctionnalités existantes, pas de nouvelle dérive visuelle.
- **minor** — Trois tests client instables sous charge de la suite complète ; préexistants, étrangers à s22.

Aucun composant, token ou couleur hors du design system. L'état désactivé du bouton (B3) réutilise celui du composant.

Max severity: minor
Ship allowed: yes
