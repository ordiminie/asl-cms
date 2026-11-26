# Revue : story s56-import-annuel-coordonnees (tour 2)

> Revue en contexte neuf. Chaque problème est classé critique, majeur ou mineur.
> Diff jugé : `git diff main...feature/s56-import-annuel-coordonnees`. Il compte deux commits : fdd11e09 (la story) et 69cab095 (les correctifs du tour 1). Seul le contenu commité est jugé : `docs/architecture.md` et `docs/logs/`, non commités, sont ignorés.

## Rappel du tour 1 et ce qui a été corrigé

Le tour 1 concluait à un ship autorisé (`Max severity: major`) avec deux majeurs et sept mineurs. L'utilisatrice a choisi, le 2026-11-26, de corriger les majeurs avant la PR, avec deux mineurs de texte.

- **M1, corrigé.** `updateMemberProfileEmailService` acceptait une cible `disabled_by_import` : il réécrivait l'adresse et ouvrait ou reliait un compte.
- **M2, corrigé.** La typographie du rapport et du formulaire de l'import annuel sortait de l'échelle du design system.
- **m3, corrigé.** La case de la tâche 1 était cochée alors que le rejeu local de la migration n'avait pas été fait.
- **m5, corrigé.** L'ADR 077 §1 ne disait pas que l'instantané de s13 porte le terrain par défaut.
- **m1, m2, m4, m6, m7, laissés ouverts par choix de l'utilisatrice** pour un tour final. Ils sont reportés plus bas sans être relevés comme nouveaux.

## Conformité au plan

- [x] La section « Correctifs de revue (tour 1) » du plan a ses quatre points cochés, et chacun se retrouve dans 69cab095. Le commit ne contient rien d'autre, à une exception près : un retrait d'indentation dans les tâches 4 et 5 du plan (m8). Les dix tâches et les décisions A à D restent conformes au tour 1. Le commit de correctif ne touche pas aux règles ni au service d'import.

## Anti-hallucination

- [x] Aucun appel inventé. J'ai ouvert chaque nouvelle référence du correctif :
  - `MemberEmailStatusConst.DISABLED_BY_IMPORT` existe (`src/services/types/domain/member-email-types.ts:27`) et était déjà importé dans `member-profile-email-service.ts` (l. 52).
  - Les classes Tailwind utilisées (`text-[15px]`, `text-[17px]`, `text-[26px]`, `tabular-nums`) sont des utilitaires standard.
- [x] Pas de logique plausible mais fausse. Le garde M1 est placé **avant** `findEmailHolder`, `decideMemberAccount`, `updateMemberProfileEmailDao` et `applyMemberAccountDecision`. Aucune écriture ni décision de compte n'est donc atteignable pour une cible désactivée. Le code fautif est :
  ```ts
  if (!target || target.status === MemberEmailStatusConst.DISABLED_BY_IMPORT) {
    return {status: 'not_found'}
  }
  ```
