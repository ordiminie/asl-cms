# Credit System Refactor — Feature Request & Migration Doc

## Contexte
Le système actuel calcule les crédits via un `COUNT(*)` des ressources générées sur une période.
Objectif : migrer vers un **Credit Ledger** propre, aligné Stripe, extensible (override, bonus, packs),
sans casser les limites fixes existantes.

---

## Objectifs
- Découpler l’usage crédit de la logique métier
- Supporter :
  - crédits mensuels (plan + override)
  - override admin
  - crédits ajoutés manuellement
  - packs de crédits futurs
- Garder les **limites fixes** inchangées (users, storage, etc.)
- Éviter toute dette pricing

---

## Ce qui ne change pas
- Limites fixes = calcul direct  
  `effectiveLimit = planLimit + override`
- Pas de ledger pour les limites fixes
- Multi-tenant par `organization_id`
- Stripe reste la source de vérité pour les périodes

---

## Nouvelle abstraction
### CreditService (obligatoire)
Toute la logique crédit passe par ce service.

```ts
getBalance(orgId)
canConsume(orgId, amount)
consume(orgId, amount, reason)
allocateMonthlyCredits(subscription)
grantCredits(orgId, amount, options)
```

---

## Modèle de données
### Table `credit_ledger`
```sql
id UUID PK
organization_id UUID NOT NULL
amount NUMERIC NOT NULL          -- + ou -
source TEXT NOT NULL             -- plan | admin_override | usage | pack
source_id UUID NULL
period_start TIMESTAMP NULL
period_end TIMESTAMP NULL
expires_at TIMESTAMP NULL
created_at TIMESTAMP NOT NULL DEFAULT now()
```

Notes :
- Tous les crédits (plan, override, packs, bonus, usage) passent par cette table
- `expires_at = NULL` => pas d’expiration
- `period_start/end` utilisés pour les crédits mensuels

---

## Allocation mensuelle (Stripe)
À chaque nouveau cycle Stripe (`invoice.paid` ou équivalent) :

```text
+ plan.monthly_credits
+ org.override_monthly_credits
expires_at = current_period_end
```

---

## Consommation de crédits
À chaque action IA :

```text
-1
-0.5
-2
```

Règles :
- Toujours transaction DB
- Jamais de décrément direct ailleurs que dans `CreditService`

---

## Ajout manuel de crédits
### Cas possibles
- Bonus valable ce mois
- Geste commercial avec date de fin
- Crédit permanent

Exemples :
```text
+20 (expires_at = current_period_end)
+100 (expires_at = 2026-03-01)
+200 (expires_at = NULL)
```

---

## Calcul du solde
```sql
SELECT COALESCE(SUM(amount), 0)
FROM credit_ledger
WHERE organization_id = ?
AND (expires_at IS NULL OR expires_at > now())
AND (
  period_start IS NULL
  OR period_start = current_period_start
)
```

---

## Migration depuis l’ancien système
1. Geler la consommation (maintenance courte)
2. Calculer l’usage courant via l’ancien système
3. Injecter 2 lignes dans le ledger :
   - `+monthlyCredits`
   - `-usedCredits`
4. Basculer tous les checks vers `CreditService`

Aucune recréation de l’historique complet.

---

## Ce qui est volontairement hors scope (v1)
- Rollover
- Ordre de consommation avancé
- Packs complexes
- Reporting détaillé

Le schéma les permet sans refacto ultérieur.

---

## Règle d’or
- **Si ça bloque une création → limite fixe**
- **Si ça bloque une action → crédit**


---

## Credits Usage & UI View (User-facing)

Cette section décrit **ce que l’utilisateur voit**, et **comment ça se mappe au ledger**.
Objectif : transparence, compréhension, support minimal.

---

## Vue 1 — Credit Balance (Résumé)

### Affichage
- **Credits available** (ex: `2.5`)
- **Credits used sur la période**
- **Période courante**
  - `Dec 10, 2025 → Jan 10, 2026` (période Stripe)

### Source des données
- `available` = `getBalance(orgId)`
- `used` = `SUM(ABS(amount)) WHERE amount < 0 AND period = current`

Aucune logique métier côté UI.

---

## Vue 2 — Credits Usage (Graphique)

### Contenu
- Graphique journalier (bar chart)
- Axe X = dates
- Axe Y = crédits consommés

### Calcul
```sql
SELECT
  DATE(created_at) AS day,
  SUM(ABS(amount)) AS credits_used
FROM credit_ledger
WHERE organization_id = ?
AND amount < 0
AND created_at BETWEEN period_start AND period_end
GROUP BY day
ORDER BY day;
```

- Pas besoin de distinguer le type d’action en V1
- Évolutif plus tard (filtre par `reason`)

---

## Vue 3 — Recent Activity (Timeline)

### Affichage
Liste chronologique :
- action (ex: `Thumbnail generated`)
- variation de crédit (`-1`, `-0.1`, `+1`)
- date relative (`2 hours ago`)

### Mapping ledger
Chaque ligne = **1 entrée ledger**

```text
+1    Credits refunded
-1    Thumbnail generated
-0.1  Inspiration
```

### Règle
- Positif = crédit ajouté
- Négatif = crédit consommé

---

## Vue 4 — Buy Credits

### Produits
- Packs fixes (ex: 10 / 50 / 150 crédits)
- Prix affiché + coût par crédit

### Comportement
À l’achat :
```text
+X credits
source = pack
expires_at = NULL | date promo
```

Aucun impact sur la période Stripe.

---

## Vue 5 — Plans & Subscribe

### Affichage
- Plan actuel
- Crédits mensuels inclus
- Différence prix vs packs

### Donnée affichée
```text
monthlyCredits = plan + override
```

Ce nombre **n’est pas stocké** : il est calculé.

---

## Règle UX clé

> Tout ce que l’utilisateur voit correspond à **des lignes réelles du ledger**  
> ou à **une somme calculée simple**.

Pas de valeur magique.
Pas de crédit caché.

---

## Hors scope volontaire UI v1
- Breakdown par feature
- Export CSV
- Rollover visuel
- Prévision de burn rate

---

## Résumé

- UI = projection du ledger
- Usage = lignes négatives
- Balance = somme valide
- Période = Stripe
- Packs = hors période

Cette UI est **simple**, **compréhensible**, et **scalable sans refacto**.
