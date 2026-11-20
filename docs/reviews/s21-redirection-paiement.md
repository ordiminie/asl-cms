# Review — Story s21-redirection-paiement

> Round 1, 20/11/2026. Subagent `reviewer` en contexte neuf, diff `git diff main...feature/s21-redirection-paiement`
> (commit `66bcc5e1`). Tests lancés dans un worktree temporaire de la branche, sur disque local.

## Synthèse

Aucun constat critique ni majeur ; trois mineurs. Chacun des six critères est couvert par un test qui
échouerait si le comportement disparaissait.

| Vérification                          | Résultat                                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| `pnpm test --run`                     | 416 fichiers, **5548 réussis**, 1 ignoré, 0 échec, aucun timeout |
| `tsc --noEmit`                        | exit 0                                                           |
| `eslint` sur les `.ts`/`.tsx` du diff | exit 0                                                           |
| e2e                                   | non lancés en local (machine trop juste) ; à confirmer en CI     |

## Anti-hallucination — les références existent

- `isHttpsUrl` (`src/lib/pennylane/pennylane-schemas.ts:26`) : URL absolue en `https:` seulement ; refuse
  `http:`, `javascript:` et la chaîne vide.
- `landLabelOf`, clés `pdf.land` / `landMissing` existaient déjà dans `my-invoices-card.tsx`.
- `ExternalLink` (lucide-react), `Button asChild`, `Alert` / `AlertDescription` : `{...props}` vient après
  `role="alert"`, donc `role="note"` le remplace bien.
- `is`, `getTableConfig`, `PgTable` (drizzle-orm) ; `import.meta.glob` (Vite).
- La route `/contact` existe (`src/app/[locale]/(public)/contact/page.tsx`) ; les 7 clés de traduction
  utilisées sont dans `messages/fr.json`.
- `MyInvoiceDTO.payment` traverse la façade et le DAL (`getMyInvoicesDal`) sans être retransformé.

## Conformité au plan

Les 7 tâches sont faites, sans dérive :

1. **Contrat** : `paymentUrl` est ajouté ; `BoardInvoiceDTO` s'appuie sur `Omit<…,'paymentUrl'>` et
   `toBoardInvoice` recopie champ par champ, sans spread.
2. **Fournisseurs** : `paymentUrl: null` est explicite dans chacun ; `pennylane-schemas.ts` n'est pas
   modifié ; aucune colonne, aucune migration.
3. **Service** : `paymentOf` (`member-space-service.ts:304-316`) s'appuie sur `classifyInvoiceStatus` et
   `isHttpsUrl`.
4. **Écran** : conforme au design.
5. **Garde de schéma** : faite.
6. **Design system** : §3.16 ajouté, `ExternalLink` ajouté au §1.7.
7. **e2e** : faits, sur le seed.

Deux fichiers de test hors plan (`member-space.test.tsx`, `campaign-service.test.ts`) ne font qu'ajouter
`payment: null` / `paymentUrl: null`, ce que le changement de type impose.

## Couverture critère par critère

1. **Bouton avec lien** : le service rend le lien du fournisseur simulé à l'identique ; le composant rend un
   `<a>` avec le `href` exact, `target="_blank"`, `rel="noopener noreferrer"`, le nom accessible et la bonne
   colonne, en bureau comme en mobile. ✅
2. **Lien du fournisseur** : le manuel rend `[null, null]`, Pennylane rend `null`, le lien affiché est
   celui du fournisseur simulé. ✅ (voir m3)
3. **Virement** :
   - le service rend `transfer` ;
   - le composant affiche « Par virement » sans lien, une seule `note` qui renvoie vers `/contact`, et
     aucune phrase quand toutes les impayées ont un lien ;
   - l'e2e le vérifie sur le seed. ✅
4. **Aucun formulaire ni champ de moyen de paiement** :
   - dans la carte : aucun `form`, `input`, `select` ni `textarea`, aucun vocabulaire bancaire ;
   - dans le schéma : la garde parcourt toutes les tables et vérifie qu'elle n'est pas vide. ✅
5. **Facture non impayée** :
   - le service rend `null` pour une facture payée et pour un statut non classé, même avec un lien ;
   - la cellule est vide, et la colonne disparaît quand aucune facture n'est impayée ;
   - l'e2e le vérifie sur la facture réglée. ✅
6. **Lien non https** : `http:`, `javascript:` et `''` donnent `transfer` ; retirer la garde fait échouer les
   trois cas. ✅

Les autres points tiennent aussi :

- aucune URL Pennylane construite, aucun champ ajouté au schéma Zod ;
- le lien n'est ni une constante ni un réglage ;
- le bureau ne reçoit pas le lien, et un test le prouve ;
- couches respectées, aucun `withRlsBypass`, aucune valeur en dur ;
- l'ADR 063 est nouveau et ne modifie pas l'ADR 059.

## Écarts déclarés par l'implémenteur

- **`role="note"`** : accepté. La phrase est un texte statique ; `role="alert"` le ferait annoncer comme
  une urgence.
- **Garde de schéma mot par mot** : acceptée. Une recherche par sous-chaîne refuserait `company` (contient
  « pan ») et `public` (contient « bic »).
- **Deux fichiers de test hors plan** : acceptés, voir plus haut.

## Constats

### Critical

Aucun.

### Major

Aucun.

### Minor

- **m1** — `my-invoices-card.tsx:451-463`.
  - Défaut : sous 640 px, le texte visible est « Payer cette facture », alors que le nom accessible est
    « Payer la facture 2026, … ».
  - Conséquence : la commande vocale « Payer cette facture » échoue (WCAG 2.5.3).
  - Origine : le design prescrit ce nom ; le bouton PDF de s20 a le même défaut.
  - Correction possible : un libellé mobile contenu dans le nom (« Payer la facture »).
- **m2** — `src/db/no-payment-method-schema.test.ts:464-469`.
  - Défaut : la garde ne découpe les noms de colonne que sur `_`.
  - Conséquence : `ibanNumber`, `creditcard` ou `bankaccount` passeraient. Risque faible : les colonnes
    du dépôt sont en snake_case.
- **m3** — `src/services/__tests__/member-space-invoices.test.ts:618-665`.
  - Défaut : aucun test avec deux factures impayées ayant deux liens différents.
  - L'implémentation est correcte : le lien est calculé par facture dans `toMyInvoice`. Seule la preuve
    manque.

Max severity: minor
Ship allowed: yes
