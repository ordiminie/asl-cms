import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/campaign-repository', () => ({
  getCampaignTargetRowsDao: vi.fn(),
  getCampaignsByTemplateIdsDao: vi.fn(),
  getCampaignPartsDao: vi.fn(),
  getRecipientStatusCountsDao: vi.fn(),
  getAllottedRecipientsByDayDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-invitation-state-repository', () => ({
  getInvitationStatesByEmailsDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  getInvitationAddressesDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  isClientEmailEnabledService: vi.fn(),
}))
vi.mock('../campaign-service', () => ({
  createCampaignInTenant: vi.fn(),
  runImmediateCampaignPass: vi.fn(),
}))

import {
  getAllottedRecipientsByDayDao,
  getCampaignPartsDao,
  getCampaignsByTemplateIdsDao,
  getCampaignTargetRowsDao,
  getRecipientStatusCountsDao,
} from '@/db/repositories/campaign-repository'
import {getInvitationStatesByEmailsDao} from '@/db/repositories/member-invitation-state-repository'
import {getInvitationAddressesDao} from '@/db/repositories/member-profile-email-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'

import fr from '../../../messages/fr.json'
import {getAssociationSettingsService} from '../association-settings-service'
import {getActingContext} from '../authentication/auth-service'
import {
  type CampaignCreationInput,
  createCampaignInTenant,
  runImmediateCampaignPass,
} from '../campaign-service'
import {isClientEmailEnabledService} from '../email-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  getMemberInvitationsOverviewService,
  launchMemberInvitationsService,
  remindNeverSignedInService,
} from '../member-invitation-campaign-service'
import {launchSubmissionIdOf} from '../rules/member-invitation-campaign-rules'
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
const LAUNCH_ID = '33333333-3333-4333-8333-333333333333'
const REMINDER_ID = '44444444-4444-4444-8444-444444444444'
const SUBMISSION_ID = '55555555-5555-4555-8555-555555555555'
const ADMIN_ID = '66666666-6666-4666-8666-666666666666'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PROFILE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  name: 'Anne Martin',
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
const board = withRole(UserOrganizationRoleConst.ADMIN)

const row = (
  memberProfileId: string,
  name: string,
  email: string | null,
  overrides: Record<string, unknown> = {}
) => ({
  memberProfileId,
  name,
  email,
  unsubscribed: false,
  currentParcelNumbers: ['12'],
  accountName: null,
  homeAddressLine: null,
  homeAddressComplement: null,
  homePostalCode: null,
  homeCity: null,
  landAddressLine: null,
  landAddressComplement: null,
  landPostalCode: null,
  landCity: null,
  companyName: null,
  ...overrides,
})

const targetRows = () => [
  row(PROFILE_A, 'Claire Aubert', 'claire@example.fr'),
  row(PROFILE_A, 'Claire Aubert', 'proche@example.fr'),
  row(PROFILE_B, 'Paul Renaud', 'paul@example.fr'),
  row(PROFILE_C, 'Sans Email', null),
]

const campaignRow = (
  id: string,
  templateId: string,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  organizationId: ORG_ID,
  submissionId:
    templateId === 'member_invitation_launch'
      ? launchSubmissionIdOf(ORG_ID)
      : SUBMISSION_ID,
  subject: 'Votre espace membre vous attend',
  preheader: null,
  bodyMarkdown: 'Bonjour',
  letterText: null,
  templateId,
  nature: 'statutaire',
  targetKind: 'all_members',
  targetGroupId: null,
  targetGroupName: null,
  recipientCount: 3,
  withoutEmailCount: 1,
  unsubscribedCount: 0,
  sentCount: 3,
  status: 'sent',
  sendDate: '2026-11-24',
  authorUserId: userTest.id,
  authorName: 'Anne Martin',
  onBehalfOfUserId: null,
  onBehalfOfName: null,
  createdAt: new Date('2026-11-24T08:00:00.000Z'),
  updatedAt: new Date('2026-11-24T08:00:00.000Z'),
  finishedAt: null,
  ...overrides,
})

const part = (campaignId: string, status: string) => ({
  id: `part-${campaignId}`,
  campaignId,
  number: 1,
  scheduledFor: '2026-11-24',
  recipientCount: 3,
  status,
  deferredTo: null,
})

const settingsWith = (rows: {key: string; value: string}[] = []) =>
  resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)

const createdInput = (): CampaignCreationInput =>
  vi.mocked(createCampaignInTenant).mock.calls[0][0]

