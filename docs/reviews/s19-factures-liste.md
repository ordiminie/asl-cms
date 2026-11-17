# Revue anti-hallucination — s19-factures-liste (tour 2)

Branche `feature/s19-factures-liste` (commits `9ad71909` recherche, `954f8e27` feat, `a6b575ab` correctif), relue dans un contexte neuf, sans rien modifier. Le diff `git diff main...feature/s19-factures-liste` compte 89 fichiers, +21 506 / −35. `docs/logs/` (non suivi) est hors périmètre. Le commit de correctif `a6b575ab` est relu comme du code neuf, pas seulement comme la clôture des constats.

## Tour précédent

Le tour 1 (17/11) a conclu `Max severity: major`, `Ship allowed: yes`. Arbitrage de l'utilisatrice : corriger avant la PR.

| Constat | Objet | Suite donnée |
| --- | --- | --- |
| M1 (majeur) | Isolation de `invoice_status_alert` non prouvée : la table était vide pendant l'e2e | **Corrigé** : une alerte par tenant dans le seed, plus deux nouveaux tests d'accès croisé |
| m1 | Identifiant de facture malformé → erreur serveur au lieu d'un 404 | **Corrigé** dans le DAL |
| m2 | `'invoice_status'` absent de `REFERENCE_TYPES`, d'où un affichage « autre envoi » | **Corrigé** : type, branche d'affichage, libellés |
| m3 | `listInvoicesByMemberDao` jamais appelé | **Laissé exprès** (réservé à s20) |
| m4 | Commentaire de nettoyage e2e inexact | **Corrigé** |
| m5 | L'ADR 059 §5 dit « envoi puis pose de la ligne », le code fait l'inverse | **Laissé exprès** : l'ADR est immuable et l'effet est identique |

## Vérifications exécutées

Tout a tourné sur une copie du dépôt sur disque local, au commit `a6b575ab`. Aucun timeout de worker, aucun échec.

- `pnpm test --run` :
  - ` Test Files  397 passed (397)`
  - `      Tests  5105 passed | 1 skipped (5106)`
  - Le tour 1 comptait 5099 tests ; les 6 de plus sont ceux du correctif.
- `pnpm exec tsc --noEmit` : sortie 0, aucune erreur.
- `pnpm lint` : `✖ 2 problems (0 errors, 2 warnings)`, sortie 0. Les deux avertissements portent sur `.remember/tmp/last-ndc.ts` et `.scratch/check-migration.mjs`, des fichiers non suivis hors story. Aucun fichier de la story n'est signalé.
- Ni build ni e2e lancés, conformément à la consigne (CI seulement).

## Le commit de correctif relu comme du code neuf

### M1 : seed des alertes et preuves e2e

**Le seed** (`src/db/scripts/tenant-member-invoices-seed.ts:156-183`, `src/db/scripts/seed.ts:726-737`)

- Il pose deux lignes, une pour TechCorp et une pour Marketing Pro, avec le statut `'Litige'` et des identifiants fixes.
- Les deux UUID sont de version 4 et diffèrent de ceux des factures.
- L'insertion se fait avec `INSERT … SELECT … FROM organization WHERE slug = $1 ON CONFLICT DO NOTHING`, à l'intérieur du bloc `SET app.bypass_rls = 'on'` existant, avant le retour à `'off'`.
- Aucune nouvelle occurrence de `withRlsBypass`.
- Les colonnes omises ont un défaut en base (`uuid_generate_v4()`, `defaultNow()`).

**Le comportement « un signalement par statut » n'est pas faussé**

- Aucune facture du seed ne porte `'Litige'`. Un test le vérifie (`tenant-member-invoices-seed.test.ts:178-192`), ainsi que le fait que ce statut reste « à classer » dans la configuration de démonstration.
- La facture non classée du seed (`UNCLASSIFIED`) porte un autre statut : le signalement des autres statuts reste démontrable.
- Aucun scénario e2e ne saisit `'Litige'` : `e2e/member-invoices.spec.ts` saisit un statut classé ou recopie `mi.status`.
- Aucun code de production ne lit les alertes pour les afficher ou les compter. Le compte de l'email porte sur `member_invoice`, et le dépôt ne fait sur `invoice_status_alert` que `insert` ou `delete` (`member-invoice-repository.ts:120-151`).
- Le seul effet de bord : en démo, saisir « Litige » ne déclenche pas d'email. C'est voulu et documenté.

**Les preuves e2e** (`e2e/tenant-isolation.spec.ts:444-491`)

Les trois assertions échoueraient sans RLS :

- **Hors scope** (test existant, `:381-390`) : la table n'est plus vide, donc l'assertion « 0 ligne » a maintenant un sens.
- **Lecture croisée** : `fromA` doit contenir `ALERT_A` et pas `ALERT_B`, chaque ligne doit porter `organization_id = a`, et la lecture forgée de `ALERT_B` depuis A doit rendre 0 ligne. Sans policy, `ALERT_B` apparaîtrait et le test échouerait.
- **Écriture croisée** : une insertion `organization_id = b` sous le scope A doit lever `/row-level security/`. Sans policy, l'insertion passerait.
- Ces tests passent par le rôle applicatif (`withAppRoleClient`), pas par le rôle propriétaire qui est superuser.
- Les droits d'insertion de ce rôle viennent de `ALTER DEFAULT PRIVILEGES` dans `.github/workflows/ci.yml:134-136`, comme pour le test équivalent sur `member_invoice`. Un droit manquant ferait échouer le test, il ne le ferait pas passer à tort.
- La policy de `0064_member_invoice_rls.sql` est `FOR ALL` sans `WITH CHECK`, donc son `USING` s'applique aux insertions. Le refus attendu est le bon.

