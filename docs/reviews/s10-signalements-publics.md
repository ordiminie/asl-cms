# Revue — Story s10-signalements-publics

> Revue à contexte neuf. Chaque problème est classé : critical, major ou minor.
> Diff revu : `git diff main...feature/s10-signalements-publics`, un seul commit (`2679aa0`), 80 fichiers. Les fichiers non commités de l'arbre de travail (s11, s12, ADR 029, `docs/stories.md`) sont hors périmètre et n'ont pas été jugés.

## Vérifications exécutées par le relecteur

Toutes les commandes ont tourné sur une copie de la branche en disque local (`git archive`), pour éviter le montage 9p.

| Commande | Résultat |
| --- | --- |
| `pnpm test --run` | **166 fichiers passés, 2 ignorés ; 1940 tests passés, 8 ignorés**, exit 0, aucun timeout |
| `tsc --noEmit` | exit 0 (pas de `.next/` dans la copie, donc aucune erreur masquée) |
| `pnpm lint` | exit 0 |
| `pnpm check:rules` | « Règles et documentation alignées sur le code » |
| `pnpm db:generate` | « No schema changes, nothing to migrate » : journal et instantanés 0026/0027 cohérents |
| `pnpm db:migrate` + `pnpm db:check` sur `asl_cms_test_s10` | migrations appliquées ; « Rôle applicatif soumis à la RLS » |
| `pnpm build` (build de prod) | exit 0 |
| e2e Playwright, chromium, sur `pnpm start` : `incident-report`, `contact`, `rate-limit`, `association-settings`, `tenant-isolation` | **44 passés sur 44** (1,9 min) |

Deux précisions sur ces vérifications :
- **Seed** : `pnpm db:seed` n'a pas pu être rejoué, parce que le seed n'est pas idempotent sur les posts du boilerplate (`posts_translation_slug_unique`). Les catégories seedées de s10 étaient déjà présentes et conformes en base : 4 pour TechCorp dont « Fuite d'eau » → `forage@techcorp-solutions.test`, et 1 pour Marketing Pro.
- **Build** : il journalise `MISSING_MESSAGE: ReportPage.metadata (en|es)` au prerender. C'est le même bruit préexistant que `BureauBoardPage (en|es)` : le build n'échoue pas, ce n'est pas propre à s10.

## Conformité au plan

- [x] **Le code fait ce que le plan demande, rien de plus.** Les tâches 1 à 9 sont toutes présentes :
  - modèle, migrations 0026 (générée) et 0027 (`--custom`, ENABLE + FORCE + `tenant_isolation` sur les trois tables) ;
  - `REPORT_MANAGE` pour `owner` et `board` ;
  - repository de catégories sous `pg_advisory_xact_lock`, avec suppression logique ;
  - création du signalement et de son événement dans une même transaction ;
  - `UPDATE … WHERE status = from` suivi de l'événement dans la même transaction, et un résultat `stale` quand la course est perdue ;
  - destinataires dédupliqués sans tenir compte de la casse, un envoi par destinataire, `recipientType: 'system'` ;
  - `readVisitorIp` extraite dans `src/lib/helper/visitor-ip.ts` et réemployée par `/contact` ;
  - quota `contact.ip` partagé entre les deux formulaires ;
  - `'signaler'` ajouté à `RESERVED_PAGE_SLUGS` ;
  - écrans de la file, du détail et des catégories ;
  - barre latérale, seed, phrase du réglage forage, `architecture.md` (32 tables, 13 scopées), design system §3.10 ;
  - spec e2e.

  Une seule nuance : la tâche 6 évoquait `updateTag`/`revalidatePath`, l'implémentation utilise seulement `revalidatePath(..., 'layout')`. C'est admis par le plan et conforme à la doc Next 16, groupes de routes compris.

## Anti-hallucination

- [x] **Aucune API, fonction ou import inventé.** Chaque cible a été ouverte et vérifiée :
  - `getDb`, `withTenant` et le comportement des scopes imbriqués (`src/db/tenant-scope.ts`) ;
  - `createServiceInterceptor(..., {shouldLogDetails})` ;
  - `fitToLength` et `fitSubjectToLength` (exportés par `contact-message-email.tsx`) ;
  - `receivedAtPartsOf` (`contact-message-types`) ;
  - `consumeContactMessageQuotaService`, qui renvoie `{allowed, limit}` ;
  - `getAssociationSettingsService`, `associationOriginOf`, `getOrganizationByIdDao` : même usage que le précédent `contact-message-service.ts` ;
  - `DialogContent showCloseButton`, les variantes `badge` `secondary`/`outline`/`destructive`, le token `--destructive-text` (`globals.css`) ;
  - `revalidatePath` avec groupe de route (doc `node_modules/next/dist/docs`).
