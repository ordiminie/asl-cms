import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/email-send-budget-repository', () => ({
  getSendBudgetDao: vi.fn(),
}))
vi.mock('@/db/repositories/deferred-email-repository', () => ({
  listPendingDeferredEmailsDao: vi.fn(),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getOpenCampaignPartsDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))

import {getOpenCampaignPartsDao} from '@/db/repositories/campaign-repository'
import {listPendingDeferredEmailsDao} from '@/db/repositories/deferred-email-repository'
import {getSendBudgetDao} from '@/db/repositories/email-send-budget-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAssociationSettingsService} from '../association-settings-service'
import {getEmailSendingOverviewService} from '../email-sending-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const REPORT_ID = '44444444-4444-4444-8444-444444444444'
const NOW = new Date('2026-11-14T15:00:00.000Z')

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

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
  )
  vi.mocked(getSendBudgetDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return {reportableCount: 200, loginCount: 22}
  })
  vi.mocked(listPendingDeferredEmailsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [
      {
        id: 'd1',
        nature: 'board_notification',
        referenceType: 'incident_report',
        referenceId: REPORT_ID,
        sendOn: '2026-11-15',
        status: 'pending',
      },
      {
        id: 'd2',
        nature: 'board_notification',
        referenceType: 'incident_report',
        referenceId: REPORT_ID,
        sendOn: '2026-11-15',
        status: 'pending',
      },
    ]
  })
  vi.mocked(getOpenCampaignPartsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [
      {
        partId: 'p2',
        campaignId: CAMPAIGN_ID,
        campaignSubject: 'Convocation à l’assemblée générale',
        number: 2,
        partCount: 3,
        scheduledFor: '2026-11-14',
        status: 'sending',
        deferredTo: '2026-11-15',
        pendingCount: 40,
      },
      {
        partId: 'p3',
        campaignId: CAMPAIGN_ID,
        campaignSubject: 'Convocation à l’assemblée générale',
        number: 3,
        partCount: 3,
        scheduledFor: '2026-11-15',
        status: 'scheduled',
        deferredTo: null,
        pendingCount: 96,
      },
    ]
  })
})

describe('getEmailSendingOverviewService — envois d’emails du bureau (s52, écran 1)', () => {
  it('[ORGANIZATION ADMIN] le bureau lit les compteurs du jour et les envois en attente, regroupés', async () => {
    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(getSendBudgetDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      day: '2026-11-14',
    })
    expect(overview).toEqual({
      day: '2026-11-14',
      limit: 300,
      reserve: 100,
      sentToday: 222,
      loginSentToday: 22,
      remainingReportable: 0,
      limitReached: true,
      reserveExhausted: false,
      pendingRecipientTotal: 42,
      nextSendOn: '2026-11-15',
      pending: [
        {
          key: `campaign:${CAMPAIGN_ID}:2`,
          nature: 'campaign',
          reference: {type: 'campaign', id: CAMPAIGN_ID},
          campaignSubject: 'Convocation à l’assemblée générale',
          partNumber: 2,
          partCount: 3,
          recipientCount: 40,
          sendOn: '2026-11-15',
          state: 'scheduled',
        },
        {
          key: `incident_report:${REPORT_ID}:2026-11-15`,
          nature: 'board_notification',
          reference: {type: 'incident_report', id: REPORT_ID},
          campaignSubject: null,
          partNumber: null,
          partCount: null,
          recipientCount: 2,
          sendOn: '2026-11-15',
          state: 'scheduled',
        },
      ],
    })
  })

  it('une part programmée normalement n’est pas « en attente » : seul un report l’est', async () => {
    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(overview.pending.map((group) => group.partNumber)).not.toContain(3)
  })

  it('le DTO ne porte ni adresse ni contenu (critère 7)', async () => {
    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(JSON.stringify(overview)).not.toMatch(
      /@|"subject"|"textBody"|"htmlBody"|"recipient"|"headers"/
    )
  })

  it('limite et réserve atteintes ensemble : la réserve de connexion est épuisée', async () => {
    vi.mocked(getSendBudgetDao).mockResolvedValue({
      reportableCount: 200,
      loginCount: 100,
    })

    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(overview).toMatchObject({
      sentToday: 300,
      reserveExhausted: true,
      remainingReportable: 0,
    })
  })

  it('un envoi en échec est montré « en échec », hors du total en attente et de la date du prochain envoi (revue n° 2)', async () => {
    vi.mocked(getOpenCampaignPartsDao).mockResolvedValue([])
    vi.mocked(listPendingDeferredEmailsDao).mockResolvedValue([
      {
        id: 'd1',
        nature: 'board_notification',
        referenceType: 'incident_report',
        referenceId: REPORT_ID,
        sendOn: '2026-11-13',
        status: 'failed',
      },
    ])

    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(overview.pending).toEqual([
      expect.objectContaining({state: 'failed', recipientCount: 1}),
    ])
    expect(overview).toMatchObject({
      pendingRecipientTotal: 0,
      nextSendOn: null,
    })
  })

  it('rien en attente : aucune ligne, aucune date', async () => {
    vi.mocked(listPendingDeferredEmailsDao).mockResolvedValue([])
    vi.mocked(getOpenCampaignPartsDao).mockResolvedValue([])
    vi.mocked(getSendBudgetDao).mockResolvedValue({
      reportableCount: 78,
      loginCount: 9,
    })

    const overview = await getEmailSendingOverviewService(ORG_ID, NOW)

    expect(overview).toMatchObject({
      sentToday: 87,
      remainingReportable: 122,
      limitReached: false,
      pending: [],
      pendingRecipientTotal: 0,
      nextSendOn: null,
    })
  })

  it.each<[string, User]>([
    ['[ORGANIZATION OWNER] la présidente', withRole('owner')],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])('%s lit aussi', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(
      getEmailSendingOverviewService(ORG_ID, NOW)
    ).resolves.toMatchObject({limit: 300})
  })

  it.each<[string, User | undefined]>([
    ['[PUBLIC]', undefined],
    ['[ORGANIZATION MEMBER]', withRole('member')],
    [
      '[OTHER ORGANIZATION ADMIN]',
      withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID),
    ],
    ['[USER NOT IN ORGANIZATION]', userTest],
  ])('%s est refusé, sans aucune lecture', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(getEmailSendingOverviewService(ORG_ID, NOW)).rejects.toThrow(
      AuthorizationError
    )
    expect(withTenant).not.toHaveBeenCalled()
    expect(getSendBudgetDao).not.toHaveBeenCalled()
  })

  it('refuse un identifiant d’association invalide', async () => {
    await expect(
      getEmailSendingOverviewService('pas-un-uuid', NOW)
    ).rejects.toThrow()
    expect(getSendBudgetDao).not.toHaveBeenCalled()
  })
})
