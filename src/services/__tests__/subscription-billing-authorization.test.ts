import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/subscription-repository', () => ({}))
vi.mock('../organization-service', () => ({
  getUserOrganizationsService: vi.fn(),
}))

import {BILLING_MODE} from '@/lib/helper/subscription-helper'

import {getUserOrganizationsService} from '../organization-service'
import {canManageSubscription} from '../subscription-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {BillingModes} from '../types/domain/subscription-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const membership = (role: string) => [
  {
    id: 'membership',
    organizationId: ORG_ID,
    userId: userTest.id,
    role,
    createdAt: new Date(),
  },
]

/**
 * Abonnement plateforme Stripe en mode organisation : qui, dans une
 * association, peut le gerer. Le controle lit le role d'association, renomme
 * `board` par s03b — sans ce test, le renommage casserait ce chemin en silence.
 */
describe('canManageSubscription — mode organisation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAuthUserMocked(userTest)
  })

  it('le mode de facturation des tests est bien le mode organisation', () => {
    expect(BILLING_MODE).toBe(BillingModes.ORGANIZATION)
  })

  it.each([
    ['[ORGANIZATION BOARD] le bureau', UserOrganizationRoleConst.ADMIN, true],
    [
      '[ORGANIZATION OWNER] la presidente',
      UserOrganizationRoleConst.OWNER,
      true,
    ],
    [
      '[ORGANIZATION MEMBER] un simple membre',
      UserOrganizationRoleConst.MEMBER,
      false,
    ],
  ])('%s', async (_label, role, expected) => {
    vi.mocked(getUserOrganizationsService).mockResolvedValue(
      membership(role) as never
    )

    await expect(canManageSubscription(ORG_ID)).resolves.toBe(expected)
  })

  it('le role du bureau vaut bien board', () => {
    expect(UserOrganizationRoleConst.ADMIN).toBe('board')
  })

  it("refuse un membre d'une autre association", async () => {
    vi.mocked(getUserOrganizationsService).mockResolvedValue([] as never)

    await expect(canManageSubscription(ORG_ID)).resolves.toBe(false)
  })
})
