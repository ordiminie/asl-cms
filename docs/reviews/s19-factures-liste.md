# Revue anti-hallucination — s19-factures-liste (tour 3)

Branche `feature/s19-factures-liste`, relue dans un contexte neuf, sans rien modifier. Ce tour porte sur le commit `3613ee16`, relu comme du code neuf. Il corrige l'échec e2e de la PR 73 et touche deux fichiers : `e2e/association-settings.spec.ts` et `docs/plans/s19-factures-liste.md`. Le reste du diff `git diff main...feature/s19-factures-liste` n'a pas bougé depuis le tour 2. `docs/logs/`, non suivi, est hors périmètre.

**Verdict : aucun défaut nouveau, la livraison est permise.** Trois constats mineurs restent ouverts (m3, m5, m6).

## Tours précédents

| Tour | Verdict | Constats | Suite donnée |
| --- | --- | --- | --- |
| 1 | major, ship yes | M1 : isolation de `invoice_status_alert` non prouvée | Corrigé : une alerte par tenant dans le seed, plus deux tests d'accès croisé |
| 1 | | m1 : identifiant malformé → erreur serveur au lieu d'un 404 | Corrigé dans le DAL |
| 1 | | m2 : `'invoice_status'` absent de `REFERENCE_TYPES` | Corrigé |
| 1 | | m4 : commentaire de nettoyage e2e inexact | Corrigé |
| 1 | | m3 : `listInvoicesByMemberDao` n'est jamais appelé | Laissé exprès (réservé à s20) |
| 1 | | m5 : l'ADR 059 §5 et le code ne décrivent pas le même ordre | Laissé exprès (l'ADR est immuable) |
| 2 | minor, ship yes | m6 (nouveau) : `ON CONFLICT DO NOTHING` sur la contrainte unique des alertes | Ouvert, non bloquant |
| CI de la PR 73 | échec | Le critère 6 de s02 (`e2e/association-settings.spec.ts:249`) attendait que Marketing Pro ne stocke que `contact.email`. Le seed de démonstration de s19 y ajoute `billing.unpaid_statuses` et `billing.settled_statuses`. Résultat : 1 échec, 11 non lancés, 284 réussis. | Corrigé par `3613ee16`, relu ci-dessous |

## Vérifications exécutées

Au commit `3613ee16`, dans `/workspace` :

- **Typage** : `pnpm exec tsc --noEmit` → `tsc exit 0`, aucune erreur.
- **Lint** : `pnpm exec eslint e2e/association-settings.spec.ts` → `eslint exit 0`, aucun signalement.
- **Mise en forme** :
  - `pnpm exec prettier --check e2e/association-settings.spec.ts` : la spec est conforme.
  - Trois documents de la story ne passent pas `prettier --check` (`docs/plans/`, `docs/research/` et `docs/reviews/s19-factures-liste.md`). C'était déjà le cas avant ce commit (vérifié sur `e8e02bd0`). La CI ne vérifie pas la mise en forme (`ci.yml` lance `pnpm lint`, `check:rules` et `test --run`). Ce n'est donc pas un constat.
- **Tests unitaires** : non relancés, la correction ne touche que l'e2e et le plan. Le dernier résultat reste celui du tour 2 sur disque local : `Tests  5105 passed | 1 skipped (5106)`.
- **Build et e2e** : non lancés, comme demandé.

## Le commit `3613ee16` relu comme du code neuf

### L'attente correspond-elle à ce que le seed écrit chez Marketing Pro ?

Oui.

- **Ce que déclare le seed** (`src/db/scripts/tenant-member-invoices-seed.ts:134-155`). `TEST_INVOICE_DEMO_SETTINGS` déclare deux lignes pour `marketing-pro` :
  - `billing.unpaid_statuses` = `'En attente'` ;
  - `billing.settled_statuses` = `'Payée'`.

  Pour Marketing Pro, `TEST_TENANT_SETTINGS` (`tenant-settings-seed.ts:21-60`) ne déclare que `contact.email`. Aucune clé n'est commune aux deux jeux : rien n'est écrasé.
- **Comment le seed les écrit** (`src/db/scripts/seed.ts`) :
  - deux boucles distinctes, `:554` pour `TEST_TENANT_SETTINGS` puis `:677` pour `TEST_INVOICE_DEMO_SETTINGS` ;
  - même requête dans les deux : `INSERT … SELECT o.id, $2, $3 … ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value` ;
  - la valeur est écrite telle quelle, sans transformation. L'ordre des boucles n'a donc pas d'effet.
- **Ce que compare le test** :
  - `invoiceDemoSettingsOf('marketing-pro')` filtre le module par slug et construit `{key: value}`. C'est exactement la forme que renvoie `storedSettings` (`association-settings.spec.ts:138-149`) ;
  - le `toEqual` exact est conservé, le test reste donc aussi strict qu'avant ;
  - aucune valeur de statut n'est recopiée en dur ;
  - le tenant A reste en `toMatchObject` (`:261`), donc ses lignes de démonstration ne le cassent pas.
