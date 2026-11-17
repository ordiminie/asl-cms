# Review — Story s55-adresses-typees-entreprise

> Revue du 2026-11-17, subagent `reviewer` en contexte neuf (`/ks-orchestrator`), round 1.
> Diff revu : `git diff main...feature/s55-adresses-typees-entreprise` — un commit, `9ce40adb`.
> Aucun critique ni majeur, six mineurs.

## Tests et contrôles lancés par le relecteur

- `pnpm test --run` : 381 fichiers passent, 1 échoue ; 4896 tests passent, 1 échoue, 1 ignoré. L'échec est
  un dépassement de délai (montage 9p) dans `src/lib/better-auth/magic-link-integration-imports.test.ts`
  (« Test timed out in 5000ms »), fichier non touché par la story ; relancé seul : 2 tests sur 2. Le
  dépassement n'est pas compté comme un passage : échec par délai constaté, puis réussite en relance isolée.
- `tsc --noEmit -p .` : 0 erreur.
- ESLint sur les fichiers .ts / .tsx modifiés : propre.
- Ni `pnpm build` ni e2e (CI) ; les specs e2e modifiées ont été lues.

## Grille

**Conformité au plan** — [x] les 9 tâches, arbitrages du 17/11 inclus ; écarts annoncés justifiés.

**Anti-hallucination**

- [x] Aucune API, fonction ou import inventé : `getAssociationSettingsService` (lit sous `withTenant`),
  `textSettingOf`, `resolveSettings`, `definitionOf`, `Separator` (`src/components/ui/separator.tsx`),
  `cellOf`, `present` vérifiés.
- [x] Cas limites vérifiés : colonnes facultatives absentes, colonnes de livraison partielles, code postal à
  4 chiffres complété sur les deux adresses, terrain partiel du fichier prioritaire sur le défaut.
- [x] Le code fait ce qu'il annonce, à un commentaire près (constat 1).

**Conformité aux règles**

- [x] AGENTS.md : `getDb()`, aucun `withRlsBypass` nouveau, aucune table nouvelle, RLS intacte, identité de
  fiche inchangée, libellés dans `messages/fr.json`.
- [x] ADR 010 : aucune valeur du premier tenant dans le code ; la recherche ne cite que des comptages agrégés
  du fichier client, rien de nominatif. ADR 058 : renommage et paramètres sans défaut, comme décidé.
- [x] Design system et intention de l'écran respectés, sous réserve du constat 2.

**Tests**

- [x] Suite verte, hors le dépassement de délai ci-dessus.
- [x] Assertions sur les critères : terrain seul → incomplète (règle TS et compteur SQL) ; écriture du
  membre sans `land_*` ni `company_name` ; inversion par la livraison ; entreprise par `Type de Client` ;
  particulier avec SIREN sans libellé ; export sans colonnes facultatives accepté ; défaut appliqué aux
  seules fiches créées, réglages lus une fois par import ; message d'erreur qui nomme le groupe.

**Régressions**

- [x] Plus aucune référence aux anciennes colonnes dans `src`, `e2e`, `scripts`, ni dans les migrations hors
  `0029` (création de la table). Les specs e2e qui remplissaient « Adresse », « Code postal », « Commune »
  ciblent le groupe du domicile. La seed ne casse pas `e2e/member-import.spec.ts`.

## Points vérifiés

- **Migration `0062_shocking_mathemanic.sql`** : 4 `RENAME COLUMN`, 5 `ADD COLUMN`, aucun `DROP` ; snapshot
  `0062` chaîné sur `0061`, entrée `idx 62` au journal ; seule `member_profile` diffère — sortie du
  générateur.
- **Écriture du membre (s16, s53)** : `MemberPostalContactWrite`, `updateMyMemberProfilesContactDao` et
  `updateMyContactServiceSchema` limités au téléphone et au domicile ; `postalContactOf` sur le domicile.
- **Incomplétude** : domicile seul dans `isIncomplete` et dans `countMemberProfilesDao`.
- **Import** : règle de la livraison conforme à l'arbitrage ; `NO_CONTACT` et la remarque « même nom et
  même adresse » sur le domicile ; entreprise → libellé = Dénomination ; terrain par défaut lu dans les
  réglages, fiches créées sans aucune partie de terrain seulement.
- **Actions du bureau** : neuf champs via `MEMBER_CONTACT_FORM_FIELDS`, création et mise à jour.
- **`docs/architecture.md`** : hors longueur des séparateurs de tableau, seul changement de contenu = ligne
  `member_profile` de la story.

## Écarts annoncés par l'implémenteur

1. `e2e/member-roles.spec.ts` modifié — nécessaire (libellés en double) ; mineur, hors liste du plan.
2. Format `postal-code` et réglages sans section — ajout propre sur le modèle de `verification-code`, message
   et test dédiés ; placement dans la carte d'origine conforme, mais titre inadapté (constat 4).
3. Livraison identique à l'adresse → domicile et terrain identiques — application littérale de l'arbitrage,
   accepté.
4. Bannière, « Annuler », note du mockup — texte du design respecté ; `outline` est le bouton existant (le
   design se trompait en le disant `ghost`) ; la note n'existait que dans le mockup, le .md dit « sans
   mention ». Accepté.
5. Écritures du bureau testées au service — ce que demandait la tâche 4. Accepté.
6. `docs/stories.md` non formaté — déjà non conforme sur main (constat 6).

## Constats

1. **Mineur** — `src/services/rules/parcel-ownership-rules.ts`, commentaire de `isIncomplete` : renvoie à
   `getMemberProfilePageDao` pour la copie SQL, qui vit dans `countMemberProfilesDao`
   (`member-profile-repository.ts` l. 374). Référence fausse sur la règle à garder alignée.
2. **Mineur** — `member-contact-fields.tsx`, `MemberAddressFieldset` : le design cite « `fieldset` /
   `legend` (§3.1) », que le §3.1 du design system ne décrit pas. Premier `<legend>` du produit
   (`text-[17px] font-semibold`) ; aucun jeton ni couleur hors système (17 px = corps, `muted-foreground`,
   `Separator` du socle), cohérence intacte. Gap du design system déclaré à tort « couvert » : à consigner
   dans `docs/design-system.md`.
3. **Mineur** — `association-settings-types.ts` : `POSTAL_CODE_PATTERN` et `maxLength: 5` recopient
   `MEMBER_PROFILE_POSTAL_CODE_PATTERN` au lieu de le réutiliser ; risque de divergence.
4. **Mineur, ergonomie** — Réglages : les deux paramètres du terrain par défaut apparaissent dans la carte
   « Adresses de notification », dont le titre ne leur correspond pas (elle porte déjà la teinte et la
   description).
5. **Mineur** — `e2e/member-roles.spec.ts` hors « Files touched » du plan ; justifié.
6. **Mineur** — le plan s55 et `docs/stories.md` ne passent pas `prettier --check` (`stories.md` déjà non
   conforme sur main).

Max severity: minor
Ship allowed: yes
