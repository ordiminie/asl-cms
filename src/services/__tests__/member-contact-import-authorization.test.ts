import {beforeEach, describe, expect, it, vi} from 'vitest'

import {canImportMemberContacts} from '../authorization/member-contact-import-authorization'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: `${organizationId}-${role}`,
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('canImportMemberContacts (s56)', () => {
  it('[ORGANIZATION OWNER] autorise la presidente', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
    await expect(canImportMemberContacts(ORG_ID)).resolves.toBe(true)
  })

  it('[SUPER_ADMIN] autorise le SuperAdmin', async () => {
    setupAuthUserMocked(userTestSuperAdmin)
    await expect(canImportMemberContacts(ORG_ID)).resolves.toBe(true)
  })

  it('[ORGANIZATION BOARD] refuse le bureau', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
    await expect(canImportMemberContacts(ORG_ID)).resolves.toBe(false)
  })

  it('[PUBLIC] refuse un visiteur', async () => {
    setupAuthUserMocked(undefined)
    await expect(canImportMemberContacts(ORG_ID)).resolves.toBe(false)
  })
})
