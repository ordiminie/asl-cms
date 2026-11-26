import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/db/repositories/member-invitation-state-repository', () => ({
  markFirstSignInTxnDao: vi.fn(),
  markInvitedTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getLinkedAccountsDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  getMemberProfileEmailsDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('@/services/association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('@/services/email-service', () => ({
  sendInvitationEmailService: vi.fn(),
}))
vi.mock('@/lib/better-auth/invitation-link', () => ({
  issueInvitationLink: vi.fn(),
}))

import {
  markFirstSignInTxnDao,
  markInvitedTxnDao,
} from '@/db/repositories/member-invitation-state-repository'
import {getMemberProfileEmailsDao} from '@/db/repositories/member-profile-email-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
} from '@/db/repositories/member-profile-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {withTenant} from '@/db/tenant-scope'
import {issueInvitationLink} from '@/lib/better-auth/invitation-link'
import {EmailTransportError} from '@/lib/emails/transport/email-transport'
import {getAssociationSettingsService} from '@/services/association-settings-service'
import {sendInvitationEmailService} from '@/services/email-service'

import {AuthorizationError} from '../errors/authorization-error'
import {NotFoundError} from '../errors/not-found-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  inviteMemberProfileService,
  recordFirstSignIn,
} from '../member-invitation-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '../types/domain/association-settings-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '99999999-9999-4999-8999-999999999999'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const USER_JEAN = '22222222-2222-4222-8222-222222222222'
const USER_CLAIRE = '44444444-4444-4444-8444-444444444444'
const AT = new Date('2026-11-26T18:40:00.000Z')

const withRole = (role: OrganizationRole, organizationId = ORG_A): User => ({
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

const emailRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'email-jean',
  organizationId: ORG_A,
  memberProfileId: PROFILE_ID,
  email: 'Jean.Dubois@exemple.test',
  role: 'holder' as const,
  status: 'active' as const,
  origin: 'site' as const,
  addedByUserId: null,
  addedByName: null,
  replacesEmailId: null,
  confirmationTokenHash: null,
  expiresAt: null,
  unsubscribedAt: null,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  updatedAt: new Date('2026-09-01T08:00:00Z'),
  ...overrides,
})

const ASSOCIATION = {
  id: ORG_A,
  name: 'Clos-Fleuri',
  domain: 'clos-fleuri.test',
  identityLogoKey: 'organizations/org-a/identity/logo-42.png',
}

const linkOf = (email: string) => ({
  url: `http://clos-fleuri.test:3000/api/auth/magic-link/verify?token=${email}`,
  token: `jeton-${email}`,
})

const givenProfileWith = (emails: ReturnType<typeof emailRow>[]) => {
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue({
    id: PROFILE_ID,
    name: 'Jean Dubois',
  } as never)
  vi.mocked(getMemberProfileEmailsDao).mockResolvedValue(emails as never)
}

const TWO_ACTIVE = () => [
  emailRow(),
  emailRow({
    id: 'email-claire',
    email: 'claire.dubois@exemple.test',
    role: 'additional',
  }),
]

const invite = () =>
  inviteMemberProfileService({
    organizationId: ORG_A,
    memberProfileId: PROFILE_ID,
  })

beforeEach(async () => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
  await setupAuthUserMocked(withRole('board'))
  givenProfileWith(TWO_ACTIVE())
  vi.mocked(getLinkedAccountsDao).mockResolvedValue([
    {userId: USER_CLAIRE, email: 'claire.dubois@exemple.test', name: 'Claire'},
    {userId: USER_JEAN, email: 'jean.dubois@exemple.test', name: 'Jean'},
  ])
  vi.mocked(getOrganizationByIdDao).mockResolvedValue(ASSOCIATION as never)
  vi.mocked(getAssociationSettingsService).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: 'invitation.link_days', value: '10'},
      {key: 'invitation.text', value: 'Bienvenue sur le site.'},
    ])
  )
  vi.mocked(issueInvitationLink).mockImplementation(async ({email}) =>
    linkOf(email)
  )
  vi.mocked(sendInvitationEmailService).mockResolvedValue({status: 'sent'})
})