- **Ce que le test attrape encore** : une clé ajoutée en trop chez Marketing Pro, une clé de A visible depuis B, ou une valeur de seed modifiée qui diverge de la base.

### Importer le module de seed dans une spec Playwright est-il sans risque ?

Oui.

- Le module n'a qu'un import : `import type {TestTenantSetting} from './tenant-settings-seed'`. Un import de type disparaît à la compilation.
- Le reste du fichier ne contient que des constantes et des tableaux littéraux : aucun appel au niveau du module, aucun import de `@/env`, de `db.ts`, de `pg` ou de l'application.
- La spec n'embarque donc ni validation d'environnement ni connexion.
- C'est la première spec e2e qui importe depuis `src/db/scripts`. Le chemin est relatif (`../src/db/scripts/…`), pas l'alias `@/` : il ne dépend pas de la résolution des chemins par Playwright.

### Une autre spec affirme-t-elle le jeu exact des réglages d'un tenant ?

Non. Recherche dans `e2e/` : `organization_setting`, `storedSettings`, `invoice_status_alert`, les clés `billing.*_statuses`, `TEST_INVOICE_DEMO`, `rowCount).toBe(N)` et `toHaveLength`.

- **Lecture des réglages**. Les autres specs ne lisent qu'une seule clé : `home-page.spec.ts:399` et `:408`, `contact.spec.ts:181`, `incident-report.spec.ts:245`, `member-questions.spec.ts:228`, `magic-link.spec.ts:187`.
- **Écriture des réglages**. Les specs qui écrivent posent ou suppriment leurs propres clés, puis nettoient :
  - `campaigns.spec.ts:942` et `:954`, `email-budget.spec.ts:305`, `magic-link.spec.ts:164` : tenant A ;
  - `site-alert.spec.ts:86` : Marketing Pro, mais seulement ses clés d'alerte de site, supprimées en fin de groupe. Ce comportement existait avant s19.
- **Statuts de facture**. Aucune spec ne modifie `billing.unpaid_statuses` ni `billing.settled_statuses`. `member-invoices.spec.ts` ne passe pas par l'écran des réglages.
- **Comptages de lignes**. Aucun ne porte sur `organization_setting` ou `invoice_status_alert` : les seuls `rowCount` sur `organization_setting` valent 0 (hors scope, `association-settings.spec.ts:479`, et lecture croisée) ; les preuves sur `invoice_status_alert` (`tenant-isolation.spec.ts:359` et suivantes) ont été relues au tour 2.
- **Ordre d'exécution**. La CI tourne avec `workers: 1` (`playwright.config.ts:37`).

### Les 11 tests « non lancés » sont-ils dans le groupe en série ?

Oui. `test.describe.serial` (`:230`) contient 12 tests et le critère 6 est le premier (`:248`). Son échec a sauté les 11 autres, ce qui correspond au rapport de la CI.

### Le plan

La section « Correctif CI (PR 73, 17/11) » est ajoutée et sa tâche **CI-1** est cochée (`docs/plans/s19-factures-liste.md:174-181`). Le diff fait exactement ce qu'elle demande, rien de plus.

## Constats

### Critique

Aucun.

### Majeur

Aucun.

### Mineur

- **m3 (reporté du tour 1, laissé exprès)** : `listInvoicesByMemberDao`, dans `src/db/repositories/member-invoice-repository.ts:55-57`, n'est appelé par aucun code de production.
  - Risque : aucun à l'exécution. C'est du code mort, testé pour lui-même.
  - À faire : l'utiliser en s20 ou le retirer ; écart au plan signalé dans la PR.
- **m5 (reporté du tour 1, laissé exprès)** : l'ADR 059 §5 et `src/services/member-invoice-service.ts:356-376` ne décrivent pas le même ordre.
  - L'ADR décrit « envoi, puis pose de la ligne ». Le code pose la ligne avant l'envoi et la retire si l'envoi échoue. L'effet visible est le même.
  - À faire : une note dans la PR, ou un ADR qui remplace celui-ci si la formulation doit être exacte.
- **m6 (reporté du tour 2)** : dans `src/db/scripts/seed.ts:726-737`, le `ON CONFLICT DO NOTHING` des alertes joue aussi sur la contrainte unique `(organization_id, status)`.
  - Scénario d'échec : une base locale non réinitialisée porte déjà une alerte « Litige » créée à la main, avec un autre identifiant. Le seed saute alors sa ligne, et le `toContain(ALERT_A)` de `e2e/tenant-isolation.spec.ts` échoue.
  - Ce cas ne se présente ni en CI (base éphémère) ni après `pnpm db:reset-seed`.
  - Correction possible : `ON CONFLICT (organization_id, status) DO UPDATE SET id = EXCLUDED.id`, ou accepter le risque. Non bloquant.

## Critères d'acceptation

Les dix critères de `docs/stories.md` restent couverts, comme aux tours 1 et 2. Le critère 6 de s02, cassé par le seed de s19, a de nouveau une attente juste et exacte. La correction ne relâche aucune assertion.

Max severity: minor
Ship allowed: yes