- [x] **Aucune valeur ni logique plausible mais fausse** qui compte. Les schémas client et serveur ont les mêmes plafonds, avec le même traitement du `trim`. Les transitions `previousReportStatusOf` et `hasReachedReportStatus` sont correctes. Le plafond est vérifié côté serveur même quand l'écran l'a court-circuité, et la spec e2e le prouve (ligne 632).
- [x] **Le code fait ce qu'il annonce.** Aucune IP n'entre dans le service des signalements. `member_id` n'est jamais écrit, et il est prouvé `NULL` en SQL par l'e2e.

## Conformité aux règles

- [x] **Conventions du dépôt (AGENTS.md)** :
  - `getDb()` partout dans les repositories ;
  - `withTenant` sur chaque chemin serveur ;
  - **aucun nouveau `withRlsBypass()`** (6 occurrences hors tests, sur `main` comme sur la branche) ;
  - libellés dans `messages/fr.json` ;
  - un seul commit de story.
- [x] **Aucun ADR accepté contredit.**
  - ADR 002 et 003 : RLS forcée, et isolation croisée prouvée en e2e sous le rôle applicatif, par l'UI et en SQL direct, avec en plus un `categoryId` forgé de B refusé sur A.
  - ADR 010 : destinataires lus dans les Réglages et sur la catégorie, seuil du limiteur en paramètre. Le plafond de 10 et les longueurs sont des règles produit fixées par les critères de la story, identiques pour tous les tenants, pas des données d'une association.
  - ADR 020 : slug réservé.
  - ADR 025 : ni jsonb ni colonne d'adresse.
  - ADR 028 : respecté point par point.
- [x] **Design system respecté.** Uniquement des composants et variantes existants. Aucune couleur hors tokens : seul `bg-primary` sert au point du badge « Signalé ». L'email tire ses couleurs de `theme.ts`. Les gaps 1, 2 et 5 sont versés au §3.10. Le `select` est retenu (règle §3.1). Le parti d'intention du design est tenu : bandeau 112, un seul bouton `default` par écran, historique en phrases, bouton d'ajout jamais désactivé, badges « Signalé »/« En cours »/« Résolu » portés par le mot. La pagination suit le patron écrit de s08.

## Tests

- [x] **Suite unitaire lancée par le relecteur, verte ; e2e ciblée lancée, verte.**
- [x] **Les assertions épinglent les critères.** Les tests de service couvrent chaque rôle (DAO jamais appelé sur un refus), l'absence de rapprochement avec un membre (aucun DAO `user` ni membre appelé), l'échec d'un envoi sur deux, la lecture de l'adresse à l'envoi, et `stale`. L'e2e couvre les critères 1 à 9 plus l'isolation, avec des preuves SQL. Deux faiblesses mineures sont listées plus bas.

## Régressions

- [x] **Aucun impact sur les chemins existants.**
  - `/contact` : l'IP est lue par la fonction extraite, identique à l'ancienne. `contact.spec` et `rate-limit.spec` sont verts.
  - Réglages de s02 : seuls les textes du forage changent, et leurs tests ont été ajustés comme le plan le demandait. `association-settings.spec` est vert.
  - Isolation : `tenant-isolation.spec` est vert.
  - Barre latérale : l'entrée est insérée après « Messages reçus » et testée.

## Findings

- minor — `src/db/repositories/association-category-repository.ts` : `getCategoryByIdDao` est exporté mais jamais appelé (code mort), et il porte le même nom que `getCategoryByIdDao` de `post-repository.ts`, source de confusion à l'import.
- minor — `src/services/incident-report-service.ts` (`notifyBoard`) : si `contact.email` est absent, la fonction lève avant tout envoi. L'adresse de routage de la catégorie, pourtant résolue, n'est donc pas tentée. Le signalement est bien marqué `notification_failed`, rien n'est perdu, mais un envoi possible est sacrifié.
- minor — `src/components/features/incident-report/incident-report-detail.tsx` : ce composant client importe `nextReportStatusOf` depuis `@/services/validation/incident-report-validation`. La présentation touche ainsi la couche service, alors que `rule-architecture` la cantonne aux types de domaine. La fonction est pure : elle aurait sa place dans `incident-report-types.ts`.
- minor — `src/services/incident-report-service.ts` : `pngLogoUrlOf` est recopiée depuis `contact-message-service.ts` au lieu d'être partagée.
- minor — `src/services/__tests__/incident-report-service.test.ts` : les refus de transition (`reported→resolved`, `in_progress→reported`, `resolved→reported`) sont testés par `rejects.toThrow()` sans type. Le test passerait avec n'importe quelle erreur. Il faudrait épingler `ValidationError`.
- minor — `src/app/[locale]/(public)/signaler/actions.test.ts` : le test « ne transmet jamais l'adresse IP » cherche les clés `"ip"` et `forwarded`, pas la valeur de l'IP. Une IP passée sous une autre clé ne serait pas détectée.

## Verdict

Max severity: minor
Ship allowed: yes
