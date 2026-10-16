---
description:
paths: src/services/authorization/**
---

# Système de Rôles Globaux et Rôles Organisationnels

## Vue d'ensemble

Le projet utilise un **système de rôles à deux niveaux** :

1. **Rôles globaux** : Permissions système générales
2. **Rôles organisationnels** : Permissions fines dans le contexte d'une organisation

Cette architecture permet une gestion flexible des permissions avec une hiérarchie claire entre les niveaux d'accès.

## Rôles Globaux

### Définition

Les rôles globaux sont définis dans [auth-types.ts](src/services/types/domain/auth-types.ts) et [user-types.ts](src/services/types/domain/user-types.ts).

### Deux rôles globaux (s47, ADR 035)

```typescript
export const roleHierarchy: readonly Roles[] = ['user', 'super_admin']

export const RoleConst = {
  USER: 'user' satisfies Roles,
  SUPER_ADMIN: 'super_admin' satisfies Roles,
} as const
```

L'énuméré Postgres `role_type` ne porte que ces deux valeurs. Les rôles qui
comptent pour une association (Membre, Bureau, Présidence) sont des rôles
**d'association** (`member.role`), décrits plus bas.

#### 1. **Visiteur sans compte** (aucun rôle)

- **Utilisateurs non authentifiés** : `defineAbilitiesFor(undefined)`
- **Permissions limitées** : droits d'invité (profils publics, contenus publiés)
- Un compte dont le rôle est absent ou inconnu reçoit les mêmes droits d'invité,
  et `hasRequiredRole(s)` ne lui accorde aucune exigence.

#### 2. **USER** (`user`)

- **Tout compte** : membre, Bureau ou Présidence d'une association
- **Permissions de base** : Gestion de son profil
- **Particularité** : Utilise les **rôles organisationnels** pour des permissions fines

#### 3. **SUPER_ADMIN** (`super_admin`)

- **SuperAdmin Zourite Studio**, seul admis sur la console `/admin` et ses actions serveur
- **Permissions complètes** : Accès total à toutes les ressources (`MANAGE ALL`)
- **Bypass** : Outrepasse tous les contrôles d'autorisation
- `withAuthAdmin`, `isUserAdmin` et `isAuthAdmin` gardent un nom historique :
  ils ne reconnaissent que `super_admin`.

## Rôles Organisationnels

### Définition

Les rôles organisationnels sont définis dans [organization-types.ts](src/services/types/domain/organization-types.ts).

```typescript
export const UserOrganizationRoleConst = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const
```

### Hiérarchie des Rôles Organisationnels

#### 1. **OWNER**

- **Propriétaire de l'organisation**
- **Permissions** : `MANAGE` sur toutes les ressources de l'organisation
  - Organisation : Création, lecture, modification, suppression
  - Utilisateurs : Gestion complète des membres
  - Subscriptions : Gestion complète
- **Restrictions** : Aucune dans le contexte de son organisation

#### 2. **ADMIN**

- **Administrateur de l'organisation**
- **Permissions** :
  - Organisation : Lecture et modification (pas suppression)
  - Utilisateurs : Lecture et modification des membres
  - Subscriptions : Gestion complète (`MANAGE`)
- **Restrictions** : Ne peut pas supprimer l'organisation

#### 3. **MEMBER**

- **Membre standard de l'organisation**
- **Permissions** : `READ` uniquement
  - Organisation : Lecture seule
  - Utilisateurs : Lecture des autres membres
  - Subscriptions : Lecture des subscriptions de l'organisation
- **Restrictions** : Aucune permission de modification

## Architecture d'Autorisation

### Logique de Résolution des Permissions

Le système utilise l'ordre de priorité suivant dans [authorization-service.ts](src/services/authorization/authorization-service.ts) :

```typescript
export function defineAbilitiesFor(
  user?: User,
  orgContext?: OrganizationContext
) {
  // 1. Aucun compte → droits d'invité
  if (!user) return buildGuestAbilities()

  // 2. SUPER_ADMIN → Permissions complètes
  if (user.role === RoleConst.SUPER_ADMIN) {
    return buildSuperAdminAbilities()
  }

  // 3. USER → Permissions de base + rôles organisationnels
  if (user.role === RoleConst.USER) {
    return buildUserAbilities(user, orgContext)
  }

  // 4. Rôle absent ou inconnu → droits d'invité
  return buildGuestAbilities()
}
```

### Contexte Organisationnel

```typescript
export interface OrganizationContext {
  organizationId: string // Organisation courante
}
```

- **Sans contexte** : Seules les permissions globales s'appliquent
- **Avec contexte** : Les rôles organisationnels s'ajoutent aux permissions de base

## Exemples d'Usage

### Service avec Autorisation Organisationnelle

```typescript
// Exemple dans organization-service.ts
export const updateOrganizationService = async (data: UpdateOrganization) => {
  const granted = await canUpdateOrganization(data.id)
  if (!granted) {
    throw new AuthorizationError()
  }
  return await updateOrganizationDao(data)
}
```

### Vérification des Permissions

```typescript
// Vérification avec contexte organisationnel
const orgContext: OrganizationContext = {organizationId: 'org-123'}
const canUpdate = userCanOnResource(
  user,
  ActionsConst.UPDATE,
  SubjectsConst.ORGANIZATION,
  {id: organizationId},
  orgContext
)
```

## Fonctions Utilitaires

### Vérification des Rôles Organisationnels

```typescript
// Dans authorization-service.ts
export function getUserRoleInOrganization(
  user: User,
  orgId: string
): OrganizationRole | undefined
export function isOrganizationOwner(user: User, orgId: string): boolean
export function isOrganizationAdmin(user: User, orgId: string): boolean
export function hasOrganizationRole(
  user: User,
  orgId: string,
  role: OrganizationRole
): boolean
```

## Bonnes Pratiques

### ✅ À Faire

- **Toujours vérifier les autorisations** avant les opérations métier
- **Utiliser le contexte organisationnel** pour les permissions fines
- **Respecter la hiérarchie** : seul le SUPER_ADMIN global peut bypass
- **Tester tous les scénarios** : OWNER, ADMIN, MEMBER, non-membre

### ❌ À Éviter

- **Mélanger les niveaux** de rôles dans la logique
- **Oublier le contexte organisationnel** pour les USER
- **Hard-coder les permissions** au lieu d'utiliser les fonctions d'autorisation

## Tests

### Pattern de Tests par Rôle

```typescript
describe('[ORGANIZATION OWNER] Service', () => {
  beforeEach(() => {
    const userOwner = {
      ...userTest,
      organizations: [
        {
          userId: userTest.id,
          organizationId: 'org-123',
          role: UserOrganizationRoleConst.OWNER,
        },
      ],
    }
    setupAuthUserMocked(userOwner)
  })

  it('should allow full management', async () => {
    // Test permissions OWNER
  })
})
```

### Scénarios de Test Essentiels

1. **SUPER_ADMIN global** (`userTestSuperAdmin`) : Peut tout faire
2. **ORGANIZATION OWNER** : Permissions complètes dans son org
3. **ORGANIZATION ADMIN** : Permissions limitées (pas de suppression)
4. **ORGANIZATION MEMBER** : Lecture seule
5. **USER non-membre** : Pas d'accès organisationnel
6. **GUEST** : Accès minimal

## Intégration

Le système s'intègre avec :

- **CASL** pour la gestion des permissions
- **Services métier** pour les vérifications d'autorisation
- **DAL** pour les données utilisateur avec rôles
- **Organisation Authorization** dans [organization-authorization.ts](src/services/authorization/organization-authorization.ts)

Cette architecture garantit une **sécurité robuste** et une **flexibilité maximale** pour la gestion des permissions multi-niveaux.
