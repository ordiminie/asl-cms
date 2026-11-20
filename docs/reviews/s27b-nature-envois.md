# Review — Story s27b-nature-envois

> **Round 2**, 20/11/2026. Subagent `reviewer` en contexte neuf. Diff jugé :
> `git diff main...feature/s27b-nature-envois` (`348698b9` story, `1fac7e26` revue du round 1,
> `26e288b7` correctif CI relu comme du code neuf). Tests lancés dans un worktree détaché, sur disque local.

## Round 1, puis ce qui a changé

**Round 1** (commit `348698b9`) : aucun critique ni majeur, trois mineurs (m1 à m3, ci-dessous). Les six
critères étaient couverts par des tests qui échoueraient si le comportement disparaissait. Le round 1 a
aussi vérifié la migration 0071, le refus serveur des clés réservées au SuperAdmin, le défaut
`facultative`, la nature figée à la création et la page de désinscription.

**Entre les deux rounds**, la CI de la PR 78 (run 44729232108) a échoué sur les e2e : 2 échecs, 1 test
instable, 304 passés. Le correctif `26e288b7` (plan, tâches 11 à 13) ne touche que
`e2e/campaigns.spec.ts` et le plan. Le code de l'application ne change pas.

## Correctif CI — les causes, vérifiées

**C1 — confirmée** (`e2e/campaigns.spec.ts:1524`). L'objet saisi par le test était trop long :
« Documents avant reclassement s27b-… ».

- **Preuve** : l'`error-context.md` de la CI montre « Objet : 6 caractères de trop » et « 45 / 39 ».
- **Le plafond vaut bien 39** : 60 caractères (`CAMPAIGN_SUBJECT_MAX_TOTAL`), moins le préfixe
  « TechCorp Solutions — », retiré par `subjectMaxLength`.
- **Le composeur avait raison de refuser.**
- **Correctif** : objets raccourcis, et `natureSubjectOf` contrôle désormais la longueur. Tous les objets
  font au plus 39 caractères ; la borne est inclusive, prouvée en CI par un objet de 39 caractères qui
  passe.

**C2 — cohérente, prouvée indirectement** (`e2e/recipient-groups.spec.ts:438`, test de s27).

- **Pas de parallélisme** : la CI tourne avec 1 worker (`playwright.config.ts:35-37`).
- **Pas le plafond de campagnes** : l'écran annonçait « 2 membres la reçoivent aujourd'hui ».
- **Mais la part n'a pas été tentée** : « Reçue 0 / Programmée 2 / En échec 0 ». C'est la forme d'un
  report faute de budget (`campaign-service.ts:1021-1033`, ADR 053 : 200 envois reportables par jour).
- **Origine probable** : `campaigns.spec.ts` est en mode serial, et l'échec de C1 l'a fait rejouer en
  entier trois fois, ce que montrent les dossiers `-retry1`. Chaque passage consomme du budget.
- **Limite de la preuve** : aucune trace directe du compteur épuisé. Le correctif de C1 supprime de toute
  façon ces rejeux, et le bloc s27b relève puis remet le compteur du jour.

**C3 — antérieure à s27b** (`campaigns.spec.ts:622`, instable). `file-transport.ts:17` écrit par
`fs.writeFile`, une écriture non atomique. Le fichier n'a pas changé depuis s03, et l'échec n'est apparu
qu'au troisième passage, provoqué par C1. Le constat est noté dans le plan, sans correction ici.

## Points vérifiés

- **Aucune assertion affaiblie** : sur toute la branche, `e2e/` gagne 470 lignes et n'en perd aucune.
  `recipient-groups.spec.ts` et `playwright.config.ts` ne sont pas touchés.
- **Remise du compteur de budget** (`campaigns.spec.ts:1369-1414`, `1474-1490`).
  - Patron repris de `e2e/email-budget.spec.ts:142-178` et `294-330`. Le jour est relevé en `beforeAll`,
    après des fixtures qui n'envoient rien.
  - Des `try/finally` imbriqués garantissent la remise, même si le nettoyage échoue.
  - Aucune spec n'affirme ce que consomment les campagnes : la remise ne cache aucun défaut.
- **Le test 1524 peut aller jusqu'au bout.** Tous les sélecteurs et libellés existent dans l'application :
  le titre « Nature des envois », les `radiogroup`, la radio désactivée pour le bureau, la phrase
  `campaignNature.superAdminOnly`, « Enregistrer les réglages », « Réglages enregistrés. ». Le
  reclassement s'applique à l'envoi suivant, car les réglages sont lus sans cache. Ce qui suit la l. 1531
  n'a pourtant jamais tourné en CI : la preuve viendra du prochain run.
- **Plan** : les tâches 11 à 13 sont cochées et conformes au diff.

## Constats

### Critical

Aucun.

### Major

Aucun.

### Minor

- **m1** (round 1, ouvert) — `src/services/__tests__/association-settings-service.test.ts:223-276` : le
  refus au bureau n'est pas testé sur une clé de nature, par exemple `campaign.nature.free: 'statutaire'`.
  La protection existe, mais elle n'est prouvée qu'indirectement.
- **m2** (round 1, ouvert) — `src/services/association-settings-service.ts:98-100` : le message interne de
  l'`AuthorizationError` est périmé. Il n'apparaît que dans les journaux.
- **m3** (round 1, ouvert) — `src/services/unsubscribe-service.ts:79-81` : un échec de lecture des
  réglages met toute la page de désinscription en erreur. Correction possible : ne mettre que
  `statutoryTemplateIds` à `null`.
- **m4** (round 2) — `docs/plans/s27b-nature-envois.md:87-88` : un retour à la ligne signalé par
  Prettier. **Corrigé avec ce rapport** (Prettier appliqué au plan).

### Remarques sans gravité

- `NATURE_SUBJECT_MAX_LENGTH = 39` (`campaigns.spec.ts:1233`) recopie une valeur qui dépend du nom de
  l'association de test. C'est un outil de diagnostic : le composeur, lui, refuse toujours un objet trop
  long.
- Si `campaigns.spec.ts` est rejoué pour une autre raison, par exemple un aléa de C3, les blocs s25 et
  s26 consomment à nouveau du budget, sans remise. Le vrai correctif de C3 (écrire dans un fichier
  temporaire, puis le renommer) relève d'un correctif à part.

## Tests

| Vérification                                    | Résultat                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| `pnpm test --run --maxWorkers=2` (disque local) | 417 fichiers, **5614 réussis**, 1 ignoré, 0 timeout |
| `tsc --noEmit`                                  | 0 erreur                                            |
| `eslint` sur les TS/TSX du diff                 | 0 erreur                                            |
| e2e                                             | rejoués par la CI au prochain push                  |

Max severity: minor
Ship allowed: yes
