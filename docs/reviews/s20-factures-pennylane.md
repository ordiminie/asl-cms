# Revue — s20-factures-pennylane

Round 2 · diff `main...feature/s20-factures-pennylane` (story d9b5da79 + correctif ae6e2617, relu comme du
code neuf) · reviewer en contexte neuf.

## Résumé

Les cinq constats arbitrés (M1, m1, m2, m4, m5) sont corrigés et testés. Toutes les nouvelles références
existent avec la signature attendue (`listMemberProfilesByPennylaneIdIgnoringCaseDao`, `isHttpsUrl`,
`recordBillingSyncFailureDao(orgId, now, 'unavailable')`, `URL.canParse`). Les tâches 12 à 16 du plan sont
faites et cochées, sans dérive. L'écart déclaré (PDF https factice servi par `page.route`) est accepté.

Restent deux mineurs. Aucun critique, aucun majeur.

## Tour précédent

Le round 1 avait relevé M1 (e2e ambigu), m1 à m5. Arbitrage du 19/11 : corriger M1, m1, m2, m4, m5 ;
laisser m3 (clé d'instance unique, ADR 062 §10).

| Constat r1                                               | Correctif                                                                                                                                                                                   | Vérifié                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **M1** : locator e2e ambigu (15/03/2025 + PDF non dispo) | 880002 datée du 30/09/2025 ; les deux lignes Pennylane filtrées aussi sur `/250,00\s€/`                                                                                                     | Oui : aucun seed ni autre spec n'a 250,00 € ni le 30/09/2025 (grep `e2e/`, `src/db/scripts/`)                            |
| **m1** : erreur hors Pennylane sans trace ; doublon d'id | `uniqueInvoicesOf` dédoublonne (dernière lue gagne) ; `recordUnexpectedFailure` note `unavailable` sous `withTenant` sans jamais lever, puis l'erreur d'origine est relevée ; log = org id | Oui : quatre tests (doublon, autre erreur, erreur de base, échec de la note qui ne masque pas l'origine)                  |
| **m2** : casse ignorée au rapprochement, pas au doublon  | DAO `lower(col) = lower($1)` filtré par `organization_id` ; le service refuse si une **autre** fiche porte l'identifiant                                                                     | Oui côté service (trois tests) ; SQL non testé (m-a) ; import inchangé (m-b)                                             |
| **m3** : clé d'instance unique                           | Laissé tel quel par arbitrage                                                                                                                                                               | —                                                                                                                        |
| **m4** : `public_file_url` non validé                    | `fileUrlSchema` ramène tout non-https à `null` (`hasPdf: false`) ; le service revérifie avant `ready`                                                                                        | Oui : `it.each` (http, `javascript:`, `data:`, relative, illisible) sur schéma, liste et relecture ; trois cas de service |
| **m5** : alerte PDF jamais effacée                       | `onOpen: () => setPdfFailed(false)` avant `startTransition`                                                                                                                                 | Oui : test 1f (effacée au clic suivant, ne revient pas après succès)                                                    |

## Vérification

Copie en disque local (`git archive`, `node_modules` en lien symbolique, `.env.test` copié sans être lu) :

- `pnpm test --run` : `Test Files  415 passed (415)`, `Tests  5525 passed | 4 skipped (5529)`, exit 0, aucun
  timeout.
- `pnpm exec tsc --noEmit` : exit 0.
- `pnpm lint` : exit 0, aucune erreur.
- Pas d'e2e ni de `pnpm build`. Aucun appel à Pennylane, aucun `.env` lu.
- Sonde Playwright isolée tentée pour l'interception : Chromium ne démarre pas (`libnspr4.so` absent). Le
  point suivant est établi par analyse.

### Écart déclaré : PDF https servi par `page.route`

- **Interception** : sous Chromium (seul projet en CI), `page.route` suspend la requête au stade *Request*,
  avant DNS et TLS. `route.fulfill` répond donc pour `fichiers.pennylane.test`, et la navigation de premier
  niveau (`window.location.assign`) est interceptée.
- **Motif** : `${FAKE_PDF_URL}**` couvre `?e2e=1`. La route est posée avant le clic.
- **Assertion** : `waitForRequest(url.startsWith(FAKE_PDF_URL))` seulement. Que le PDF s'affiche ou se
  télécharge, le test passe.
- **Chaîne serveur** : 880001 renvoie l'URL https, qui passe le schéma puis `isHttpsUrl` → `ready`. Le
  critère 3 attend toujours `has_pdf: true` pour 880001, ce qui reste cohérent.
- **Ancien chemin** : plus rien n'en dépend ; `FAKE_PDF_PATH` ne sert plus qu'à composer l'URL et aux
  assertions négatives.
- **Isolation** : le rejeu depuis Marketing Pro donne `not_found` → `unavailable`.
- **Conclusion : accepté.**

### Locators contre le seed (CI à 1 worker)