describe('inviteMemberProfileService — autorisation (s42a)', () => {
  it('[INVITÉ] refuse sans session, rien n’est lu ni envoyé', async () => {
    await setupAuthUserMocked(undefined)

    await expect(invite()).rejects.toThrow(AuthorizationError)
    expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
    expect(sendInvitationEmailService).not.toHaveBeenCalled()
  })

  it('[MEMBRE] refuse un simple membre de l’association', async () => {
    await setupAuthUserMocked(withRole('member'))

    await expect(invite()).rejects.toThrow(AuthorizationError)
    expect(issueInvitationLink).not.toHaveBeenCalled()
  })

  it('[BUREAU d’une autre association] refuse', async () => {
    await setupAuthUserMocked(withRole('board', ORG_B))

    await expect(invite()).rejects.toThrow(AuthorizationError)
  })

  it.each([
    ['[BUREAU]', () => withRole('board')],
    ['[PRÉSIDENCE]', () => withRole('owner')],
    ['[SUPER_ADMIN]', () => userTestSuperAdmin as User],
  ])('%s invite', async (_, user) => {
    await setupAuthUserMocked(user())

    expect(await invite()).toMatchObject({status: 'sent'})
  })

  it('refuse des identifiants invalides', async () => {
    await expect(
      inviteMemberProfileService({organizationId: 'x', memberProfileId: 'y'})
    ).rejects.toThrow(ValidationParsedZodError)
  })
})

describe('inviteMemberProfileService — envoi (s42a)', () => {
  it('fiche introuvable sous le tenant : NotFoundError, lue sous l’association', async () => {
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_A)
      return undefined
    })

    await expect(invite()).rejects.toThrow(NotFoundError)
    expect(sendInvitationEmailService).not.toHaveBeenCalled()
  })

  it('aucune adresse active : refus « courrier uniquement », lisible, sans envoi', async () => {
    givenProfileWith([])

    expect(await invite()).toEqual({status: 'mail_only'})
    expect(issueInvitationLink).not.toHaveBeenCalled()
  })

  it('deux adresses actives : deux liens distincts, dans l’ordre de la fiche, à l’adresse du compte et à la durée du tenant', async () => {
    const result = await invite()

    expect(result).toEqual({
      status: 'sent',
      sent: ['Jean.Dubois@exemple.test', 'claire.dubois@exemple.test'],
      deferred: [],
    })
    expect(vi.mocked(issueInvitationLink).mock.calls).toEqual([
      [
        {
          organization: ASSOCIATION,
          email: 'jean.dubois@exemple.test',
          expiresInDays: 10,
        },
      ],
      [
        {
          organization: ASSOCIATION,
          email: 'claire.dubois@exemple.test',
          expiresInDays: 10,
        },
      ],
    ])
    const sends = vi
      .mocked(sendInvitationEmailService)
      .mock.calls.map(([input]) => input)
    expect(sends.map((input) => input.url)).toEqual([
      linkOf('jean.dubois@exemple.test').url,
      linkOf('claire.dubois@exemple.test').url,
    ])
    expect(sends[0]).toMatchObject({
      organizationId: ORG_A,
      email: 'Jean.Dubois@exemple.test',
      token: 'jeton-jean.dubois@exemple.test',
      text: 'Bienvenue sur le site.',
      association: {
        name: 'Clos-Fleuri',
        logoUrl: 'http://clos-fleuri.test:3000/api/identity/logo?v=42',
      },
      locale: 'fr',
    })
  })

  it('écrit « invitée le » pour chaque adresse partie, sous l’association', async () => {
    vi.mocked(markInvitedTxnDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_A)
    })

    await invite()

    expect(markInvitedTxnDao).toHaveBeenCalledTimes(2)
    expect(markInvitedTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_A, userId: USER_JEAN})
    )
    expect(markInvitedTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_A, userId: USER_CLAIRE})
    )
  })

  it('une adresse en attente de confirmation est ignorée', async () => {
    givenProfileWith([
      emailRow(),
      emailRow({
        id: 'email-marc',
        email: 'marc.dubois@exemple.test',
        role: 'additional',
        status: 'pending',
        expiresAt: new Date('2099-01-01T00:00:00Z'),
      }),
    ])

    const result = await invite()

    expect(result).toMatchObject({sent: ['Jean.Dubois@exemple.test']})
    expect(issueInvitationLink).toHaveBeenCalledTimes(1)
  })

  it('budget épuisé : l’invitation est reportée, aucune trace écrite', async () => {
    vi.mocked(sendInvitationEmailService).mockResolvedValue({
      status: 'deferred',
      until: '2026-11-27',
    })

    expect(await invite()).toEqual({
      status: 'deferred',
      sent: [],
      deferred: ['Jean.Dubois@exemple.test', 'claire.dubois@exemple.test'],
    })
    expect(markInvitedTxnDao).not.toHaveBeenCalled()
  })

  it('erreur de transport après un premier envoi : « partial », jamais une exception', async () => {
    vi.mocked(sendInvitationEmailService)
      .mockResolvedValueOnce({status: 'sent'})
      .mockRejectedValueOnce(new EmailTransportError('brevo', 'panne'))

    expect(await invite()).toEqual({
      status: 'partial',
      sent: ['Jean.Dubois@exemple.test'],
      deferred: [],
    })
    expect(markInvitedTxnDao).toHaveBeenCalledTimes(1)
  })

  it('erreur de transport au premier envoi : l’erreur remonte, rien n’est tracé', async () => {
    vi.mocked(sendInvitationEmailService).mockRejectedValue(
      new EmailTransportError('brevo', 'panne')
    )

    await expect(invite()).rejects.toThrow(EmailTransportError)
    expect(markInvitedTxnDao).not.toHaveBeenCalled()
  })

  it('réinviter : chaque appel émet un nouveau lien par le générateur (la révocation est celle du générateur)', async () => {
    await invite()
    await invite()

    expect(issueInvitationLink).toHaveBeenCalledTimes(4)
  })
})

