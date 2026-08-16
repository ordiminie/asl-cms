---
description:
---

# Règle Seed - Utilisateurs, Rôles et Organisations

## Vue d'ensemble

Cette règle documente le jeu de test complet configuré dans [seed.ts](src/db/scripts/seed.ts) pour couvrir tous les cas d'usage du système d'autorisation avec les rôles globaux et organisationnels.

## Architecture des Rôles

### Rôles Globaux (System-wide)

- **PUBLIC** : Utilisateur public avec accès minimal
- **USER** : Utilisateur standard avec accès limité
- **REDACTOR** : Rédacteur avec permissions d'édition
- **MODERATOR** : Modérateur avec permissions étendues
- **ADMIN** : Administrateur avec tous les privilèges
- **SUPER_ADMIN** : Super administrateur avec accès total

### Rôles Organisationnels

- **MEMBER** : Membre standard de l'organisation
- **ADMIN** : Administrateur de l'organisation
- **OWNER** : Propriétaire de l'organisation

## Organisations de Test

| Slug                 | Nom                | Description                          |
| -------------------- | ------------------ | ------------------------------------ |
| `techcorp-solutions` | TechCorp Solutions | Entreprise de développement logiciel |
| `marketing-pro`      | Marketing Pro      | Agence de marketing digital          |
| `acme-corp`          | Acme Corp.         | Startup innovante en technologie     |
| `evil-corp`          | Evil Corp.         | Entreprise de cybersécurité          |

## Jeu de Test Détaillé

### 🔐 Rôles Globaux Purs (sans organisations)

| Email                  | Nom     | Rôle Global | Usage                                   |
| ---------------------- | ------- | ----------- | --------------------------------------- |
| `superadmin@gmail.com` | Frank   | SUPER_ADMIN | Test bypass complet des permissions     |
| `admin@gmail.com`      | Admin   | ADMIN       | Test permissions administrateur système |
| `moderator@gmail.com`  | David   | MODERATOR   | Test permissions modérateur             |
| `redactor@gmail.com`   | Grace   | REDACTOR    | Test permissions rédacteur              |
| `public@gmail.com`     | Charlie | PUBLIC      | Test accès minimal                      |

**🎯 Cas d'usage** : Tester les permissions système globales, bypass organisationnel, accès admin universel.

### 🔄 Utilisateur Multi-Organisations

| Email            | Nom | Rôle Global | TechCorp | Marketing Pro | Acme Corp | Evil Corp |
| ---------------- | --- | ----------- | -------- | ------------- | --------- | --------- |
| `user@gmail.com` | Bob | USER        | MEMBER   | -             | ADMIN     | OWNER     |

**🎯 Cas d'usage** : Tester la progression des permissions (MEMBER → ADMIN → OWNER), contexte organisationnel variable, navigation entre organisations.

### 🎯 Utilisateurs Spécialisés (1 organisation = 1 rôle)

| Email                   | Nom    | Rôle Global | Organisation  | Rôle Org |
| ----------------------- | ------ | ----------- | ------------- | -------- |
| `user-owner@gmail.com`  | Julien | USER        | TechCorp      | OWNER    |
| `user-admin@gmail.com`  | Sophie | USER        | Marketing Pro | ADMIN    |
| `user-member@gmail.com` | Lucas  | USER        | Acme Corp     | MEMBER   |

**🎯 Cas d'usage** : Tester les permissions pures par rôle organisationnel, isolation des contextes.

### ⚖️ Cas de Chevauchement (Rôle Global + Organisationnel)

| Email                        | Nom   | Rôle Global | Organisation  | Rôle Org |
| ---------------------------- | ----- | ----------- | ------------- | -------- |
| `admin-owner@gmail.com`      | Emma  | ADMIN       | Marketing Pro | OWNER    |
| `moderator-member@gmail.com` | Julie | MODERATOR   | TechCorp      | MEMBER   |

**🎯 Cas d'usage** : Tester la priorité des permissions (global vs organisationnel), permissions cumulatives.

### 🏝️ Utilisateur Isolé

| Email                     | Nom    | Rôle Global | Organisations |
| ------------------------- | ------ | ----------- | ------------- |
| `user-isolated@gmail.com` | Thomas | USER        | Aucune        |