beforeEach(async () => {
  vi.clearAllMocks()
  await setupAuthUserMocked(board)
  vi.mocked(getActingContext).mockResolvedValue(undefined)
  vi.mocked(isClientEmailEnabledService).mockResolvedValue(true)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'Clos-Fleuri',
    domain: 'clos-fleuri.test',
  } as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settingsWith())
  vi.mocked(getCampaignTargetRowsDao).mockResolvedValue(targetRows() as never)
  vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([])
  vi.mocked(getCampaignPartsDao).mockResolvedValue([])
  vi.mocked(getRecipientStatusCountsDao).mockResolvedValue([])
  vi.mocked(getAllottedRecipientsByDayDao).mockResolvedValue({})
  vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([])
  vi.mocked(getInvitationAddressesDao).mockResolvedValue([])
  vi.mocked(createCampaignInTenant).mockResolvedValue({
    status: 'created',
    campaignId: LAUNCH_ID,
    created: true,
  })
})

const launch = () => launchMemberInvitationsService({organizationId: ORG_ID})
const remind = () =>
  remindNeverSignedInService({
    organizationId: ORG_ID,
    submissionId: SUBMISSION_ID,
  })
const overview = () =>
  getMemberInvitationsOverviewService({organizationId: ORG_ID, page: 1})

describe('autorisation — campaign.manage (Q9)', () => {
  it.each([
    ['[PUBLIC]', undefined],
    ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
    [
      '[BUREAU D’UNE AUTRE ASSOCIATION]',
      withRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID),
    ],
  ])('%s ne lance, ne relance ni ne lit rien', async (_label, user) => {
    await setupAuthUserMocked(user)

    await expect(launch()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(remind()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(overview()).rejects.toBeInstanceOf(AuthorizationError)
    expect(createCampaignInTenant).not.toHaveBeenCalled()
    expect(getCampaignTargetRowsDao).not.toHaveBeenCalled()
  })

  it.each([
    ['[ORGANIZATION BOARD]', board],
    ['[ORGANIZATION OWNER]', withRole(UserOrganizationRoleConst.OWNER)],
    ['[SUPER_ADMIN]', {...userTestSuperAdmin, name: 'Anne Martin'}],
  ])('%s lance les invitations', async (_label, user) => {
    await setupAuthUserMocked(user)

    await expect(launch()).resolves.toMatchObject({status: 'created'})
  })

  it('pendant une imitation, l’auteur est le SuperAdmin, au nom du compte vu (s48)', async () => {
    vi.mocked(getActingContext).mockResolvedValue({
      user: board,
      impersonator: {id: ADMIN_ID, name: 'Zourite Studio'},
    })

    await launch()

    expect(createdInput().content).toMatchObject({
      authorUserId: ADMIN_ID,
      authorName: 'Zourite Studio',
      onBehalfOfUserId: board.id,
      onBehalfOfName: 'Anne Martin',
    })
  })

  it('refuse une association qui n’est pas un identifiant, avant toute lecture', async () => {
    await expect(
      launchMemberInvitationsService({organizationId: 'pas-un-uuid'})
    ).rejects.toThrow()
    expect(getOrganizationByIdDao).not.toHaveBeenCalled()
  })
})

describe('launchMemberInvitationsService — refus métier, avant toute création', () => {
  it('envois aux membres coupés : delivery_disabled', async () => {
    vi.mocked(isClientEmailEnabledService).mockResolvedValue(false)

    await expect(launch()).resolves.toEqual({status: 'delivery_disabled'})
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })

  it('association sans domaine : no_site_address, aucun lien ne pouvant naître', async () => {
    vi.mocked(getOrganizationByIdDao).mockResolvedValue({
      id: ORG_ID,
      name: 'Clos-Fleuri',
      domain: null,
    } as never)

    await expect(launch()).resolves.toEqual({status: 'no_site_address'})
    await expect(remind()).resolves.toEqual({status: 'no_site_address'})
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })

  it('lecture impossible : l’erreur remonte, jamais un zéro trompeur', async () => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockRejectedValue(
      new Error('base injoignable')
    )

    await expect(launch()).rejects.toThrow('base injoignable')
    await expect(overview()).rejects.toThrow('base injoignable')
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })
})

