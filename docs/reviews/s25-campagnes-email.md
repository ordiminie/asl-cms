# Review s25-campagnes-email

Diff judged: `git diff main...feature/s25-campagnes-email` (99 files, +22479).

## 1. Tests

`pnpm test --run`, lancé par le reviewer : 332 fichiers passés, 4063 tests passés, 1 ignoré, aucun timeout de worker. Le e2e `e2e/campaigns.spec.ts` n'a pas été exécuté (CI uniquement).

## 2. Existence checks

Repositories, services, DAL, route et actions ouverts : chaque import et chaque appel vérifié existe, et la suite de tests concorde.

- `withTenant`, `getDb` (via les repositories), `after` de `next/server`, `parseEmailAddress` dans `email-transport`, `RESTRICTED_SANITIZE_SCHEMA` (désormais exporté) et `effectiveAuthor` existent.
- Aucune API inventée.
- Les ajouts `headers` et `replyTo` au transport Brevo sont optionnels et gardés.

## 3. Plan vs diff

- Les 11 tâches du plan sont cochées et présentes dans le diff : modèles et migrations 0043/0044, types et règles, transport, réglages et gabarit email, repositories, services/façades/intercepteurs, DAL/actions/route, écrans 0, 1 et 4, composeur et aperçu, page publique et mention sur la fiche, e2e. `docs/architecture.md` est à jour (41 tables, 22 sous RLS forcée).
- Aucun code hors plan. Le seul changement hors périmètre apparent, l'export de `RESTRICTED_SANITIZE_SCHEMA` dans `render-page-block.ts`, sert le rendu du corps des campagnes.
- Plafond et étalement quotidiens explicitement hors périmètre (s26, ADR 051) : voir le constat mineur 1.

## 4. Tests comme épingles d'acceptation

- Route : `GET` redirige en 303 sans appeler le service ; `POST` écrit.
- Actions : `after` appelé une fois après succès, jamais sur un refus.
- Service : autorisation explicite, arrêt au premier échec.
- Un test de source interdit `'use cache'` dans le DAL des campagnes.
- Isolation entre tenants prouvée par le e2e Playwright (lecture croisée, insertion refusée par la RLS, jeton du tenant A sur le domaine du tenant B = « lien invalide »), conformément à la règle « la RLS n'est pas testable en unitaire ». Non exécuté en revue : non vérifié ici.

## 5. Règles et ADR

- **Multi-tenant** : les 3 tables portent `organization_id` ; la migration 0044 active et force la RLS avec une policy `tenant_isolation` par table, sans jointure (patron 0042). Repositories sur `getDb()`, tout chemin de service dans `withTenant`. Aucun `withRlsBypass` ajouté. Le jeton de désinscription est résolu sous le tenant du domaine appelé, `organizationId` revérifié contre la ligne.
- **Rien en dur (ADR 010)** : plafond d'objet calculé (60 moins le préfixe) ; mentions légales, contact et teinte viennent de `organization_setting` ; les constantes restantes sont techniques.
- **Jeton et route publique** : 32 octets aléatoires en base64url, validés par un schéma avant recherche ; `GET` n'écrit jamais (303 vers la confirmation) ; `POST` suit la RFC 8058 et est idempotent ; réponses sans corps ni détail, en-têtes `no-store` et `no-referrer` ; `List-Unsubscribe` et `List-Unsubscribe-Post` présents.
- **Livraison** : `after()` posé côté action, seulement après une création ; le rejeu d'un même `submission_id` rend `deliver: null`, donc aucun double envoi ; les lignes destinataires existent avant le premier email ; arrêt au premier échec (`interrupted`).
- **Journaux** : seuls `error.name` et l'id de campagne ; détails désactivés dans les intercepteurs ; aucune adresse ni contenu.
- **i18n** : textes dans `messages/fr.json` (`CampaignsBureau`, `UnsubscribePage`), pas de français en dur dans les actions.
- **Couches** : aucune présentation n'importe `@/db/*` ; façade → service → DAO ; aucun service n'importe sa façade.
- **Cache** : aucun `'use cache'`, DAL en `cache()` React seul.
- **Migrations** : générées, une custom pour la RLS, journal cohérent.
- **ADR 051** : respecté (lignes par destinataire, pas de reprise en V1, arrêt au premier échec, désinscription portée par le membre et non par l'adresse).
- **Design system** : aucun littéral hexadécimal dans les composants de campagne ; composants existants uniquement (alert, progress, badge, radio-group, alert-dialog, pagination, skeleton) ; aucun token ni composant inventé.

## 6. Findings

Critical : aucun.
Major : aucun.

Minor :

1. Le budget quotidien d'emails par association (300/jour par compte Brevo, compté en base) n'est pas appliqué : ni compteur, ni report au lendemain. Conforme au plan et à l'ADR 051, qui renvoient plafond et étalement à s26, mais un envoi au-delà du plafond finit `interrupted`. La règle projet rend ce budget structurant : s26 ne doit pas glisser.
2. `deliverCampaignService` n'a pas de chemin de reprise en V1 : un processus tué pendant `after()` laisse la campagne en `sending`. Atténué par `effectiveCampaignStatus`, qui l'affiche comme interrompue, et par le plan. À garder sur la liste de s26.
3. La preuve d'isolation multi-tenant et le parcours de désinscription reposent sur `e2e/campaigns.spec.ts`, non exécuté en revue. Le résultat de la CI doit être vert avant le merge.

Max severity: minor
Ship allowed: yes
