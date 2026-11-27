# Revue de la story s56-import-annuel-coordonnees (tour 3)

> J'ai fait cette revue en contexte neuf et classé chaque problème en critique, majeur ou mineur.
> Diff jugé : `git diff main...feature/s56-import-annuel-coordonnees`, soit trois commits de code : fdd11e09 (la story), 69cab095 (correctifs du tour 1) et 4cd96448 (correctif CI, le seul commit nouveau de ce tour). J'ai lu 4cd96448 comme du code neuf. Seul le contenu commité est jugé : `docs/architecture.md` et `docs/logs/`, non commités, sont ignorés.

## Rappel des tours 1 et 2

- **Tour 1** (`Max severity: major`, ship autorisé) : deux majeurs et sept mineurs. L'utilisatrice a choisi de corriger les majeurs avant la PR.
  - **M1, corrigé dans 69cab095.** `updateMemberProfileEmailService` acceptait une cible `disabled_by_import` : il réécrivait l'adresse et ouvrait ou reliait un compte.
  - **M2, corrigé dans 69cab095.** La typographie du rapport et du formulaire de l'import annuel sortait de l'échelle du design system.
  - **m3, corrigé dans 69cab095.** La case de la tâche 1 était cochée alors que le rejeu local de la migration n'avait pas été fait.
  - **m5, corrigé dans 69cab095.** L'ADR 077 §1 ne disait pas que l'instantané de s13 porte le terrain par défaut.
- **Tour 2** (`Max severity: minor`, ship autorisé) : il a confirmé ces correctifs, par mutation, et ajouté m8.
  - Les mineurs m1, m2, m4, m6, m7 et m8 sont laissés ouverts par choix de l'utilisatrice, pour un tour final.
- **Depuis** : la CI de la PR 90 échouait sur un seul test e2e (379 autres verts, tests unitaires et migrations verts). Ce test connectait OWNER_A (présidente de TechCorp) sur TENANT_B (Marketing Pro), ce que s46b refuse. `newSession` attendait alors en vain une sortie de `/login` et dépassait 15 s. 4cd96448 réécrit ce seul test et ajoute la section « Correctif CI (PR 90, 2026-11-26) » au plan.

## Ce qu'a changé 4cd96448

- **Fichiers touchés** : `git show 4cd96448 --name-only` ne liste que `e2e/member-annual-import.spec.ts` et `docs/plans/s56-import-annuel-coordonnees.md`. **Aucun code applicatif n'a changé.**
- **Ce que fait le nouveau test** :
  1. Il ouvre un contexte neuf (cookie `NEXT_LOCALE=fr` sur TENANT_B).
  2. Il soumet les identifiants d'OWNER_A sur `TENANT_B/login/prestataire`.
  3. Il vérifie le refus : `form .text-red-500` visible, l'URL reste sur `/login/prestataire`, aucun cookie `session_token` sur TENANT_B.
  4. Il visite ensuite `TENANT_B/bureau/proprietaires/mise-a-jour` et vérifie qu'il arrive sur `/login`, sans bouton « Mettre à jour les fiches », sans marqueur `s56-e2e` et toujours sans cookie de session.

## Les sélecteurs et les attentes sont-ils réels ?

- **Sélecteur du refus** : `form .text-red-500` est identique à `refusalMessage` dans `e2e/auth.spec.ts:95-99`, avec le même délai de 15 s. Les tests s46b, qui passent en CI, s'en servent pour le même scénario (membre de A refusé sur B, `auth.spec.ts:181-205`).
- **Cookie de session** : le filtre `cookie.name.includes('session_token')` est identique à `sessionCookiesOn` dans `auth.spec.ts:69-72`. Il couvre aussi le préfixe `__Secure-` de Better Auth.
- **Saisie** : la séquence `goto /login/prestataire`, `waitForLoadState('networkidle')`, `form` visible, puis `fill` et `click` reprend `submitCredentials` (`auth.spec.ts:80-92`) à l'identique.
- **Redirection** : `src/proxy.ts:43-45` redirige vers `/login` toute route authentifiée sans cookie de session. `/bureau` figure dans `AUTHENTICATED_SEGMENTS` (`src/lib/routing/authenticated-segments.ts:9-14`). Le matcher du proxy couvre la route. Le redirect est un 307 côté serveur : pas d'attente fragile.
- **Constantes** : `TENANT_B`, `OWNER_A`, `PASSWORD`, `MARKER` et `ANNUAL_ROUTE` existent dans la spec (lignes 33-60). OWNER_A est bien la présidente de TechCorp, PASSWORD est celui du seed utilisé partout.

## Le test peut-il passer à vide, ou être instable ?

- **Pas à vide.** Si la connexion croisée réussissait (régression de s46b), il n'y aurait pas de message rouge dans le formulaire, l'URL quitterait `/login/prestataire` et un cookie `session_token` serait posé : trois attentes échoueraient. Si le proxy cessait de protéger `/bureau`, `toHaveURL(/\/login/)` échouerait, puisque l'URL resterait `/bureau/proprietaires/mise-a-jour`.
- **Deux attentes sont triviales.** Après la redirection vers `/login`, le bouton absent et le marqueur absent ne prouvent rien de plus : ce sont les attentes d'URL et de cookie qui portent la preuve. Elles sont redondantes, pas trompeuses : je ne les relève pas.
- **Risque d'instabilité faible.** Le schéma est le même que les tests s46b, verts en CI.