Bernard Lefèvre voit c1 (15/03/2026, 412,50 €), c2 (15/03/2025, 398,00 €) et c3 (Pennylane, supprimée par la
synchronisation, restaurée en `afterAll`). `member-invoices.spec.ts` ajoute des factures à 777,77 € en 2099.

- `15/03/2026` + `250,00 €` + `En retard` : seule 880001.
- `30/09/2025` + `250,00 €` + `PDF non disponible` : seule 880002.
- `\s` couvre l'espace insécable et l'espace fine du format fr-FR.

## Couverture des critères

| #   | Critère                                                      | Test(s)                                                                                                                                                       |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Activation par configuration, interface membre inchangée     | `member-billing-provider.test.ts` ; `my-invoices-card.test.tsx` ; e2e                                                                                         |
| 2   | Statut d'origine, intermédiaires compris                     | `pennylane-invoice-mapping.test.ts` ; `member-space-invoices.test.ts` ; e2e (« En retard ») ; doublon de pagination (`pennylane-sync-service.test.ts`)          |
| 3   | Compte non rapproché signalé au bureau                       | `pennylane-sync-service.test.ts` (dont échec inattendu noté `unavailable`) ; `member-space-invoices.test.ts` 1e ; `pennylane-sync-card.test.tsx` ; e2e        |
| 4   | Rapprochement par l'identifiant de la fiche, saisi au bureau | mapping ; `member-profile-service.test.ts` (doublons à la casse près) ; `member-billing-card.test.tsx` ; e2e                                                   |
| 5   | Brouillons jamais remontés, avoirs écartés                   | mapping `it.each` ; e2e (« Brouillons écartés » = 1)                                                                                                          |
| 6   | Lecture seule                                                | `member-billing-provider.test.ts` ; `member-invoices-card.test.tsx` ; e2e                                                                                     |
| 7   | Bouton PDF quand l'API en fournit un                         | `my-invoices-card.test.tsx` 1a, 1f ; `member-space-invoices.test.ts` ; client ; e2e (clic, interception https)                                                 |
| 8   | « PDF non disponible », sans bouton                          | `my-invoices-card.test.tsx` 1a ; client (adresse non https → `hasPdf: false`) ; service (`unavailable`) ; e2e (880002)                                         |
| 9   | API indisponible : dernières données et leur date            | `member-space-invoices.test.ts` ; sync (relecture interrompue, erreur de base) ; carte 1d                                                                     |
| 10  | Aucun champ de moyen de paiement                             | `pennylane-client.test.ts`, bloc de forme ; e2e (aucune colonne `*url*`)                                                                                      |

## Constats

### Critical

Aucun.

### Major

Aucun.

### Minor

**m-a — La requête SQL insensible à la casse n'est pas testée.**
`src/db/repositories/member-profile-repository.ts:663-675`
(`listMemberProfilesByPennylaneIdIgnoringCaseDao`).

- Le service est testé avec ce DAO mocké, et l'e2e ne couvre pas la casse. Un retour à `eq(...)` laisserait
  toute la suite verte, avec le défaut m2 de retour.
- **Correctif** : un test de forme SQL (`lower("member_profile"."pennylane_customer_id") = lower($n)` +
  filtre `organization_id`), sur le patron déjà présent dans `member-profile-repository.test.ts`.

**m-b — L'incohérence de casse côté import reste entière (impact faible).**
`src/services/member-import-service.ts:245` passe par `getMemberProfileByPennylaneIdDao`, sensible à la
casse, comme l'index unique `member_profile_organization_pennylane_idx`.

- Scénario : le bureau saisit « ABC », puis un import apporte « abc ». L'import crée une seconde fiche, et le
  rapprochement en garde une sans rien dire.
- Probabilité faible : l'export donne des UUID stables, et la saisie manuelle est désormais gardée. La tâche
  14 ne visait que l'enregistrement de la fiche.
- **Correctif possible au prochain cycle** : faire passer l'import par le même DAO, ou poser un index unique
  sur `lower(pennylane_customer_id)` via `drizzle-kit generate`.

Observation hors périmètre arbitré, sans gravité : une erreur inattendue persistante interrompt encore la
chaîne horaire (`runPennylaneSyncJobService` relève avant `enqueueNextSync`). L'échec est désormais visible
au bureau, et « Mettre à jour maintenant » remet la tâche en place. La cause principale du round 1 (doublon
ON CONFLICT) est supprimée.

## Écarts déclarés

- **URL PDF factice en https via `page.route`, branche PDF du faux serveur supprimée** : accepté.
- **m3 non corrigé** : conforme à l'arbitrage et à l'ADR 062 §10.
- Règles rejouées sur ae6e2617, toutes respectées : couches, `getDb()` sous `withTenant`, aucun nouveau
  `withRlsBypass`, rien en dur relevant d'une association, aucun libellé hors `fr.json`, aucune migration,
  aucun `process.env` dans `src`.

Max severity: minor
Ship allowed: yes
