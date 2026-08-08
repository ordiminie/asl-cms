import {describe, expect, it} from 'vitest'

import {
  RoleConst,
  UserOrganizationRoleConst,
} from '@/services/types/domain/auth-types'
import {type OrganizationRole} from '@/services/types/domain/organization-types'
import type {User} from '@/services/types/domain/user-types'

import {defineAbilitiesFor} from '../authorization-service'
import {ActionsConst, SubjectsConst} from '../casl-abilities'

// Données de test
const organizationId = 'org-123'
const otherOrganizationId = 'org-456'
const userId = 'user-123'

// Helper pour créer un utilisateur avec rôle organisationnel
const createUserWithOrgRole = (
  id: string,
  orgId: string,
  orgRole: string
): User => ({
  id,
  email: `user${id}@test.com`,
  name: `User ${id}`,
  emailVerified: false,
  image: null,
  role: RoleConst.USER,
  organizations: [
    {
      id: `member-${id}`,
      organizationId: orgId,
      userId: id,
      role: orgRole as OrganizationRole,
      createdAt: new Date(),
    },
  ],
  visibility: 'public' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  banned: false,
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
})

describe('buildOrganizationalAbilities', () => {
  describe('OWNER Role', () => {
    const ownerUser = createUserWithOrgRole(
      userId,
      organizationId,
      UserOrganizationRoleConst.OWNER
    )
    const orgContext = {organizationId}

    it('should grant MANAGE permissions for organization', () => {
      const ability = defineAbilitiesFor(ownerUser, orgContext)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)).toBe(
        true
      )
    })

    it('should grant MANAGE permissions for users', () => {
      const ability = defineAbilitiesFor(ownerUser, orgContext)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(true)
    })

    it('should grant MANAGE permissions for subscriptions', () => {
      const ability = defineAbilitiesFor(ownerUser, orgContext)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
    })

    it('should NOT have organizational permissions without context', () => {
      const abilityWithoutContext = defineAbilitiesFor(ownerUser)
      expect(
        abilityWithoutContext.can(
          ActionsConst.MANAGE,
          SubjectsConst.ORGANIZATION
        )
      ).toBe(false)
    })
  })

  describe('ADMIN Role', () => {
    const adminUser = createUserWithOrgRole(
      userId,
      organizationId,
      UserOrganizationRoleConst.ADMIN
    )
    const orgContext = {organizationId}

    it('should grant READ/UPDATE permissions for organization', () => {
      const ability = defineAbilitiesFor(adminUser, orgContext)
      expect(ability.can(ActionsConst.READ, SubjectsConst.ORGANIZATION)).toBe(
        true
      )
      expect(ability.can(ActionsConst.UPDATE, SubjectsConst.ORGANIZATION)).toBe(
        true
      )
    })

    it('should NOT grant DELETE permissions for organization', () => {
      const ability = defineAbilitiesFor(adminUser, orgContext)
      expect(ability.can(ActionsConst.DELETE, SubjectsConst.ORGANIZATION)).toBe(
        false
      )
    })

    it('should grant READ/UPDATE permissions for users', () => {
      const ability = defineAbilitiesFor(adminUser, orgContext)
      expect(ability.can(ActionsConst.READ, SubjectsConst.USER)).toBe(true)
      expect(ability.can(ActionsConst.UPDATE, SubjectsConst.USER)).toBe(true)
    })

    it('should grant MANAGE permissions for subscriptions', () => {
      const ability = defineAbilitiesFor(adminUser, orgContext)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
    })

    it('should NOT have organizational permissions without context', () => {
      const abilityWithoutContext = defineAbilitiesFor(adminUser)
      expect(
        abilityWithoutContext.can(
          ActionsConst.UPDATE,
          SubjectsConst.ORGANIZATION
        )
      ).toBe(false)
    })
  })

  describe('MEMBER Role', () => {
    const memberUser = createUserWithOrgRole(
      userId,
      organizationId,
      UserOrganizationRoleConst.MEMBER
    )
    const orgContext = {organizationId}

    it('should grant READ permissions for organization', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      expect(ability.can(ActionsConst.READ, SubjectsConst.ORGANIZATION)).toBe(
        true
      )
    })

    it('should NOT grant WRITE permissions for organization', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      expect(ability.can(ActionsConst.UPDATE, SubjectsConst.ORGANIZATION)).toBe(
        false
      )
      expect(ability.can(ActionsConst.DELETE, SubjectsConst.ORGANIZATION)).toBe(
        false
      )
    })

    it('should grant READ permissions for users', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      expect(ability.can(ActionsConst.READ, SubjectsConst.USER)).toBe(true)
    })

    it('should NOT grant DELETE permissions for users', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      // Member can update their own profile and organization users, but cannot delete
      expect(ability.can(ActionsConst.DELETE, SubjectsConst.USER)).toBe(false)
    })

    it('should grant READ permissions for subscriptions', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      expect(ability.can(ActionsConst.READ, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
    })

    it('should NOT grant DELETE permissions for subscriptions', () => {
      const ability = defineAbilitiesFor(memberUser, orgContext)
      // Member can update their own subscriptions, but cannot delete generally
      expect(ability.can(ActionsConst.DELETE, SubjectsConst.SUBSCRIPTION)).toBe(
        false
      )
    })
  })

  describe('Context Validation', () => {
    it('should NOT grant organizational permissions without context', () => {
      const userWithOrg = createUserWithOrgRole(
        userId,
        organizationId,
        UserOrganizationRoleConst.OWNER
      )

      const ability = defineAbilitiesFor(userWithOrg) // Sans contexte organisationnel
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)).toBe(
        false
      )
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(false)
    })

    it('should NOT grant organizational permissions for organization user is not part of', () => {
      const userNotInOrg = createUserWithOrgRole(
        userId,
        otherOrganizationId,
        UserOrganizationRoleConst.OWNER
      )
      const orgContext = {organizationId}

      const ability = defineAbilitiesFor(userNotInOrg, orgContext)
      // User is not in this organization, so should not have organizational management permissions
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)).toBe(
        false
      )
      // Note: User still has basic READ permissions for users (from base abilities)
      // but not specific organizational permissions
    })
  })

  describe('Cross-Organization Scenarios', () => {
    it('should grant permissions only for the specified organization context', () => {
      const userInMultipleOrgs: User = {
        id: userId,
        email: `user${userId}@test.com`,
        name: `User ${userId}`,
        emailVerified: false,
        image: null,
        role: RoleConst.USER,
        organizations: [
          {
            id: `member-${userId}-1`,
            organizationId,
            userId,
            role: UserOrganizationRoleConst.OWNER,
            createdAt: new Date(),
          },
          {
            id: `member-${userId}-2`,
            organizationId: otherOrganizationId,
            userId,
            role: UserOrganizationRoleConst.MEMBER,
            createdAt: new Date(),
          },
        ],
        visibility: 'public' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        banned: false,
        banReason: null,
        banExpires: null,
        twoFactorEnabled: false,
        stripeCustomerId: null,
      }

      // Contexte pour la première organisation (OWNER)
      const orgContext1 = {organizationId}
      const ability1 = defineAbilitiesFor(userInMultipleOrgs, orgContext1)
      expect(
        ability1.can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)
      ).toBe(true)

      // Contexte pour la deuxième organisation (MEMBER)
      const orgContext2 = {organizationId: otherOrganizationId}
      const ability2 = defineAbilitiesFor(userInMultipleOrgs, orgContext2)
      expect(
        ability2.can(ActionsConst.MANAGE, SubjectsConst.ORGANIZATION)
      ).toBe(false)
      expect(ability2.can(ActionsConst.READ, SubjectsConst.ORGANIZATION)).toBe(
        true
      )
    })
  })
})
