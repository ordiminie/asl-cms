# Review — Story s13-import-initial-membres

> Revue en contexte neuf. Diff jugé : `git diff origin/main...feature/s13-import-initial-membres` (commit 65c3897d, 62 fichiers).

## Conformité au plan

- Les 9 tâches sont présentes dans le diff et cochées. Le plan sur disque est identique à celui du commit.
- Écart : l'action utilise `revalidatePath` là où le plan disait `updateTag` (M2).

## Anti-hallucination

- Les symboles et signatures vérifiés existent : `withTenant`, `createMemberProfileService`, `findMemberProfileIdByPennylaneIdService`, `attachParcelService`, `getOrganizationByIdService`, `requireActionAuth({roles})`, `MEMBER_PROFILES_ROUTE_PATTERN`, `getMemberProfileByPennylaneIdDao`, `findOrCreateParcelTxnDao`.
- Migration 0039 : trois instructions prévues (deux colonnes et l'index unique partiel) ; modèle, SQL, journal et snapshot cohérents.
- Atomicité par membre : `MemberRejected` est levée dans le scope `withTenant` ; fiche, compte et parcelles sont annulés ensemble. Seul l'e2e (CI) le prouve (M6).
- Idempotence par `pennylane_customer_id` ; une parcelle déjà au même membre compte comme « déjà présente ».
- Gardes : SuperAdmin dans l'action et dans le service. Aucun `withRlsBypass`, aucun appel de DAO direct (ADR 029).
- Aucune donnée de ligne dans le journal (quatre compteurs seulement). Aucune donnée client réelle dans git (fixture fictive).
- La date sentinelle ne s'affiche jamais comme une date (fiche du bureau et espace membre, testé).

## Règles

- Couches respectées ; libellés dans `messages/fr.json`.
- Design : composants du plan uniquement ; écart connu du plan : texte « N membres. » de la carte.
- ADR en collision (M1).

## Tests

Exécutés par le relecteur : 85 fichiers, 1824 tests passés, 1 ignoré, sans délai dépassé. L'e2e n'a pas été exécuté (CI).

## Findings

- **M1 (major)** — `docs/decisions/046-cles-d-import-portees-par-le-modele.md` et `046-polices-hebergees-avec-le-site.md` (s51, déjà sur main) portaient le même numéro. **Corrigé** dans le commit de correctif : l'ADR de s13 est renuméroté 048 (`docs/decisions/048-cles-d-import-portees-par-le-modele.md`), titre, plan, commentaires du code, tests et e2e mis à jour ; l'ADR 046 de s51 est intact.
- **M2 (minor)** — `revalidatePath` au lieu de `updateTag` : aucun tag de liste n'existe, cohérent avec `bureau/proprietaires/actions.ts`. À noter dans la PR.
- **M3 (minor)** — `MEMBER_IMPORT_MAX_LINES = 2000` sans justification chiffrée. À expliquer dans la PR ou à lier à la durée mesurée en CI.
- **M4 (minor)** — `.gitignore` (règles `/docs/inputs/` et `*.xlsx`) modifié mais non commité. **Corrigé** : les deux règles sont commitées dans le commit de correctif.
- **M5 (minor)** — Relance après une vente : la parcelle vendue est rejetée (« déjà à un autre membre »). Correct et sans dommage ; le rapport doit rester compréhensible.
- **M6 (minor)** — Atomicité et ouverture de compte prouvées par l'e2e seul : vérifier que la CI est verte avant le merge.

Max severity: major
Ship allowed: yes
