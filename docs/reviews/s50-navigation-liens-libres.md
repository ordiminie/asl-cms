# Revue de la story s50-navigation-liens-libres (tour 2)

**Tour précédent.** Le tour 1 portait sur les commits 585ba16b et ed347730. Il a relevé un majeur et cinq mineurs.

- **Le majeur (constat 1)** : `URL.canParse` était utilisé dans `isExternalHttpsAddress`. Ce prédicat tourne aussi côté client, et `URL.canParse` manque à la cible de navigateurs de Next 16 (Safari 16.4, Chrome 111, Firefox 111). Sur ces navigateurs, saisir une adresse `https://` levait une `TypeError`.
- **Les mineurs (constats 2 à 6)** : `https:///hôte` et `https://@hôte` acceptés ; ligne `menu_item` absente de `docs/architecture.md` ; test e2e d'accès croisé sans repère positif ; filtre `page_id is null` de `updateMenuLinkDao` non fixé par un test ; découpage modèle/migration entre les deux commits.

L'utilisatrice a choisi de ne corriger que le majeur. C'est le commit 727794b4 (tâche 10 du plan). Les mineurs restent ouverts pour le tour final, sans être aggravés.

> Diff relu : `git diff main...feature/s50-navigation-liens-libres`, soit 3 commits. Les deux premiers n'ont pas bougé depuis le tour 1. J'ai relu le commit de correctif comme du code neuf.

**En bref :** aucun critique, aucun majeur, six mineurs (les cinq du tour 1 encore ouverts, et un nouveau sur le test du correctif). Le correctif est juste et son test échoue bien sans lui. Le ship est autorisé.

## Conformité au plan

- [x] Le code fait ce que le plan demande, rien de plus.
  - **Tâches 1 à 9** : rien n'a changé depuis le tour 1, et les constats de ce tour tiennent. La tâche 9 reste non faite, volontairement (constat 3).
  - **Tâche 10** (ajoutée à `docs/plans/s50-navigation-liens-libres.md` par 727794b4) est faite à la lettre :
    - `URL.canParse` est remplacé par `new URL(address)` dans un `try`/`catch` qui rend `undefined`, et l'appelant en déduit `false` ;
    - le test est écrit en simulant l'absence de `URL.canParse` ;
    - la case est cochée.
  - Le commit ne touche que trois fichiers : `link-address.ts`, `link-address.test.ts` et le plan. Rien d'autre que ce que la tâche demande.

## Anti-hallucination

- [x] Aucune API, fonction ou import inventé.
  - `new URL` et les champs `protocol`, `hostname`, `username` et `password` sont du WHATWG standard.
  - Ce sont les mêmes que ceux qu'utilisait déjà la version d'avant.
  - L'import `afterEach`/`beforeEach` de vitest existe bien.
- [x] Le correctif retire **tous** les usages de `URL.canParse` que le client peut atteindre.
  - `git grep canParse` sur la branche ne trouve dans `link-address.ts` qu'une mention en commentaire.
  - Il reste un seul autre usage : `src/lib/pennylane/pennylane-schemas.ts:27`. Il est hors du diff et uniquement côté serveur (déjà noté au tour 1).
- [x] Le comportement du prédicat n'a pas changé.
  - Par spécification WHATWG, `URL.canParse(x)` vaut exactement « `new URL(x)` ne lève pas ».
  - L'ancien code faisait d'ailleurs `canParse` puis `new URL` sur la même entrée, sans base.
  - Les 33 cas d'origine de `link-address.test.ts` passent inchangés.
  - Le commentaire JSDoc qui donne la raison est exact : `canParse` n'arrive qu'avec Chrome 120, Firefox 115 et Safari 17.