describe('launchMemberInvitationsService — un lancement par association (Q7)', () => {
  it('second lancement : already_launched avec sa date, son auteur et son id, rien ne repart', async () => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([
      campaignRow(LAUNCH_ID, 'member_invitation_launch'),
    ] as never)

    await expect(launch()).resolves.toEqual({
      status: 'already_launched',
      campaignId: LAUNCH_ID,
      sendDate: '2026-11-24',
      authorName: 'Anne Martin',
    })
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })

  it('la soumission est déterministe : uuid v5 de l’association et du type', () => {
    expect(launchSubmissionIdOf(ORG_ID)).toBe(launchSubmissionIdOf(ORG_ID))
    expect(launchSubmissionIdOf(ORG_ID)).not.toBe(
      launchSubmissionIdOf(OTHER_ORG_ID)
    )
    expect(launchSubmissionIdOf(ORG_ID)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})

describe('launchMemberInvitationsService — contenu figé (ADR 072 §6)', () => {
  it('texte de l’invitation dans bodyMarkdown, texte du courrier dans letterText, objet sans nom', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith([
        {key: 'invitation.text', value: 'Bienvenue {nom} sur **le site**.'},
        {key: 'invitation.letter_text', value: 'Le site est en ligne.'},
        {key: 'campaign.daily_send_cap', value: '40'},
      ])
    )

    const result = await launch()

    expect(result).toMatchObject({status: 'created', campaignId: LAUNCH_ID})
    const input = createdInput()
    expect(input.organizationId).toBe(ORG_ID)
    expect(input.dailySendCap).toBe(40)
    expect(input.acceptsLettersOnly).toBe(true)
    expect(input.content).toMatchObject({
      submissionId: launchSubmissionIdOf(ORG_ID),
      subject: 'Votre espace membre vous attend',
      preheader: fr.email.campaign.memberInvitation.preheader,
      bodyMarkdown: 'Bienvenue {nom} sur **le site**.',
      letterText: 'Le site est en ligne.',
      templateId: 'member_invitation_launch',
      targetKind: 'all_members',
      authorName: 'Anne Martin',
    })
    expect(input.content.subject).not.toContain('Clos-Fleuri')
  })

  it('sans réglages : les textes par défaut, figés à la création', async () => {
    await launch()

    expect(createdInput().content).toMatchObject({
      bodyMarkdown: fr.email.user.invitation.defaultText,
      letterText: fr.CampaignsBureau.letters.pdf.memberInvitation.defaultText,
    })
  })

  it('la cible : toutes les fiches, sous la nature du lancement (statutaire au seed)', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith([
        {key: 'campaign.nature.member_invitation_launch', value: 'statutaire'},
      ])
    )
    await launch()

    const reading = await createdInput().readTarget()
    expect(reading.nature).toBe('statutaire')
    expect(reading.group).toBeNull()
    expect(reading.target.recipients.map((r) => r.email)).toEqual([
      'claire@example.fr',
      'proche@example.fr',
      'paul@example.fr',
    ])
    expect(reading.target.withoutEmailProfileIds).toEqual([PROFILE_C])
  })

  it('la livraison immédiate est rendue à l’action, à poser dans after()', async () => {
    const result = await launch()
    if (result.status !== 'created' || !result.deliver) {
      throw new Error('livraison attendue')
    }

    expect(runImmediateCampaignPass).not.toHaveBeenCalled()
    await result.deliver()
    expect(runImmediateCampaignPass).toHaveBeenCalledWith(ORG_ID)
  })

  it('aucune fiche : nobody', async () => {
    vi.mocked(createCampaignInTenant).mockResolvedValue({
      status: 'no_recipient',
    })

    await expect(launch()).resolves.toEqual({status: 'nobody'})
  })
})