### m1 : identifiant malformé dans le DAL

`src/app/dal/member-invoice-dal.ts:53-64` reprend à l'identique le patron de `getMemberProfileForBureauDal` (`member-profile-dal.ts:59-70`).

- Seule `ValidationParsedZodError` devient `undefined` ; toute autre erreur remonte.
- Le service lève bien cette classe avant tout contrôle d'autorisation (`member-invoice-service.ts:295-302`).
- La façade est l'intercepteur, qui renvoie l'erreur d'origine : `instanceof` fonctionne.
- Les tests couvrent les deux sens : `ValidationParsedZodError` → `undefined`, et `AuthorizationError` remonte (`member-invoice-dal.test.ts:76-94`).

Le plan demandait un test de page ; l'implémenteur l'a mis sur le DAL. C'est le bon niveau :

- le test de page simule le DAL, donc il ne pourrait pas exercer le `catch` ;
- le passage `undefined` → `notFound()` est déjà pinné côté page (`[invoiceId]/page.test.tsx:181`).

La chaîne est donc couverte de bout en bout. Une conséquence acceptée, déjà présente dans le patron des fiches : un compte sans droit qui tape un identifiant malformé reçoit un 404 plutôt qu'un 403.

### m2 : signalement reporté dans la vue des envois

- `'invoice_status'` est ajouté à `REFERENCE_TYPES` (`email-budget-rules.ts:55`). C'est un membre réel de `EmailSendReferenceType` (`email-send-types.ts:45`).
- Une branche est ajoutée dans `usePendingTexts` (`email-sending-overview.tsx:248-257`) :
  - titre `titles.invoice_status` = « Statut de facture à classer » ;
  - lien `/bureau/reglages` ;
  - action `actions.invoice_status` = « Voir les réglages » ;
  - clés présentes dans `messages/fr.json:4373` et `:4387`.
- Le lien est cohérent avec celui de l'email (`member-invoice-service.ts:351`), et la route existe (`src/app/[locale]/(bureau)/bureau/reglages/page.tsx`).
- La branche est placée avant le test sur `nature`, ce qui ne masque aucun autre cas.
- Deux tests la couvrent :
  - `email-budget-rules.test.ts:289` : la référence est conservée dans le groupe ;
  - `email-sending-overview.test.tsx:316` : titre et lien.

### m4 : commentaire de nettoyage

Le commentaire `e2e/member-invoices.spec.ts:147-151` dit maintenant ce que fait `cleanUpRun` : il ne retire que les factures. Les alertes du seed n'ont pas à être retirées. C'est exact.

## Le reste du diff, relu rapidement

- Rien de neuf par rapport au tour 1. Revus : l'ajout de `memberInvoice` au schéma Drizzle (`db.ts`), `sendInvoiceStatusAlertEmailService` (budget du tenant, `board_notification`, référence `invoice_status`) et la libération par identifiant au rejeu (`MARK_SOURCE_NOTIFICATION_FAILED`, avec un `satisfies Record` exhaustif).
- Les couches sont respectées : DAL → façade → service → dépôt.
- Aucun `'use cache'` sur une donnée personnelle.
- Aucune valeur métier en dur (ADR 010) : statuts, modèle d'objet et destinataire de l'alerte sont des réglages.

## Constats

### Critique

Aucun.

### Majeur

Aucun. M1 est corrigé, avec une preuve qui échouerait sans RLS.

### Mineur

- **m3 (reporté du tour 1, laissé exprès)** — `src/db/repositories/member-invoice-repository.ts:55-57`, `listInvoicesByMemberDao` n'est appelé par aucun code de production.
  - Risque : nul à l'exécution ; c'est du code mort, testé pour lui-même.
  - Correction attendue : l'utiliser en s20 ou le retirer, et noter l'écart au plan dans la PR.
- **m5 (reporté du tour 1, laissé exprès)** — ADR 059 §5 et `member-invoice-service.ts:356-376`.
  - L'ADR décrit « envoi puis pose de la ligne » ; le code réclame la ligne avant l'envoi et la libère en cas d'échec. L'effet observable est le même.
  - Correction attendue : aucune dans le code. Une note dans la PR suffit, ou un ADR qui remplace celui-ci si la formulation doit être tenue exacte.
- **m6 (nouveau, observation)** — `src/db/scripts/seed.ts:726-737`, le `ON CONFLICT DO NOTHING` joue aussi sur la contrainte unique `(organization_id, status)`.
  - Scénario : une base locale non réinitialisée qui porte déjà une alerte « Litige » créée à la main, avec un autre identifiant. Le seed passerait alors cette ligne, et l'e2e `toContain(ALERT_A)` échouerait.
  - En CI (base éphémère) et après `pnpm db:reset-seed`, ce cas ne se présente pas.
  - Correction possible : `ON CONFLICT (organization_id, status) DO UPDATE SET id = EXCLUDED.id`, ou simplement l'accepter. Non bloquant.

## Critères d'acceptation

Les dix critères de `docs/stories.md`, relevés au tour 1, restent couverts (`member-space-invoices.test.ts`, `member-invoice-service.test.ts`, `member-invoice-rules.test.ts`, `member-invoice-status-alert.test.ts`, e2e `member-invoices.spec.ts`).

Les deux réserves du tour 1 sont levées :

- **Critère 6 (statut inconnu)** : la vue des envois en attente nomme désormais le signalement reporté (m2).
- **Critère 7 (aucune facture d'autrui)** : l'isolation de `invoice_status_alert` est prouvée en lecture croisée, en écriture croisée et hors scope (M1).

Max severity: minor
Ship allowed: yes
