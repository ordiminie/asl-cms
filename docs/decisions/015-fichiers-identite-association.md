# ADR 015 — Fichiers d'identité d'une association : références en base et route fixe par type

- Status: accepted
- Date: 2026-09-17
- Scope: story s01b-logo-association

## Context

s01b fait téléverser par le bureau un **logo** et un **favicon distincts**, servis par association selon le
domaine appelé, jamais depuis un dossier statique (ADR 004), et remplaçables « sans redéploiement » en
laissant le fichier précédent en place si le nouveau est refusé.

La recherche (`docs/research/s01b-logo-association.md`) a établi que :

- l'adaptateur `local` de l'ADR 004 n'existe pas ; le stockage actuel (Supabase) sert le blog, l'avatar et le
  formulaire d'organisation du boilerplate, qui reçoivent des URL publiques Supabase ;
- `organization.logo` (`text`) contient déjà des **URL** lues par des écrans du boilerplate
  (`organizations-management.tsx`, `account/organizations`) ;
- `generateFilePath` incorpore le **nom de fichier fourni par l'utilisateur** ;
- la résolution du tenant est cachée (`cacheTag('tenant')`) et un `GET` qui lit `headers()` est dynamique.

Arbitrage de Marie-Ève (2026-09-17) : **seuls le logo et le favicon** passent sur le disque dans cette
story ; les autres flux gardent leur stockage.

## Decision

1. **Adaptateur `local` réservé aux fichiers d'identité.** Une implémentation `local` de `StorageOperations`
   est ajoutée au factory, sous un répertoire racine configuré dans `@/env`. Le type par défaut des flux
   existants **ne change pas**.
2. **Références sur `organization`, dans deux colonnes dédiées et nullables** — `identity_logo_key` et
   `identity_favicon_key`. La clé est générée par le serveur :
   `{organizationId}/identity/{logo|favicon}-{uuid}.{png|webp|ico}`. **Aucun nom fourni par l'utilisateur**
   n'entre dans un chemin. `organization.logo` n'est pas touchée.
3. **Remplacement en trois temps** : écrire le nouveau fichier sous une nouvelle clé → mettre à jour la
   colonne → supprimer l'ancien fichier. Un échec avant la mise à jour laisse l'ancien fichier **et** l'ancienne
   référence intacts ; un échec de suppression ne laisse qu'un orphelin sur disque, jamais une référence cassée.
4. **Route de lecture fixe par type** : `GET /api/identity/{logo|favicon}`. Le type est un énuméré, le tenant
   vient du domaine appelé, la clé vient de la base : **aucun chemin n'est lu depuis la requête**, la traversée
   est impossible par construction. Le `Content-Type` dérive du format validé à l'écriture, avec
   `X-Content-Type-Options: nosniff`. Les pages référencent la route avec un paramètre de version tiré de la
   clé (`?v=`), ce qui autorise un cache long sans retarder un remplacement.
5. **Replis** : sans logo, l'interface affiche le **monogramme** et la route répond 404 ; sans favicon, la route
   sert un **monogramme SVG généré** par le serveur (contenu produit par l'application, jamais par un
   utilisateur).

## Considered options

- **Réutiliser `organization.logo`** — rejeté : la colonne porte des URL affichées telles quelles par des écrans
  du boilerplate ; y écrire une clé de stockage casserait ces écrans, et mêler URL externes et clés internes
  rendrait la colonne ambiguë.
- **Convention de nom fixe sur disque, sans référence en base** (`{orgId}/identity/logo`) — rejeté : pas de
  version pour invalider le cache HTTP, remplacement en place non atomique (un fichier à moitié écrit remplace
  l'ancien), et une lecture disque pour savoir si un logo existe à chaque rendu.
- **Chemin de fichier en paramètre de la route** (`/api/files/[...path]`) — rejeté : surface de traversée et de
  lecture croisée entre associations à défendre à chaque appel, pour deux fichiers seulement.
- **Basculer tout le stockage sur `local` dès maintenant** — rejeté par arbitrage (2026-09-17) : les URL
  Supabase des flux existants casseraient ; ils migreront avec leur story (s04, s31).
- **Accepter le SVG pour le logo** (design system §1.8) — rejeté : un SVG servi depuis le domaine de
  l'association peut porter du script ; PNG et WebP seulement (arbitrage du 2026-09-17).

## Consequences

**Ce qui devient plus simple**

- Le fichier d'identité suit la résolution de tenant déjà cachée : la clé voyage dans `TenantDTO`, invalidée par
  `updateTag('tenant')` au remplacement.
- Cache HTTP long et remplacement immédiat à la fois, grâce à l'URL versionnée.
- s04, s31 et s32 réutiliseront l'adaptateur `local` ; seule la règle d'accès de leur route changera.

**Ce qui devient plus difficile**

- Deux stockages coexistent (Supabase pour les flux hérités, disque pour l'identité) jusqu'à la migration des
  autres flux.
- Des fichiers orphelins peuvent subsister après un échec de suppression : acceptable à cette volumétrie, à
  couvrir par la sauvegarde et un éventuel nettoyage.
- Le répertoire racine doit exister et être accessible en écriture en développement, en CI et en production ;
  sa **sauvegarde** relève de la story de mise en ligne (revue du découpage M4).

**À surveiller**

- Le favicon par défaut en SVG n'est pas affiché par tous les navigateurs (Safari ancien) : repli acceptable,
  l'onglet montre alors l'icône générique du navigateur.
- Les dimensions (logo ≥ 512 px) sont **annoncées, pas vérifiées** : les vérifier demanderait une dépendance
  de décodage d'image, écartée ici.