**🎯 Cas d'usage** : Tester les permissions sans contexte organisationnel, accès limité aux ressources publiques.

## Scénarios de Test Recommandés

### 1. **Tests de Permissions Globales**

```typescript
// Utilisateurs à tester
const globalUsers = [
  'superadmin@gmail.com', // Accès total
  'admin@gmail.com', // Accès admin
  'moderator@gmail.com', // Accès modérateur
  'redactor@gmail.com', // Accès rédacteur
  'public@gmail.com', // Accès minimal
]
```

### 2. **Tests de Context Organisationnel**

```typescript
// user@gmail.com dans différentes organisations
const multiOrgTests = [
  {org: 'techcorp-solutions', role: 'MEMBER'}, // Permissions limitées
  {org: 'acme-corp', role: 'ADMIN'}, // Permissions étendues
  {org: 'evil-corp', role: 'OWNER'}, // Permissions maximales
]
```

### 3. **Tests de Chevauchement**

```typescript
// Test priorité des permissions
const overlapTests = [
  'admin-owner@gmail.com', // ADMIN global + OWNER org
  'moderator-member@gmail.com', // MODERATOR global + MEMBER org
]
```

### 4. **Tests d'Isolation**

```typescript
// Test utilisateur sans organisation
const isolationTest = 'user-isolated@gmail.com' // USER sans orgs
```

## Matrices de Test Suggérées

### Test Matrix 1: Accès aux Projets par Organisation

| Utilisateur            | TechCorp      | Marketing Pro | Acme Corp | Evil Corp    |
| ---------------------- | ------------- | ------------- | --------- | ------------ |
| `user@gmail.com`       | Lecture seule | Aucun         | Écriture  | Propriétaire |
| `user-owner@gmail.com` | Propriétaire  | Aucun         | Aucun     | Aucun        |
| `admin@gmail.com`      | Bypass        | Bypass        | Bypass    | Bypass       |

### Test Matrix 2: Actions CRUD par Rôle

| Action           | MEMBER | ADMIN | OWNER | ADMIN Global |
| ---------------- | ------ | ----- | ----- | ------------ |
| Créer Projet     | ✅     | ✅    | ✅    | ✅ (bypass)  |
| Modifier Projet  | ❌     | ✅    | ✅    | ✅ (bypass)  |
| Supprimer Projet | ❌     | ❌    | ✅    | ✅ (bypass)  |
| Gérer Membres    | ❌     | ✅    | ✅    | ✅ (bypass)  |

## Commandes Utiles

### Réinitialiser la base avec le seed

```bash
pnpm run db:reset
pnpm run db:seed
```

### Connexion rapide pour tests

```bash
# Test avec différents utilisateurs
# Se connecter en tant que user@gmail.com pour tester multi-org
# Se connecter en tant que admin@gmail.com pour tester bypass
# Se connecter en tant que user-member@gmail.com pour tester limitations
```

## Points d'Attention

### 🔍 **À Vérifier lors des Tests**

1. **Isolation des organisations** : `user-member@gmail.com` ne doit voir que Acme Corp
2. **Progression des permissions** : `user@gmail.com` doit avoir des droits différents selon l'organisation
3. **Bypass global** : `admin@gmail.com` doit accéder à tout sans appartenir à une organisation
4. **Chevauchement** : `admin-owner@gmail.com` doit cumuler les permissions
5. **Isolation** : `user-isolated@gmail.com` ne doit voir aucune organisation privée

### ⚠️ **Cas Limites à Tester**

- Navigation entre organisations avec `user@gmail.com`
- Tentative d'accès non autorisé avec `user-member@gmail.com`
- Création de ressources sans appartenance organisationnelle
- Actions sur des organisations non-membres

## Intégration avec l'Architecture

Ce jeu de test est conçu pour valider :

- ✅ **Couche Service** : Validation et autorisation ([project-authorization.ts](src/services/authorization/project-authorization.ts))
- ✅ **Couche DAL** : Cache et transformation des données ([project-dal.ts](src/app/dal/project-dal.ts))
- ✅ **Couche Présentation** : Affichage conditionnel des composants ([projects-management.tsx](src/components/features/projects/projects-management.tsx))

Utilisez ce jeu de test pour valider end-to-end votre système d'autorisation multi-niveaux !