- [x] Pas de logique plausible mais fausse dans le correctif. Le constat 2 (forme de l'hôte) est antérieur et reste mineur.

## Conformité aux règles

- [x] Conventions du dépôt (AGENTS.md) :
  - le prédicat reste pur, sans horloge ni `logger`, donc toujours utilisable sous `'use cache'` ;
  - les erreurs sont gérées explicitement (le `catch` rend une valeur, il ne masque pas une erreur) ;
  - le commit suit Conventional Commits.
  - Un second commit avant le squash ne pose pas de problème.
- [x] Aucun ADR accepté n'est contredit. L'ADR 078 tient toujours, et l'écart mineur au §3 est le constat 2.
- [x] Design system : le correctif n'a aucune surface d'interface. La conformité vérifiée au tour 1 tient.

## Tests

- [x] Suite lancée par le reviewer, sur une copie de la branche en disque local (`git archive`, `node_modules` lié) : `pnpm test --run` donne `Test Files  504 passed (504)` et `Tests  7063 passed | 4 skipped (7067)`.
  - Il y a 4 tests de plus qu'au tour 1, soit exactement les 4 cas ajoutés.
  - Les 3 tests sautés en plus viennent de `ops/ops-config.test.ts:497` (`it.skipIf(!insideGitWorkTree())`) : la copie n'a pas de `.git`. Ce fichier est hors du diff.
  - Aucune expiration sur la copie locale.
- [x] `tsc --noEmit` sur la copie : aucune erreur.
- [x] `eslint` sur `link-address.ts` et `link-address.test.ts` : code 0.
- [x] **Le test échoue bien sans le correctif.** Le `link-address.ts` d'avant 727794b4 remis en place, le fichier de test donne : `Tests  3 failed | 34 passed (37)`, avec `TypeError: URL.canParse is not a function` sur l'acceptation de `https://www.saint-etang.fr` et sur les refus de `https://` et `https://a@b.fr`. Le test de garde `simule bien un navigateur sans URL.canParse` empêche que le masquage devienne inopérant sans bruit.
- [x] **Le masquage est bien restauré dans la configuration réelle.**
  - Le fichier tourne dans le projet `client` (jsdom).
  - Là, vitest remplace `global.URL` par une sous-classe, `class URL extends URL$1` (`createJSDOMCompatURL`, `node_modules/vitest/dist/chunks/index.DC7d2Pf8.js`). `canParse` n'y est donc pas une propriété propre : elle est héritée.
  - `defineProperty` pose une propriété propre `undefined` qui masque l'héritée, et `Reflect.deleteProperty` la retire, ce qui rend l'héritage.
  - Une sonde ajoutée à la fin du fichier, dans une copie jetable, passe avec `Tests  38 passed (38)` : après le bloc, `typeof URL.canParse === 'function'`, aucune propriété propre, et `URL.canParse('https://a.fr') === true`.
  - Le constructeur `URL` natif de Node n'est jamais touché : rien ne fuit vers les autres fichiers. Voir aussi le constat 7.

## Régressions

- [x] Aucun effet sur les chemins existants.
  - Le prédicat garde la même signature et le même contrat.
  - Ses appelants n'ont pas bougé : schéma du formulaire, schéma du service, Server Action, rendu public et rendu du bureau.
  - Toute la suite est verte.

## Constats

Le constat 1 du tour 1 (major) est **résolu** par 727794b4, et vérifié ci-dessus.

2. **minor** (tour 1, ouvert) — `src/lib/helper/link-address.ts` accepte `https:///evil.com` et `https://@evil.com`, que le navigateur réécrit en `https://evil.com/`.
   - Cela contredit la lettre de l'ADR 078 §3 et de la décision 7 du plan.
   - Aucun effet sur la sûreté.
   - Le correctif n'y change rien. C'était attendu : le comportement est volontairement le même.
   - Correctif suggéré : exiger que le caractère après `https://` ne soit ni `/` ni `@`, et ajouter ces deux cas au `it.each` des refus.

3. **minor** (tour 1, ouvert) — `docs/architecture.md`, la ligne `menu_item` de la tâche 9 n'est pas posée. C'est déclaré et prévu par le plan, et la ligne reste à poser au moment de `/ks-ship`. Les modifications non commitées de ce fichier dans l'arbre ne font pas partie de la story.

4. **minor** (tour 1, ouvert) — `e2e/site-navigation.spec.ts`, test d'accès croisé :
   - il ne fait que des assertions négatives, sans repère positif qui prouve que la page du tenant B s'est bien rendue ;
   - rien ne tente de modifier, depuis le tenant B, une entrée du tenant A.

5. **minor** (tour 1, ouvert) — `src/db/repositories/menu-item-repository.ts`, `updateMenuLinkDao` : le filtre `page_id is null` porte l'arbitrage 2 et l'ADR 078 §5, mais aucun test n'exécute la vraie requête.

6. **minor** (tour 1, ouvert) — commits : le modèle est dans 585ba16b et la migration seule dans ed347730. Revenir sur la migration seule laisserait le modèle sans la migration qui lui correspond. Sans effet après le squash.

7. **minor** (nouveau, commit 727794b4) — `src/lib/helper/link-address.test.ts:78-80` : la restauration ne marche que par effet de bord d'un détail interne de vitest.
   - `afterEach` fait `Reflect.deleteProperty(URL, 'canParse')` au lieu de remettre le descripteur d'origine. Cela ne restaure `canParse` que parce que vitest-jsdom expose une sous-classe de `URL` où la méthode est héritée.
   - Sur le `URL` natif de Node, où `canParse` est une propriété propre (`configurable: true`), la même séquence la supprime pour de bon (vérifié avec `node -e`, qui affiche `undefined` après coup).
   - Le jour où ce fichier passerait sous l'environnement `node`, ou si vitest changeait `createJSDOMCompatURL`, le masquage fuirait vers le reste du fichier. Aucun effet aujourd'hui : c'est vert et isolé par fichier.
   - Correctif suggéré : sauver `Object.getOwnPropertyDescriptor(URL, 'canParse')` dans `beforeEach`, puis le remettre (`defineProperty` s'il existait, `deleteProperty` sinon). Ou bien `vi.stubGlobal` / `vi.spyOn` avec restauration.

## Fichiers concernés

- src/lib/helper/link-address.ts
- src/lib/helper/link-address.test.ts
- docs/plans/s50-navigation-liens-libres.md

## Verdict

Max severity: minor
Ship allowed: yes
