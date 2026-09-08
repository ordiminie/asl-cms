# ADR 004 — Stockage des fichiers sur le disque du VPS

- Status: accepted
- Date: 2026-09-08
- Scope: framing

## Context

Le boilerplate stocke les fichiers sur **Supabase Storage** (`src/lib/files/storage/supabase-storage.ts`, dépendances `@supabase/storage-js` et `@supabase/supabase-js`). Le PRD impose un hébergement sur un VPS LWS en France (2 vCore, 4 Go, 100 Go SSD) et note que « le stockage de fichiers du boilerplate (Supabase) devra être remplacé », en renvoyant l'arbitrage à `/ks-architect`.

L'analyse du code révèle une bonne nouvelle : la couture existe déjà. `src/lib/files/storage/storage-factory.ts` expose

```ts
export const createStorage = (type: StorageType, config: StorageConfig): StorageOperations
```

avec un contrat `StorageOperations` de quatre opérations (`upload`, `download`, `delete`, `list`) dans `types.ts`, et un cas `'s3'` non implémenté portant le commentaire `//todo adapter`. Le service métier `src/services/file-service.ts` ne connaît que ce contrat.

Deux exigences du PRD pèsent sur le choix : les documents nominatifs doivent vivre dans des **dossiers physiquement séparés par membre** (s32, « exclure tout accès croisé même en cas de bug d'autorisation »), et la volumétrie est modeste — de l'ordre de 2 documents par membre et par an, soit ~800 fichiers/an pour La Fourche.

## Decision

Ajouter une implémentation **`local`** au factory existant, écrivant sur un volume disque du VPS, et en faire le type par défaut. Supabase et S3 restent des valeurs possibles du même énuméré.

- Le contrat `StorageOperations` n'est pas modifié : l'adaptateur local implémente les quatre mêmes opérations. Un point demande attention — `list` retourne aujourd'hui un `FileObject` importé de `@supabase/storage-js`, ce qui fait fuiter le fournisseur dans le contrat. Ce type est remplacé par un type de domaine maison, seule modification du contrat.
- L'arborescence est scopée tenant d'abord, puis entité : `{organizationId}/{entityType}s/{entityId}/{category}-{timestamp}.{ext}`. Le préfixe par tenant est ce qui donne la séparation physique exigée, y compris entre associations.
- **Aucun fichier n'est servi statiquement.** Les fichiers vivent hors de `public/`, et la lecture passe par une route applicative qui vérifie l'autorisation avant de streamer. Un chemin deviné ne suffit jamais à obtenir un document.
- Les dépendances Supabase sont retirées avec le reste du nettoyage de l'ADR 009.

## Considered options

- **Conserver Supabase Storage** — rejeté : dépendance SaaS externe et transfert de documents nominatifs (factures, convocations) hors du VPS français, pour un besoin de quelques centaines de fichiers par an. Ajoute un sous-traitant à documenter au RGPD sans contrepartie technique.
- **Implémenter le cas `s3` déjà prévu, vers un S3 compatible (Scaleway, OVH)** — non retenu à ce stade, et c'est le remplaçant naturel si le disque devient contraignant : même contrat, mêmes appels. Écarté maintenant parce qu'il ajoute un fournisseur et une facture pour ~800 fichiers/an que 100 Go de SSD absorbent sans effort.
- **Stocker les fichiers en base (`bytea` ou large objects)** — rejeté : gonfle les sauvegardes et les dumps de la base, dégrade les temps de restauration, et prive du streaming. La base est déjà l'actif le plus critique à sauvegarder ; ne pas y verser des PDF.
- **Servir les fichiers depuis `public/`** — rejeté sans appel : rendrait tout document nominatif accessible à qui devine son URL, ce qui contredit exactement l'exigence de s32.

## Consequences

**Ce qui devient plus simple**

- Un seul hébergement, une seule sauvegarde à opérer, aucun secret de stockage tiers à gérer. Cohérent avec un contrat de maintenance à [montant masqué]/an.
- Le développement local n'a plus besoin d'un compte Supabase : le stockage est un dossier.
- La séparation physique par membre, exigence forte de s32, devient une simple propriété de l'arborescence.

**Ce qui devient plus difficile**

- **La sauvegarde des fichiers devient notre responsabilité**, alors que Supabase la portait. Les scripts `db_backup.sh` / `db_restore.sh` du dépôt ne couvrent que Postgres : ils doivent être étendus au volume de fichiers, sans quoi une restauration rendrait une base cohérente pointant vers des documents disparus.
- Le disque est fini. À la volumétrie prévue c'est confortable, mais ce n'est plus élastique.
- Une éventuelle mise à l'échelle horizontale imposerait un volume partagé ou le passage à l'adaptateur S3. Non pertinent pour six associations sur un VPS, à ne pas oublier pour autant.

**À surveiller**

- Vérifier que le volume de fichiers est bien inclus dans la sauvegarde infogérée du VPS, et pas seulement la base.
- La suppression d'un fichier doit rester transactionnellement cohérente avec la ligne en base qui le référence : un échec disque ne doit pas laisser une référence orpheline, ni l'inverse.
