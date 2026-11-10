import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-unsubscribe-repository', () => ({
  getRecipientByTokenDao: vi.fn(),
  getUnsubscribeByMemberDao: vi.fn(),
  createUnsubscribeIfAbsentTxnDao: vi.fn(),
}))

import {
  createUnsubscribeIfAbsentTxnDao,
  getRecipientByTokenDao,
  getUnsubscribeByMemberDao,
} from '@/db/repositories/member-unsubscribe-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'

import {getAuthUser} from '../authentication/auth-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {
  confirmUnsubscribeService,
  getMemberUnsubscribeService,
  getUnsubscribePageStateService,
} from '../unsubscribe-service'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')

const recipient = (overrides: Record<string, unknown> = {}) => ({
  recipientId: 'r1',
  organizationId: ORG_ID,
  campaignId: CAMPAIGN_ID,
  memberProfileId: PROFILE_ID as string | null,
  unsubscribedAt: null as Date | null,
  ...overrides,
})

const input = {organizationId: ORG_ID, token: TOKEN}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRecipientByTokenDao).mockResolvedValue(recipient())
  vi.mocked(createUnsubscribeIfAbsentTxnDao).mockResolvedValue({
    memberProfileId: PROFILE_ID,
  })
})

describe('[PUBLIC] getUnsubscribePageStateService — lecture seule (GET)', () => {
  it('jeton valide, pas encore désinscrit → confirm, sans rien écrire', async () => {
    await expect(getUnsubscribePageStateService(input)).resolves.toEqual({
      status: 'confirm',
    })
    expect(createUnsubscribeIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('déjà désinscrit → already', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(
      recipient({unsubscribedAt: new Date()})
    )

    await expect(getUnsubscribePageStateService(input)).resolves.toEqual({
      status: 'already',
    })
  })

  it('jeton inconnu (ou d’une autre association, invisible sous la RLS) → invalid', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(undefined)

    await expect(getUnsubscribePageStateService(input)).resolves.toEqual({
      status: 'invalid',
    })
  })

  it('jeton hors forme → invalid, sans requête', async () => {
    await expect(
      getUnsubscribePageStateService({...input, token: 'court'})
    ).resolves.toEqual({status: 'invalid'})
    expect(getRecipientByTokenDao).not.toHaveBeenCalled()
  })

  it('fiche supprimée depuis → invalid', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(
      recipient({memberProfileId: null})
    )

    await expect(getUnsubscribePageStateService(input)).resolves.toEqual({
      status: 'invalid',
    })
  })

  it('ligne d’une autre association → invalid', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(
      recipient({organizationId: OTHER_ORG_ID})
    )

    await expect(getUnsubscribePageStateService(input)).resolves.toEqual({
      status: 'invalid',
    })
  })

  it('association hors forme → erreur de validation', async () => {
    await expect(
      getUnsubscribePageStateService({...input, organizationId: 'x'})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
  })
})

describe('[PUBLIC] confirmUnsubscribeService — l’écriture (POST)', () => {
  it('enregistre le refus de la fiche, porté par la fiche, sans session', async () => {
    await expect(confirmUnsubscribeService(input)).resolves.toEqual({
      status: 'unsubscribed',
    })
    expect(createUnsubscribeIfAbsentTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      campaignId: CAMPAIGN_ID,
    })
    expect(getAuthUser).not.toHaveBeenCalled()
  })

  it('confirmation répétée → already, aucune seconde ligne', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(
      recipient({unsubscribedAt: new Date()})
    )

    await expect(confirmUnsubscribeService(input)).resolves.toEqual({
      status: 'already',
    })
    expect(createUnsubscribeIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('course entre deux confirmations : l’insertion ne rend rien → already', async () => {
    vi.mocked(createUnsubscribeIfAbsentTxnDao).mockResolvedValue(undefined)

    await expect(confirmUnsubscribeService(input)).resolves.toEqual({
      status: 'already',
    })
  })

  it('jeton inconnu → invalid, rien n’est écrit', async () => {
    vi.mocked(getRecipientByTokenDao).mockResolvedValue(undefined)

    await expect(confirmUnsubscribeService(input)).resolves.toEqual({
      status: 'invalid',
    })
    expect(createUnsubscribeIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('n’écrit ni jeton ni identifiant de fiche dans un journal', async () => {
    await confirmUnsubscribeService(input)

    const logged = JSON.stringify(
      Object.values(logger).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain(TOKEN)
    expect(logged).not.toContain(PROFILE_ID)
  })
})

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

describe('getMemberUnsubscribeService — mention sur la fiche (écran 5)', () => {
  const input = {organizationId: ORG_ID, memberProfileId: PROFILE_ID}

  it('[ORGANIZATION BOARD] lit le refus de la fiche, daté', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
    vi.mocked(getUnsubscribeByMemberDao).mockResolvedValue({
      createdAt: new Date('2026-11-12T13:32:00.000Z'),
    })

    await expect(getMemberUnsubscribeService(input)).resolves.toEqual({
      createdAt: '2026-11-12T13:32:00.000Z',
    })
    expect(getUnsubscribeByMemberDao).toHaveBeenCalledWith(PROFILE_ID)
    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
  })

  it('aucun refus → null', async () => {
    await setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
    vi.mocked(getUnsubscribeByMemberDao).mockResolvedValue(undefined)

    await expect(getMemberUnsubscribeService(input)).resolves.toBeNull()
  })

  it.each([
    ['[GUEST]', undefined],
    ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
    [
      '[USER NOT IN ORGANIZATION]',
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
    ],
  ])('%s refusé sans appel au DAO', async (_label, user) => {
    await setupAuthUserMocked(user)

    await expect(getMemberUnsubscribeService(input)).rejects.toBeInstanceOf(
      AuthorizationError
    )
    expect(getUnsubscribeByMemberDao).not.toHaveBeenCalled()
  })
})