describe('remindNeverSignedInService — relancer les jamais connectés (C8, Q10)', () => {
  const launched = (status = 'sent') => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([
      campaignRow(LAUNCH_ID, 'member_invitation_launch', {
        status: status === 'sent' ? 'sent' : 'sending',
      }),
    ] as never)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      part(LAUNCH_ID, status),
    ] as never)
  }

  it('avant le lancement : not_launched', async () => {
    await expect(remind()).resolves.toEqual({status: 'not_launched'})
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })

  it.each(['scheduled', 'sending'])(
    'une part du lancement %s : in_progress, rien n’est créé',
    async (status) => {
      launched(status)

      await expect(remind()).resolves.toEqual({status: 'in_progress'})
      expect(createCampaignInTenant).not.toHaveBeenCalled()
    }
  )

  it('une relance encore en cours : in_progress', async () => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([
      campaignRow(LAUNCH_ID, 'member_invitation_launch'),
      campaignRow(REMINDER_ID, 'member_invitation_reminder', {
        submissionId: '77777777-7777-4777-8777-777777777777',
        status: 'sending',
      }),
    ] as never)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      part(LAUNCH_ID, 'sent'),
      part(REMINDER_ID, 'scheduled'),
    ] as never)

    await expect(remind()).resolves.toEqual({status: 'in_progress'})
  })

  it('crée la relance : même contenu figé, type propre, sans courrier, cible des jamais connectées', async () => {
    launched()
    vi.mocked(createCampaignInTenant).mockResolvedValue({
      status: 'created',
      campaignId: REMINDER_ID,
      created: true,
    })
    vi.mocked(getInvitationStatesByEmailsDao).mockResolvedValue([
      {
        email: 'claire@example.fr',
        userId: 'u-claire',
        lastInvitedAt: new Date('2026-11-24T09:00:00.000Z'),
        firstSignedInAt: new Date('2026-11-24T10:00:00.000Z'),
      },
    ])

    await expect(remind()).resolves.toMatchObject({
      status: 'created',
      campaignId: REMINDER_ID,
    })
    const input = createdInput()
    expect(input.acceptsLettersOnly).toBeFalsy()
    expect(input.content).toMatchObject({
      submissionId: SUBMISSION_ID,
      subject: 'Votre espace membre vous attend',
      bodyMarkdown: fr.email.user.invitation.defaultText,
      templateId: 'member_invitation_reminder',
    })
    expect(input.content.letterText ?? null).toBeNull()
    const reading = await input.readTarget()
    expect(reading.target.recipients.map((r) => r.email)).toEqual([
      'proche@example.fr',
      'paul@example.fr',
    ])
    expect(reading.target.withoutEmailProfileIds).toEqual([])
  })

  it('personne à relancer : nobody', async () => {
    launched()
    vi.mocked(createCampaignInTenant).mockResolvedValue({
      status: 'no_recipient',
    })

    await expect(remind()).resolves.toEqual({status: 'nobody'})
  })

  it('soumission rejouée : la relance existante, aucune livraison relancée', async () => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([
      campaignRow(LAUNCH_ID, 'member_invitation_launch'),
      campaignRow(REMINDER_ID, 'member_invitation_reminder', {
        status: 'sending',
      }),
    ] as never)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      part(LAUNCH_ID, 'sent'),
      part(REMINDER_ID, 'sending'),
    ] as never)

    await expect(remind()).resolves.toEqual({
      status: 'created',
      campaignId: REMINDER_ID,
      deliver: null,
    })
    expect(createCampaignInTenant).not.toHaveBeenCalled()
  })

  it('envois coupés : delivery_disabled', async () => {
    launched()
    vi.mocked(isClientEmailEnabledService).mockResolvedValue(false)

    await expect(remind()).resolves.toEqual({status: 'delivery_disabled'})
  })
})

describe('getMemberInvitationsOverviewService — la page (écrans 1 et 2)', () => {
  it('avant le lancement : pas de lancement, les décomptes, le plan, le suivi', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith([{key: 'campaign.daily_send_cap', value: '2'}])
    )

    const page = await overview()

    expect(page.launch).toBeNull()
    expect(page.reminders).toEqual([])
    expect(page.launchCounts).toMatchObject({
      profilesWithEmail: 2,
      profilesByLetter: 1,
      recipients: 3,
    })
    expect(page.plan.dailySendCap).toBe(2)
    expect(page.plan.parts.map((p) => p.count)).toEqual([2, 1])
    expect(page.linkDays).toBe(7)
    expect(page.overview.neverSignedIn).toBe(0)
  })

  it('après le lancement : le lancement et les relances, en cours ou non', async () => {
    vi.mocked(getCampaignsByTemplateIdsDao).mockResolvedValue([
      campaignRow(LAUNCH_ID, 'member_invitation_launch', {status: 'sending'}),
    ] as never)
    vi.mocked(getCampaignPartsDao).mockResolvedValue([
      part(LAUNCH_ID, 'scheduled'),
    ] as never)

    const page = await overview()

    expect(page.launch).toMatchObject({
      campaign: {id: LAUNCH_ID, templateId: 'member_invitation_launch'},
      inProgress: true,
    })
    expect(JSON.stringify(page)).not.toContain('submissionId')
  })

  it('les traces sont lues par adresse, sous l’association demandée', async () => {
    vi.mocked(getInvitationAddressesDao).mockResolvedValue([
      {
        email: 'claire@example.fr',
        status: 'active',
        createdAt: new Date('2026-11-20T08:00:00.000Z'),
        expiresAt: null,
        memberProfileId: PROFILE_A,
        name: 'Claire Aubert',
        parcelNumbers: ['12'],
      },
    ])

    const page = await overview()

    expect(getInvitationStatesByEmailsDao).toHaveBeenCalledWith(
      ORG_ID,
      expect.arrayContaining(['claire@example.fr'])
    )
    expect(page.overview).toMatchObject({neverSignedIn: 1, invited: 0})
  })
})