## L'isolation entre associations reste-t-elle prouvée ?

Oui. Le test d'accès croisé exigé par AGENTS.md est « accès croisé : déposé sur Marketing Pro, le fichier ne touche aucune fiche de TechCorp » (ligne 568).

- La présidente de Marketing Pro dépose le même fichier sur son domaine.
- Le rapport annonce 0 fiche mise à jour.
- Les fiches et adresses de TechCorp sont relues en base sous RLS avant et après : elles sont inchangées.

Deux autres tests complètent cette preuve :

- le Bureau de Marketing Pro n'a ni l'écran ni le bouton (ligne 393) ;
- le test réécrit prouve qu'une présidente d'une autre association n'obtient aucune session sur le domaine.

L'ancien test supposait une session croisée qui n'existe plus depuis s46b. Cookies liés à l'hôte et refus à la connexion : il n'y a rien d'autre à prouver côté navigateur.

## Conformité au plan

- [x] **Le code fait ce que le plan demande, rien de plus.** La section « Correctif CI (PR 90, 2026-11-26) » décrit exactement la réécriture : refus, page restée sur `/login`, aucun cookie, route annuelle sans écran ni marqueur. Elle annonce aussi « pas de changement du code applicatif », ce qui est vérifié. Les décisions A à D et les correctifs du tour 1 sont inchangés depuis le tour 2.

## Anti-hallucination

- [x] **Aucune API, fonction ou import inventé.** J'ai ouvert chaque cible : `auth.spec.ts` (helpers), `src/proxy.ts`, `authenticated-segments.ts` et les constantes de la spec.
- [x] **Pas de valeur ni de logique plausible mais fausse.** Sélecteur, nom de cookie et cible de redirection correspondent au code réel.
- [x] **Le commit fait ce qu'il annonce.** Son message et la section du plan décrivent fidèlement le test.

## Conformité aux règles

- [x] **Conventions du dépôt (AGENTS.md) respectées.** La preuve d'isolation reste un e2e Playwright, comme le veut la règle « RLS non testable en unitaire ».
- [x] **Aucun ADR accepté contredit.**
- [x] **Design system** : rien de nouveau dans ce tour (M2 corrigé au tour 1).

## Tests

- [x] **Contrôles lancés par moi :**
  - `npx tsc --noEmit` : code 0, aucune sortie.
  - `npx eslint e2e/member-annual-import.spec.ts` : code 0.
  - Prettier sur la spec : conforme.
- [x] **Tests non relancés.** L'e2e et `pnpm build` ne tournent pas ici (CI). Je n'ai pas relancé les tests unitaires : 4cd96448 ne touche aucun code couvert par eux. Le dernier passage vert date de 088795ff (6960 tests, sur une copie en disque local).
- [x] **Les attentes fixent les critères.** Elles échoueraient sur une régression de s46b ou du proxy.

## Régressions

- [x] **Aucun impact sur l'existant.** Seul un test e2e et le plan changent.

## Constats

**Critiques** : aucun. **Majeurs** : aucun.

**Mineurs**

- **m1 (ouvert, reporté)** : `my-email-service.ts` et `purgeExpiredPendingEmailsDao` / `deletePendingEmailsAddedByDao`. Une adresse désactivée par l'import puis réajoutée par le membre passe en attente. Si cette attente est purgée, la ligne disparaît avec sa trace et son `unsubscribed_at`, ce qui contredit l'ADR 076 §4.
- **m2 (ouvert, reporté)** : les ADR 076 et 077 sont encore `Status: proposed`.
- **m4 (ouvert, reporté)** : le plan (décision 2, tâche 5) décrit toujours `replaceMemberAccount` et l'opération `demote`, alors que le code désactive l'adresse puis ajoute la titulaire.
- **m6 (ouvert, reporté)** : dans `member-annual-import-service.ts`, la voie de défense `board_email_required` annule toute la transaction de la fiche. Elle est inatteignable en pratique.
- **m7 (ouvert, reporté)** : le type de l'instantané existe en double, `PennylaneImportSnapshotModel` et `PennylaneImportSnapshot`, reliés seulement par un cast.
- **m8 (ouvert, reporté)** : dans le plan, tâches 4 et 5, l'indentation de deux lignes de continuation a été retirée (bruit de diff).
- **m9 (nouveau)** : `docs/plans/s56-import-annuel-coordonnees.md`, section « Correctif CI ». La puce ajoutée indente ses lignes de continuation de 2 espaces, Prettier en attend une autre. `prettier --check` signale le fichier, qui ne passait déjà pas avant ce commit (même famille que m8). La CI ne lance pas `pnpm format` : sans effet sur le rendu ni sur la CI.

Max severity: minor
Ship allowed: yes
