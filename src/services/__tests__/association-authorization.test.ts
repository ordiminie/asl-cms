import {describe, expect, it} from 'vitest'

import {canManageAssociation} from '../authorization/association-authorization'
import {RoleConst, UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'

const withMembership = (
  user: User,
  organizationId: string,
  role: OrganizationRole
): User => ({
  ...user,
  organizations: [
    {
      id: `${organizationId}-${role}`,
      organizationId,
      userId: user.id,
      role,
      createdAt: new Date(),
    },
  ],
})

describe('canManageAssociation — acces accordes', () => {
  it('[SUPER_ADMIN] accede sans appartenir a l association', () => {
    expect(canManageAssociation(userTestSuperAdmin, ORG_ID)).toBe(true)
  })

  it('[ORGANIZATION OWNER] la presidente de l association accede', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.OWNER
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(true)
  })

  it('[ORGANIZATION ADMIN] le bureau de l association accede', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.ADMIN
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(true)
  })
})

describe('canManageAssociation — refus', () => {
  it('[PUBLIC] refuse un visiteur non connecte', () => {
    expect(canManageAssociation(undefined, ORG_ID)).toBe(false)
  })

  it('[ORGANIZATION MEMBER] refuse un simple membre', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.MEMBER
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(false)
  })

  it('[USER NOT IN ORGANIZATION] refuse un utilisateur sans appartenance', () => {
    expect(canManageAssociation(userTest, ORG_ID)).toBe(false)
  })

  it('[OTHER ORGANIZATION OWNER] refuse la presidente d une autre association', () => {
    const user = withMembership(
      userTest,
      OTHER_ORG_ID,
      UserOrganizationRoleConst.OWNER
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(false)
  })

  it('[OTHER ORGANIZATION ADMIN] refuse le bureau d une autre association', () => {
    const user = withMembership(
      userTest,
      OTHER_ORG_ID,
      UserOrganizationRoleConst.ADMIN
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(false)
  })

  it('[ADMIN] refuse l administrateur global sans role dans l association', () => {
    expect(userTestAdmin.role).toBe(RoleConst.ADMIN)
    expect(canManageAssociation(userTestAdmin, ORG_ID)).toBe(false)
  })

  it('[ADMIN + MEMBER] refuse l administrateur global simple membre', () => {
    const user = withMembership(
      userTestAdmin,
      ORG_ID,
      UserOrganizationRoleConst.MEMBER
    )

    expect(canManageAssociation(user, ORG_ID)).toBe(false)
  })
})
