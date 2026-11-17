# Review — Story s55-adresses-typees-entreprise

> Revue du 2026-11-17, subagent `reviewer` en contexte neuf (`/ks-orchestrator`), **round 2**.
> Diff revu : `git diff main...feature/s55-adresses-typees-entreprise` — commits `9ce40adb` (story),
> `f30226fd` (rapport du round 1), `6eff912b` (correctif e2e, revu comme du code neuf).
> Aucun critique ni majeur.

## Ce que le round 1 a trouvé, ce que ce round corrige

- **Round 1** (`9ce40adb`) : six mineurs, aucun critique ni majeur, livraison autorisée. Le défaut de
  sélecteur lui a échappé : la ligne « régressions » disait vrai pour les champs d'adresse, ciblés dans leur
  groupe, mais n'avait pas examiné le `getByLabel(/^Nom de l’entreprise/)` non ciblé ajouté à
  `e2e/member-profiles.spec.ts:835`.
- **CI de la PR 72** : le job « Tests e2e (build de production) » échoue sur ce test, trois essais :
  `strict mode violation: getByLabel(/^Nom de l’entreprise/) resolved to 2 elements`
  (`#member-contact-companyName` et `#member-profile-companyName`).
- **Ce round** : `6eff912b` remplace ce sélecteur par
  `bureau.getByRole('textbox', {name: /^Nom de l’entreprise/})`. `git diff 9ce40adb..feature/s55` ne touche
  que le rapport et ces quatre lignes du spec.

## Cause vérifiée : défaut du test, pas du produit

- `createProfile` passe par `goto('/nouveau')`, puis le formulaire navigue côté client
  (`router.push(createdProfilePathOf(...))`, `member-profile-form.tsx:157`) : l'écran de création reste
  monté, caché (`<Activity>`, documenté dans `member-profile-form.tsx:117-128`).
- `nouveau/page.tsx` et `[id]/page.tsx` sont des routes sœurs sous `(bureau)/bureau/proprietaires/`, sans
  layout qui rende les deux : l'utilisateur ne voit jamais deux formulaires.
- La règle est déjà consignée : `docs/research/s12d-comptes-membres.md:307-322` (« en e2e, des sélecteurs
  par rôle — `getByRole` ignore le contenu masqué ; `getByLabel` non ») et appliquée dans le même spec,
  l. 888-923.
- Les deux identifiants viennent de `MemberTextField` avec l'`idPrefix` de l'appelant
  (`member-contact-fields.tsx:235-241`).

## Le nouveau sélecteur résout un seul élément

- Nom accessible « Nom de l’entreprise » + marqueur facultatif (`<Label htmlFor>`) : la regex correspond.
- L'instance cachée de `/nouveau` est exclue par `getByRole`.
- Sur la fiche, le formulaire de contact n'existe qu'en édition (`member-profile-detail.tsx:226`), que le
  test vient d'ouvrir ; le `<dt>` en lecture (l. 522) n'est pas un champ texte.

## Autres sélecteurs e2e de la story

Aucune copie latente du défaut (lecture seule, e2e non lancés) :

- reste du test s55 : `addressGroup(...)` est un `getByRole('group')`, boutons et `status` par rôle, puis
  `openProfile` repart d'un `goto` ;
- tests du domicile (l. 722) et du téléphone (l. 774) : après `goto`, aucune route cachée ;
- assistants de `member-accounts.spec.ts` et `member-roles.spec.ts` : `/nouveau` fraîchement chargé,
  adresses ciblées dans le groupe du domicile ;
- carte du membre : ciblée dans la région « Mes coordonnées », qui ne rend que le domicile ;
- test « formulaire vierge » (l. 880) : lectures par rôle.

## Tests lancés par le relecteur

- `pnpm test --run` : `Test Files 1 failed | 381 passed (382)`, `Tests 1 failed | 4896 passed | 1 skipped`.
  L'échec est un dépassement de délai à 5000 ms dans `src/lib/better-auth/magic-link-integration-imports.test.ts`,
  fichier non touché ; non compté comme un passage. Relancé seul : `Tests 2 passed (2)` (4,97 s, au ras de
  la limite : lenteur du montage 9p).
- Ni `pnpm build` ni e2e (CI).

## Grille

- [x] Conformité au plan : le correctif sert la tâche e2e du plan ; rien au-delà.
- [x] Aucune API inventée : `getByRole('textbox', {name: RegExp})`, déjà employé dans ce spec (l. 921, 926).
- [x] Aucune logique plausible mais fausse : cause vérifiée ci-dessus.
- [x] Le message du commit correspond au diff.
- [x] AGENTS.md : un commit de story, plus un correctif de test, écrasés au merge.
- [x] Aucun ADR contredit ; aucune modification d'écran ce round.
- [x] Suite lancée par le relecteur : verte une fois le dépassement de délai isolé.
- [x] Les assertions tiennent : le test vérifie toujours l'écran (région « Coordonnées ») et la base
  (`company_name`) ; aucune n'est affaiblie.
- [x] Aucune régression : seul le test s55 change.
- [x] Le verdict du round 1 tient sur l'ensemble du diff.

## Constats

1. **Mineurs du round 1, toujours ouverts**, non affectés par ce round :
   - commentaire de `isIncomplete` qui renvoie à `getMemberProfilePageDao` au lieu de `countMemberProfilesDao` ;
   - `fieldset` / `legend` absents du §3.1 du design system (gap à consigner) ;
   - `POSTAL_CODE_PATTERN` recopié au lieu d'être réutilisé ;
   - titre « Adresses de notification » de la carte des réglages, inadapté aux paramètres du terrain ;
   - `e2e/member-roles.spec.ts` absent de la liste des fichiers du plan ;
   - plan et `stories.md` non formatés par Prettier.
2. **Mineur** — `e2e/member-profiles.spec.ts:835` : contrairement aux l. 888-890, le nouveau sélecteur ne dit
   pas pourquoi il passe par le rôle (l'instance cachée de `/nouveau`) ; un prochain auteur pourrait revenir
   à `getByLabel`.

Max severity: minor
Ship allowed: yes
