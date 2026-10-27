import {describe, expect, it} from 'vitest'

import {canAssignMemberRole} from '../authorization/member-role-authorization'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {userTest, userTestSuperAdmin} from './service-test-data'

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

describe('canAssignMemberRole (s14, member.role.assign)', () => {
  it('[GUEST] refuse un visiteur', () => {
    expect(canAssignMemberRole(undefined, ORG_ID)).toBe(false)
  })

  it('[SUPER_ADMIN] autorise le SuperAdmin', () => {
    expect(canAssignMemberRole(userTestSuperAdmin, ORG_ID)).toBe(true)
  })

  it.each([UserOrganizationRoleConst.OWNER, UserOrganizationRoleConst.ADMIN])(
    '[ORGANIZATION %s] autorise le bureau de l association',
    (role) => {
      expect(
        canAssignMemberRole(withMembership(userTest, ORG_ID, role), ORG_ID)
      ).toBe(true)
    }
  )

  it('[ORGANIZATION MEMBER] refuse un membre simple', () => {
    expect(
      canAssignMemberRole(
        withMembership(userTest, ORG_ID, UserOrganizationRoleConst.MEMBER),
        ORG_ID
      )
    ).toBe(false)
  })

  it('[USER NOT IN ORGANIZATION] refuse la présidence d une autre association (critère 5)', () => {
    expect(
      canAssignMemberRole(
        withMembership(userTest, OTHER_ORG_ID, UserOrganizationRoleConst.OWNER),
        ORG_ID
      )
    ).toBe(false)
  })
})
