# Revue — Story s32-documents-nominatifs (tour 3)

> Le tour 3 (correctif CI 85f7cbba) est en fin de rapport ; les tours 1 et 2 restent ci-dessous.

## Tour 2

> Regard neuf (subagent reviewer). Diff relu : `git diff main...feature/s32-documents-nominatifs`, deux commits
> (8df83d1d, puis le correctif 945bdbb4 relu comme du code neuf : 11 fichiers, +478/−96).
> Suite lancée par le reviewer dans `/workspace` (`pnpm test --run --maxWorkers=4`) : 478 fichiers,
> 6577 passés, 1 ignoré, 0 échec. `prettier --check`, `eslint`, `tsc --noEmit` propres. e2e non exécutés :
> la CI est leur premier passage.

## Tour 1 — ce qui avait été trouvé

Aucun critique ; trois majeurs, tous sur les preuves e2e ; dix mineurs. Arbitrage du 25/11/2026 : corriger
les majeurs et les mineurs 4 et 5 avant de livrer (tâche 12 du plan), les mineurs 6 à 10 restant pour le tour
final.

## Ce qui a été corrigé (945bdbb4)

- **Majeur 1 — RLS de `member_document` sans preuve réelle : fermé.** Bloc dans
  `e2e/tenant-isolation.spec.ts` sur le patron de `shared_document` : hors scope 0 ligne, scope A → A seul,
  écriture pour B depuis A refusée (`row-level security`). Chaque assertion échouerait sans la policy ;
  préparation en une transaction, nettoyage documents puis catégories (RESTRICT respecté), catégories de nom
  unique sans collision avec les sélecteurs des autres specs.
- **Majeur 2 — lot sans lien fichier ↔ fiche : fermé.** Fichiers d'octets et de tailles différents (affirmé),
  assertion par fichier : ligne du rapport « Déposé » vers `/bureau/proprietaires/<fiche>`, une ligne en base
  sur la fiche attendue, clé dans son dossier, octets servis identiques. Un croisement ferait échouer le test.
- **Majeur 3 — critères 3 et 5 sur lignes sans fichier : fermé.** `depositThroughBoard` passe par le vrai
  dépôt du bureau (champ date masqué `01/06/2019`, relu `2019-06-01`) ; le vendeur télécharge des octets
  identiques, l'acquéreur reçoit 404 sur le même identifiant ; Lefèvre télécharge ses deux documents.
  `insertDocument` ne sert plus qu'au critère 6.
- **Mineur 4 — 401 avant validation de l'identifiant : fermé.** Sans session, 401 quel que soit l'id ; avec
  session, statuts inchangés. Test de route sur la vraie façade, qui échouerait si l'ordre s'inversait.
- **Mineur 5 — référence ambiguë : fermé.** `getMemberProfileIdsByPennylaneReferenceDao` (liste, `limit 2`) ;
  aucune → `unknown_reference`, deux → `ambiguous_reference`, sans lecture de fiche, envoi ni écriture.
  Libellé dans `messages/fr.json`.

## Checklist

- [x] Conformité au plan : la tâche 12 correspond au commit, point par point, rien de plus.
- [x] Anti-hallucination : helpers, sélecteurs, libellés, routes, colonnes, identifiants de seed vérifiés.
- [x] Les nouveaux tests échoueraient si la protection disparaissait.
- [x] AGENTS.md, ADR 002, 047, 073 : `getDb()`, aucun `withRlsBypass` applicatif nouveau, libellés hors code.
- [x] Pas de régression (route, lecture, lot, `backup-restore`).
- [x] Design system : aucun composant ni jeton ajouté par le correctif.

## Constats

### Critiques

Aucun.

### Majeurs

Aucun.

### Mineurs nouveaux

- **N1.** `docs/plans/s32-documents-nominatifs.md` (tâche 4) cite encore
  `getMemberProfileIdByPennylaneReferenceDao`, renommé au pluriel.
- **N2.** ADR 073 §8 (« l'unicité rend le cas plusieurs fiches impossible ») est inexact : l'index unique est
  sensible à la casse, le rapprochement non. Le code traite le cas (`ambiguous_reference`) ; l'ADR étant
  immuable, la précision est consignée ici — un ADR qui le remplace si elle doit faire autorité.

### Mineurs du tour 1 toujours ouverts (tour final)

6. `my-member-documents-card.tsx` : `PAGE_SIZE = 25` partout ; design et « Mes factures » : 10 sous 640 px.
7. `documents-nominatifs/page.tsx` : `?categorie=` non uuid ou `?q=` > 100 caractères → frontière d'erreur au
   lieu d'ignorer le filtre (bureau seul).
8. `getMemberDocumentBatchReachService` compte toutes les fiches sans statut.
9. `isMemberDocumentKeyOf` ne compare pas le premier uuid du nom à l'`id` de la ligne.
10. `member-document-model.ts` : pas de FK composite `(organization_id, member_profile_id)`.

Observation : aucun e2e n'appelle la route sans session ; le test unitaire de route sur la vraie façade couvre
le 401.


## Tour 3 — correctif CI (85f7cbba, tâche 13 du plan)

La CI de la PR 86 a échoué : 354 e2e passés, 1 en échec, 2 non lancés (mode série). Le critère 6 échouait sur
`insertDocument` (`inconsistent types deduced for parameter $1` : `$1` servait de `uuid` et de texte).

- **Typage corrigé** : `$1::uuid` pour `id`, `$1::uuid::text` dans la concaténation, `$3::text`, `$4::uuid`,
  `$5::date`, `$6::text` ; types vérifiés contre `member-document-model.ts`. Validé par l'implementer contre
  Postgres (ancienne requête : erreur identique à la CI ; nouvelle : une ligne insérée, clé acceptée par
  `isMemberDocumentKeyOf`, en transactions annulées).
- **Clé conforme** à `buildMemberDocumentFileKey` (`{org}/member-documents/{fiche}/{id}-{uuid}.pdf`, uuid
  canoniques en minuscules).
- **Périmètre** : la requête et la tâche 13 du plan, rien d'autre.
- **Audit** des autres requêtes brutes de `e2e/member-documents.spec.ts` et du bloc `member_document` de
  `e2e/tenant-isolation.spec.ts` : aucun autre paramètre à double type.
- **Tests jamais lancés en CI** (fin du critère 6, « critère 7 — lot », « retrait ») relus contre le code et
  `messages/fr.json` : sélecteurs, libellés ICU, ordre du rapport, redirection `?documents=retire`, nettoyage —
  rien qui n'échouerait qu'à l'exécution.
- `tsc --noEmit` et `eslint` propres. Suite unitaire non relancée : aucun changement hors e2e et docs.

Constats du tour 3 : aucun critique, aucun majeur, aucun mineur nouveau. Restent ouverts pour le tour final :
N1, N2 et les mineurs 6 à 10 du tour 1, inchangés.

Max severity: minor
Ship allowed: yes
