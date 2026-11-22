# ADR 069 — Documents partagés : une table dédiée, une clé hors des portées publiques, une route authentifiée par identifiant

- Status: accepted
- Date: 2026-11-22
- Scope: story s31-documents-partages
- Complète : ADR 004 (stockage sur le disque du VPS), ADR 023 (chaîne des fichiers de contenu), ADR 028
  (catégories génériques), ADR 045 (inventaire des clés de fichier)

## Context

s31 publie aux membres authentifiés d'une association ses statuts, PV et ordres du jour. Le fichier ne doit
**jamais** être servi par une URL publique devinable (critère 3), ne doit jamais sortir d'une association vers
une autre (critère 4) et doit cesser d'être servi dès son retrait (critère 5).

Trois faits du code pèsent sur le choix :

- la seule route de lecture de fichiers de contenu, `GET /api/files/[...key]`, sert **sans autorisation**
  toute clé placée sous une portée de `CONTENT_FILE_SCOPES`, avec un cache `public, immutable` d'un an ;
- `src/proxy.ts` exclut `/api` de son `matcher` : aucune route `/api/…` n'est gardée en amont ;
- l'architecture annonçait une table `document` « partagé ou nominatif », mais s32 exige pour le nominatif un
  dossier **physiquement séparé par fiche**, une autorisation par fiche et des règles de vente datées qu'un
  document partagé n'a pas.

## Decision

1. **Table dédiée `shared_document`** : `id`, `organization_id` (RLS forcée, policy `tenant_isolation`),
   `title`, `category_id` → `association_category`, `file_key`, `file_bytes`, `created_at`. Pas de discriminant
   partagé / nominatif, pas de colonne « pour s32 ». s32 aura son propre modèle.
2. **Catégorie administrable** : nouveau domaine `document` de `association_category` (ADR 028), gouverné par
   l'action de gestion des documents. « Statuts », « Procès-verbaux », « Ordres du jour » sont des **valeurs de
   seed** du premier tenant (ADR 010), jamais des constantes. Une catégorie supprimée (suppression logique)
   garde son nom sur les documents déjà rangés.
3. **Clé hors des portées publiques** : `{organizationId}/shared-documents/{documentId}/file-{uuid}.pdf`,
   générée par le serveur. `shared-documents` **n'est pas** une portée de `CONTENT_FILE_SCOPES` : la route
   publique la refuse (404). Un test de garde le vérifie.
4. **Route `GET /api/documents/[id]`, par identifiant** : le tenant vient du domaine appelé (ADR 003) ;
   l'identifiant est relu sous `withTenant`, la clé vient de la base, jamais de la requête. Le service exige un
   utilisateur authentifié ayant l'action de lecture dans **cette** association (`canPerformAction`, défense en
   profondeur au-delà de l'ADR 034). Réponses : sans session 401, sans droit 403, identifiant inconnu, d'une
   autre association ou retiré 404 ; `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
   `Content-Disposition: attachment` sous un nom tiré du titre, ASCII seul.
5. **Deux actions au registre** (ADR 018) : `shared.document.manage` (`owner`, `board`) — déposer, retirer,
   administrer les catégories du domaine — et `shared.document.read` (`owner`, `board`, `member`).
6. **Format et volume** : PDF seul, 10 Mo au plus — la nature `document` existante (`validateContentFile`,
   signature binaire). Pas de quota par association : à quelques documents par an, le plafond par fichier
   suffit sur 100 Go.
7. **Ordre des écritures** (ADR 004 « À surveiller ») : au dépôt, fichier écrit puis ligne insérée, fichier
   effacé si l'insertion échoue ; au retrait, ligne supprimée puis fichier effacé, un échec disque laissant un
   orphelin journalisé, jamais une ligne sans fichier.

## Considered options

- **Une table `document` avec discriminant partagé / nominatif** — rejeté : les règles d'accès, de stockage
  (dossier par fiche) et de datation de s32 ne s'appliquent pas au partagé ; un discriminant mélangerait deux
  autorisations dans une requête et rendrait un oubli de filtre fuyant pour le nominatif.
- **Ajouter une portée `documents` à `CONTENT_FILE_SCOPES` et servir par `/api/files`** — rejeté sans appel :
  la route publique servirait le document à quiconque connaît la clé, avec un cache d'un an qui survivrait au
  retrait (critères 3 et 5).
- **Route par clé, contrôlée par session** (`/api/documents/[...key]`) — rejeté : la clé apparaîtrait dans la
  page et l'adresse, et il faudrait valider un chemin venu de la requête ; par identifiant, rien n'est à
  valider au-delà d'un uuid.
- **URL signée à durée limitée** (patron du PDF Pennylane de s20) — rejeté : une URL signée se partage le temps
  de sa validité et survit au retrait jusqu'à expiration ; la route contrôle à chaque lecture.
- **Catégories en liste fermée dans le code** — rejeté : contraire à l'ADR 010 (« rien en dur ») ; le domaine
  générique de l'ADR 028 existe et s23 l'a déjà étendu sans migration.
- **Quota de stockage par association** — écarté pour V1 : aucun critère ne le demande, la volumétrie est
  négligeable ; à rouvrir si s32 (≈ 800 fichiers/an) le justifie.

## Consequences

- s32 et s34 réutilisent la **forme** de la route (tenant par domaine, identifiant relu sous RLS, `no-store`) ;
  s34 publie le PV comme document partagé sans nouvelle table.
- `file_key` rejoint l'inventaire de s12c (`FILE_KEY_COLUMNS`) et la fixture de `e2e/backup-restore.spec.ts`.
- Le classement RLS passe de 54 à 55 tables (36 scopées).
- L'écran générique des catégories reçoit un paramètre qui masque l'adresse de routage, sans usage pour un
  document.
- À surveiller : aucune route `/api` n'étant gardée par le proxy, toute future route de fichier doit refaire ce
  contrôle elle-même.