describe('recordFirstSignIn — première connexion sur une association (s42a)', () => {
  it('écrit la première connexion sous le tenant de l’association', async () => {
    await recordFirstSignIn({organizationId: ORG_A, userId: USER_JEAN, at: AT})

    expect(withTenant).toHaveBeenCalledWith(ORG_A, expect.any(Function))
    expect(markFirstSignInTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_A,
      userId: USER_JEAN,
      at: AT,
    })
  })
})

describe('inviteMemberProfileService — fiche fermée après la vente (s57, ADR 075)', () => {
  const sold = (endsOn: string) => [
    {
      memberProfileId: PROFILE_ID,
      number: '9',
      meterNumber: null,
      startsOn: '2003-05-14',
      endsOn,
    },
  ]

  it('appel serveur direct sur une fiche fermée : `access_closed`, aucun lien ni email, lue sous l’association', async () => {
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockImplementation(
      async () => {
        expect(scope.current).toBe(ORG_A)
        return sold('2019-10-01')
      }
    )

    expect(await invite()).toEqual({status: 'access_closed'})
    expect(listOwnershipPeriodsByProfilesDao).toHaveBeenCalledWith([PROFILE_ID])
    expect(issueInvitationLink).not.toHaveBeenCalled()
    expect(sendInvitationEmailService).not.toHaveBeenCalled()
  })

  it('fiche vendue encore dans son délai : l’invitation part', async () => {
    vi.useFakeTimers({toFake: ['Date']})
    vi.setSystemTime(new Date('2026-11-26T10:00:00Z'))
    try {
      vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue(
        sold('2026-06-15')
      )

      expect(await invite()).toMatchObject({status: 'sent'})
    } finally {
      vi.useRealTimers()
    }
  })
})
