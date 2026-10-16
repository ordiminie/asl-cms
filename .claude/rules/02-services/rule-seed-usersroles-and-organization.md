---
description:
paths:
  - 'src/db/scripts/**'
  - 'src/services/__tests__/**'
  - 'e2e/**'
---

# Règle Seed - Utilisateurs, Rôles et Organisations

## Vue d'ensemble

Cette règle documente le jeu de test complet configuré dans [seed.ts](src/db/scripts/seed.ts) pour couvrir tous les cas d'usage du système d'autorisation avec les rôles globaux et organisationnels.

## Architecture des Rôles

### Rôles Globaux (System-wide)

Deux rôles globaux seulement (s47, ADR 035) :

- **USER** : tout compte, membre, Bureau ou Présidence d'une association
- **SUPER_ADMIN** : SuperAdmin Zourite Studio, accès total et seul admis sur `/admin`

Le visiteur sans compte n'a pas de rôle : il reçoit les droits d'invité.

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

### 🔐 SuperAdmin (sans organisation)

| Email                  | Nom   | Rôle Global | Usage                                            |
| ---------------------- | ----- | ----------- | ------------------------------------------------ |
| `superadmin@gmail.com` | Frank | SUPER_ADMIN | Console `/admin`, bypass complet des permissions |

**🎯 Cas d'usage** : Tester la console plateforme et le bypass global. C'est le seul compte au-dessus
de `user`.

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

### 🗂️ Adresses historiques (comptes `user` depuis s47)

Ces comptes portaient un rôle global retiré par s47. Ils gardent leur adresse et leurs appartenances,
dont dépendent des specs e2e, avec le rôle `user`.

| Email                        | Nom   | Rôle Global | Organisations                                         |
| ---------------------------- | ----- | ----------- | ----------------------------------------------------- |
| `admin@gmail.com`            | Admin | USER        | TechCorp MEMBER, Marketing Pro ADMIN, Acme Corp OWNER |
| `admin-owner@gmail.com`      | Emma  | USER        | Marketing Pro OWNER                                   |
| `moderator-member@gmail.com` | Julie | USER        | TechCorp MEMBER                                       |

**🎯 Cas d'usage** : Prouver qu'un ancien compte administrateur n'a plus que les droits de ses
appartenances, et rien sur `/admin`.

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
  'superadmin@gmail.com', // Accès total, console /admin
  'user@gmail.com', // Compte user : droits de ses appartenances
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

### 3. **Tests des adresses historiques**

```typescript
// Anciens comptes administrateurs, user depuis s47 : refusés sur /admin
const historicalAccounts = ['admin@gmail.com', 'admin-owner@gmail.com']
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
| `superadmin@gmail.com` | Bypass        | Bypass        | Bypass    | Bypass       |

### Test Matrix 2: Actions CRUD par Rôle

| Action           | MEMBER | ADMIN | OWNER | SUPER_ADMIN |
| ---------------- | ------ | ----- | ----- | ----------- |
| Créer Projet     | ✅     | ✅    | ✅    | ✅ (bypass) |
| Modifier Projet  | ❌     | ✅    | ✅    | ✅ (bypass) |
| Supprimer Projet | ❌     | ❌    | ✅    | ✅ (bypass) |
| Gérer Membres    | ❌     | ✅    | ✅    | ✅ (bypass) |

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
# Se connecter en tant que superadmin@gmail.com pour tester bypass
# Se connecter en tant que user-member@gmail.com pour tester limitations
```

## Points d'Attention

### 🔍 **À Vérifier lors des Tests**

1. **Isolation des organisations** : `user-member@gmail.com` ne doit voir que Acme Corp
2. **Progression des permissions** : `user@gmail.com` doit avoir des droits différents selon l'organisation
3. **Bypass global** : `superadmin@gmail.com` doit accéder à tout sans appartenir à une organisation
4. **Adresses historiques** : `admin-owner@gmail.com` n'a que les droits de sa présidence
5. **Isolation** : `user-isolated@gmail.com` ne doit voir aucune organisation privée

### ⚠️ **Cas Limites à Tester**

- Navigation entre organisations avec `user@gmail.com`
- Tentative d'accès non autorisé avec `user-member@gmail.com`
- Création de ressources sans appartenance organisationnelle
- Actions sur des organisations non-membres

## Intégration avec l'Architecture

Ce jeu de test est conçu pour valider :

- ✅ **Couche Service** : Validation et autorisation ([organization-authorization.ts](src/services/authorization/organization-authorization.ts))
- ✅ **Couche DAL** : Cache et transformation des données ([organization-dal.ts](src/app/dal/organization-dal.ts))
- ✅ **Couche Présentation** : Affichage conditionnel des composants ([organizations-management.tsx](src/components/features/admin/organizations/organizations-management.tsx))

> Le domaine cité était `projects`, retiré par l'ADR 009 dans s01. `organization` le remplace : c'est
> le seul domaine du dépôt qui traverse les cinq couches et porte des rôles d'organisation, donc
> celui sur lequel ce jeu de test se vérifie réellement.

Utilisez ce jeu de test pour valider end-to-end votre système d'autorisation multi-niveaux !