- [x] Les autres écrivains du bureau, comme le demande le point M1 du plan :
  - **Désignation** : refusée (`planHolderDesignation` rend `not_active`, d'où `invalid_replacement`). C'est maintenant épinglé par un test.
  - **Remplaçante `existing` lors d'un retrait** : refusée (`holderReplacementPlan` exige `isActive(successor)`).
  - **Ajout** : réactive la ligne, ce qui est voulu.
  - **Retrait** : se fait seul.

  Il ne reste aucun écrivain ouvert sur cet état, hors m1 (côté membre et purge, laissé ouvert).

## Respect des règles

- [x] AGENTS.md : rien de nouveau dans le correctif (pas de `withRlsBypass`, pas de valeur en dur, libellés inchangés).
- [~] ADR : aucun n'est contredit. Le texte ajouté à l'ADR 077 §1 décrit bien `snapshotOf` de s13. Les ADR 076 et 077 sont toujours `Status: proposed` (m2, ouvert).
- [x] Design system : M2 est refermé. Valeurs comparées à `docs/design-system.md` §1.3 et §3.13 :
  - **« Bilan »** : `h2` en `font-serif text-[26px] font-semibold`, soit Source Serif 4, 26 px, 600.
  - **Titres de section** : `h3` en `text-[20px] font-semibold`, sans serif. C'est Public Sans par défaut (`--font-sans`).
  - **Titres de carte du formulaire** : `font-serif` retiré. Ils restent à 20 px / 600 (`CardTitle` porte `font-semibold`).
  - **Compteur** : libellés `dt` en `meta` 15 px `muted-foreground`, valeurs `dd` en `font-mono text-[17px] tabular-nums` au poids 400. C'est le `data` 17 px de §3.13 ; le `font-semibold` hors échelle a disparu.
  - **Plancher de 15 px** : plus aucune taille en dessous dans `annual-import-report.tsx`, `annual-import-form.tsx` et `annual-import-screen.tsx`. J'ai fait l'inventaire de toutes les classes `text-[…]` et `font-*` :
    - `h1` 34 px serif ;
    - `h2` 26 px serif ;
    - `h3` 20 px ;
    - sous-titre « À vérifier » 15 px / 600 (`meta` 600) ;
    - lignes des cartes mobiles 16 px (`label`) ;
    - corps 17 px ;
    - `meta` 15 px.
  - **Intention du design s56** (compteur `dl`, sept sections `h3` avec décompte en `data`) : respectée.
  - **Écran de s13** : le correctif n'y touche pas, comme prévu.

## Tests

- [x] J'ai lancé la suite moi-même, sur une copie sur disque local.
  - **Préparation** : `git archive feature/s56-import-annuel-coordonnees` dans le scratchpad, avec `node_modules` en lien symbolique vers `/workspace/node_modules` (dépendances identiques à `main`) et les `.env*` copiés.
  - **`pnpm test --run`** : **503/503 fichiers, 6960 réussis, 4 ignorés, 0 échec, 0 timeout**. C'est 6956 + 4 par rapport au tour 1, ce qui correspond aux quatre nouveaux tests.
  - **`tsc --noEmit`** sur tout le projet : 0 erreur.
  - **`eslint`** sur les fichiers du correctif : 0.
  - **`pnpm check:rules`** : OK.
  - Non lancés, comme demandé : e2e et `pnpm build`.
- [x] Les tests du correctif échouent sans le correctif. Je l'ai vérifié par mutation : seconde copie avec les nouveaux tests et les trois sources d'avant le correctif (`git show fdd11e09:…`).
  - « modifier une adresse désactivée… (revue M1) » : **échoue**.
  - « typographie… (revue M2) », formulaire et rapport : **échouent tous les deux**.
  - « désigner une adresse désactivée titulaire… » passe aussi avant le correctif. C'est attendu : ce comportement était déjà correct, le test l'épingle seulement.
- [x] Les assertions sont réelles. Le test M1 vérifie `{status: 'not_found'}` et l'absence d'appel à `updateMemberProfileEmailDao`, `createUserIfAbsentTxnDao` et `linkMemberProfileAccountDao`. Les tests M2 vérifient les classes du `h2` et des `h3`, la paire libellé/valeur du compteur et l'absence de taille sous 15 px. Réserve légère : le détecteur `belowMetaFloor` ne voit que les tailles `text-[Npx]`, pas `text-sm` ou `text-xs`. J'ai vérifié à la main qu'il n'y en a aucune.

## Régressions

- [x] Le garde M1 ne change le comportement que pour une cible `disabled_by_import`. Les cibles `active` et `pending` suivent le même chemin qu'avant, et la suite de `member-profile-email-service.test.ts` reste verte. Les changements de typographie sont confinés aux composants de s56.

## Constats

**Critiques** : aucun.

**Majeurs** : aucun. M1 et M2 sont refermés.

**Mineurs**

- **m1 (ouvert, reporté)** : `my-email-service.ts` et `purgeExpiredPendingEmailsDao` / `deletePendingEmailsAddedByDao`. Une adresse désactivée par l'import, réajoutée par le membre, passe `pending`. Si l'attente est purgée, la ligne disparaît avec sa trace et son `unsubscribed_at`, contre l'ADR 076 §4.
- **m2 (ouvert, reporté)** : `docs/decisions/076-*.md` et `077-*.md` sont encore `Status: proposed`.
- **m4 (ouvert, reporté)** : le plan (décision 2, tâche 5) décrit toujours le chemin `replaceMemberAccount` et l'opération `demote`, alors que le code désactive puis ajoute en titulaire.
- **m6 (ouvert, reporté)** : `member-annual-import-service.ts`, voie de défense `board_email_required`. Elle annule toute la transaction de la fiche, groupes domicile, terrain et téléphone compris. Elle est inatteignable en pratique.
- **m7 (ouvert, reporté)** : le type de l'instantané existe en double, `PennylaneImportSnapshotModel` et `PennylaneImportSnapshot`, reliés seulement par un cast.
- **m8 (nouveau, mineur)** : `docs/plans/s56-import-annuel-coordonnees.md`, tâches 4 et 5. Le correctif a retiré l'indentation de deux lignes de continuation (7 espaces devenus 4). C'est sans effet sur le rendu, mais le diff contient du bruit sans rapport avec les correctifs. Le fichier n'était déjà pas conforme à Prettier avant le correctif.

## Verdict

Les quatre correctifs choisis ferment chacun leur constat. Leurs tests auraient échoué avant, et ils n'introduisent pas de régression. Il ne reste que des mineurs : les cinq reportés par choix pour le tour final, plus un nouveau mineur de forme dans le plan.

Max severity: minor
Ship allowed: yes
