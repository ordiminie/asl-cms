import {createHash} from 'node:crypto'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  deletePendingEmailsAddedByDao: vi.fn(),
  deleteMemberProfileEmailDao: vi.fn(),
  getActiveEmailCarriersDao: vi.fn(),
  getMemberProfileEmailByIdDao: vi.fn(),
  getMemberProfileEmailsByTokenHashDao: vi.fn(),
  getMemberProfileEmailsDao: vi.fn(),
  insertMemberProfileEmailDao: vi.fn(),
  purgeExpiredPendingEmailsDao: vi.fn(),
  updateMemberProfileEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  getMemberProfilesByUserIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/parcel-ownership-repository', () => ({
  listOwnershipPeriodsByProfilesDao: vi.fn(),
}))
vi.mock('@/services/association-settings-service', async () => {
  const settings =
    await import('@/services/types/domain/association-settings-types')
  return {
    getAssociationSettingsService: vi.fn(async () =>
      settings.resolveSettings(settings.ASSOCIATION_SETTINGS_REGISTRY, [])
    ),
  }
})
vi.mock('@/services/email-service', () => ({
  sendMemberEmailConfirmationEmailService: vi.fn(),
}))

import {
  deleteMemberProfileEmailDao,
  getActiveEmailCarriersDao,
  getMemberProfileEmailByIdDao,
  getMemberProfileEmailsByTokenHashDao,
  getMemberProfileEmailsDao,
  insertMemberProfileEmailDao,
  purgeExpiredPendingEmailsDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {getMemberProfilesByUserIdDao} from '@/db/repositories/member-profile-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {sendMemberEmailConfirmationEmailService} from '@/services/email-service'

import {AuthorizationError} from '../errors/authorization-error'
import {
  addMyEmailService,
  cancelMyPendingEmailService,
  correctMyPendingEmailService,
  getMyEmailsService,
  updateMyEmailService,
} from '../my-email-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const LOT_21 = '33333333-3333-4333-8333-333333333333'
const LOT_40 = '44444444-4444-4444-8444-444444444444'
const VOISIN = '99999999-9999-4999-8999-999999999999'
const JEAN_EMAIL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLAIRE_EMAIL_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const MARC_PENDING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const CLAIRE_USER_ID = '55555555-5555-4555-8555-555555555555'
const JEAN_USER_ID = '66666666-6666-4666-8666-666666666666'
const LATER = new Date('2999-01-01T00:00:00Z')

const member = (id: string, email: string): User => ({
  ...userTest,
  id,
  email,
  name: email === 'claire@exemple.fr' ? 'Claire Dubois' : 'Jean Dubois',
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: id,
      role: UserOrganizationRoleConst.MEMBER,
      createdAt: new Date(),
    },
  ],
})

const claire = member(CLAIRE_USER_ID, 'claire@exemple.fr')
const jean = member(JEAN_USER_ID, 'jean@exemple.fr')

const row = (overrides: Record<string, unknown>) => ({
  organizationId: ORG_ID,
  memberProfileId: LOT_21,
  role: 'additional',
  status: 'active',
  origin: 'site',
  addedByUserId: null,
  addedByName: null,
  replacesEmailId: null,
  confirmationTokenHash: null,
  expiresAt: null,
  unsubscribedAt: null,
  createdAt: new Date('2026-11-16T10:00:00Z'),
  updatedAt: new Date('2026-11-16T10:00:00Z'),
  ...overrides,
})

const jeanEmail = row({
  id: JEAN_EMAIL_ID,
  email: 'jean@exemple.fr',
  role: 'holder',
  origin: 'file',
})
const claireEmail = row({id: CLAIRE_EMAIL_ID, email: 'claire@exemple.fr'})
const marcPending = row({
  id: MARC_PENDING_ID,
  email: 'marc@exemple.fr',
  status: 'pending',
  addedByUserId: CLAIRE_USER_ID,
  confirmationTokenHash: 'hash-marc',
  expiresAt: LATER,
})

const givenProfiles = (...ids: string[]) =>
  vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue(
    ids.map((id) => ({
      id,
      name: 'Jean Dubois',
      currentParcelNumbers: [id === LOT_21 ? '21' : '40'],
    })) as never
  )

const givenEmails = (...rows: ReturnType<typeof row>[]) => {
  vi.mocked(getMemberProfileEmailsDao).mockResolvedValue(rows as never)
  vi.mocked(getMemberProfileEmailByIdDao).mockImplementation(
    async (id) =>
      rows.find((candidate) => (candidate as {id?: string}).id === id) as never
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(claire)
  givenProfiles(LOT_21)
  vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([])
  givenEmails(jeanEmail, claireEmail, marcPending)
  vi.mocked(getActiveEmailCarriersDao).mockResolvedValue([])
  vi.mocked(getMemberProfileEmailsByTokenHashDao).mockResolvedValue([
    marcPending,
  ] as never)
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'Clos-Fleuri',
    domain: 'clos-fleuri.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(sendMemberEmailConfirmationEmailService).mockResolvedValue({
    status: 'sent',
  })
  vi.mocked(insertMemberProfileEmailDao).mockImplementation(
    async (input) => row({id: 'new', ...input}) as never
  )
})

describe('[MEMBRE] getMyEmailsService — « Mes adresses email » (1a)', () => {
  it('lit les adresses de ses fiches par la session : la sienne, celle d’un autre, une attente à elle', async () => {
    const mine = await getMyEmailsService(ORG_ID)

    expect(getMemberProfilesByUserIdDao).toHaveBeenCalledWith(
      ORG_ID,
      CLAIRE_USER_ID
    )
    expect(mine).toMatchObject({landCount: 1, confirmationDays: 7})
    expect(mine?.emails).toEqual([
      expect.objectContaining({
        email: 'jean@exemple.fr',
        own: false,
        holder: true,
        pendingId: null,
      }),
      expect.objectContaining({
        email: 'claire@exemple.fr',
        own: true,
        holder: false,
      }),
      expect.objectContaining({
        email: 'marc@exemple.fr',
        status: 'pending',
        pendingId: MARC_PENDING_ID,
      }),
    ])
  })

  it('une attente ajoutée par quelqu’un d’autre ne porte aucun identifiant', async () => {
    setupAuthUserMocked(jean)

    const mine = await getMyEmailsService(ORG_ID)

    expect(
      mine?.emails.find((email) => email.email === 'marc@exemple.fr')
    ).toMatchObject({pendingId: null})
  })

  it('[INVITÉ] refusé', async () => {
    setupAuthUserMocked(undefined)

    await expect(getMyEmailsService(ORG_ID)).rejects.toThrow(AuthorizationError)
  })
})

describe('[MEMBRE] addMyEmailService — ajouter une adresse (1b, 1c, 1d)', () => {
  it('ajoute une supplémentaire en attente sur chacune de ses fiches, jeton haché, puis envoie le lien', async () => {
    givenProfiles(LOT_21, LOT_40)

    const result = await addMyEmailService({
      organizationId: ORG_ID,
      email: ' sophie@exemple.fr ',
    })

    expect(result).toMatchObject({status: 'sent', email: 'sophie@exemple.fr'})
    const inserted = vi
      .mocked(insertMemberProfileEmailDao)
      .mock.calls.map(([input]) => input)
    expect(inserted.map((input) => input.memberProfileId)).toEqual([
      LOT_21,
      LOT_40,
    ])
    for (const input of inserted) {
      expect(input).toMatchObject({
        email: 'sophie@exemple.fr',
        role: 'additional',
        status: 'pending',
        origin: 'site',
        addedByUserId: CLAIRE_USER_ID,
        expiresAt: expect.any(Date),
      })
      expect(input.confirmationTokenHash).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(inserted[0].confirmationTokenHash).toBe(
      inserted[1].confirmationTokenHash
    )
    const [sent] = vi.mocked(sendMemberEmailConfirmationEmailService).mock
      .calls[0]
    expect(sent).toMatchObject({
      organizationId: ORG_ID,
      email: 'sophie@exemple.fr',
      authorName: 'Claire Dubois',
      parcelNumbers: ['21', '40'],
    })
    expect(sent.url).toMatch(/\/confirmer-adresse\/[A-Za-z0-9_-]{43}$/)
    expect(sent.url).not.toContain(inserted[0].confirmationTokenHash)
  })

  it('le budget du jour épuisé : le lien partira demain (1f)', async () => {
    vi.mocked(sendMemberEmailConfirmationEmailService).mockResolvedValue({
      status: 'deferred',
      until: '2026-11-17',
    })

    await expect(
      addMyEmailService({organizationId: ORG_ID, email: 'sophie@exemple.fr'})
    ).resolves.toMatchObject({status: 'deferred'})
  })

  it('refuse une adresse portée par une fiche non reliée à son compte, sans nommer personne (critère 7)', async () => {
    vi.mocked(getActiveEmailCarriersDao).mockResolvedValue([
      {id: 'x', memberProfileId: VOISIN, role: 'holder'},
    ])

    await expect(
      addMyEmailService({organizationId: ORG_ID, email: 'voisin@exemple.fr'})
    ).resolves.toEqual({status: 'taken'})
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(sendMemberEmailConfirmationEmailService).not.toHaveBeenCalled()
  })

  it('refuse une adresse déjà dans la liste', async () => {
    await expect(
      addMyEmailService({organizationId: ORG_ID, email: 'JEAN@exemple.fr'})
    ).resolves.toEqual({status: 'already_listed'})
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('[INVITÉ] refusé, rien n’est écrit', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      addMyEmailService({organizationId: ORG_ID, email: 'x@exemple.fr'})
    ).rejects.toThrow(AuthorizationError)
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
  })
})

describe('[MEMBRE] updateMyEmailService — modifier sa propre adresse (1e, critère 4)', () => {
  it('crée une attente qui remplacera sa propre adresse ; l’ancienne reste active', async () => {
    const result = await updateMyEmailService({
      organizationId: ORG_ID,
      emailId: CLAIRE_EMAIL_ID,
      email: 'claire.nouvelle@exemple.fr',
    })

    expect(result).toMatchObject({status: 'sent'})
    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith(
      expect.objectContaining({
        memberProfileId: LOT_21,
        email: 'claire.nouvelle@exemple.fr',
        status: 'pending',
        replacesEmailId: CLAIRE_EMAIL_ID,
      })
    )
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(deleteMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('une supplémentaire qui modifie la titulaire, par l’appel serveur direct : refusé', async () => {
    await expect(
      updateMyEmailService({
        organizationId: ORG_ID,
        emailId: JEAN_EMAIL_ID,
        email: 'pirate@exemple.fr',
      })
    ).rejects.toThrow(AuthorizationError)
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('la titulaire qui modifie une supplémentaire, par l’appel serveur direct : refusé', async () => {
    setupAuthUserMocked(jean)

    await expect(
      updateMyEmailService({
        organizationId: ORG_ID,
        emailId: CLAIRE_EMAIL_ID,
        email: 'pirate@exemple.fr',
      })
    ).rejects.toThrow(AuthorizationError)
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('l’identifiant d’une adresse d’une autre association (invisible sous la RLS) : refusé', async () => {
    await expect(
      updateMyEmailService({
        organizationId: ORG_ID,
        emailId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        email: 'pirate@exemple.fr',
      })
    ).rejects.toThrow(AuthorizationError)
  })

  it('l’identifiant d’une adresse d’une fiche qui n’est pas la sienne : refusé', async () => {
    givenEmails(
      jeanEmail,
      claireEmail,
      row({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        email: 'claire@exemple.fr',
        memberProfileId: VOISIN,
      })
    )

    await expect(
      updateMyEmailService({
        organizationId: ORG_ID,
        emailId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        email: 'pirate@exemple.fr',
      })
    ).rejects.toThrow(AuthorizationError)
  })
})

describe('[MEMBRE] corriger ou annuler une attente (critère 4)', () => {
  it('annule l’attente dont elle est l’autrice, sur toutes ses fiches', async () => {
    await expect(
      cancelMyPendingEmailService({
        organizationId: ORG_ID,
        emailId: MARC_PENDING_ID,
      })
    ).resolves.toEqual({status: 'cancelled'})
    expect(getMemberProfileEmailsByTokenHashDao).toHaveBeenCalledWith(
      'hash-marc'
    )
    expect(deleteMemberProfileEmailDao).toHaveBeenCalledWith(MARC_PENDING_ID)
  })

  it('annuler l’attente d’un autre, par l’appel serveur direct : refusé', async () => {
    setupAuthUserMocked(jean)

    await expect(
      cancelMyPendingEmailService({
        organizationId: ORG_ID,
        emailId: MARC_PENDING_ID,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(deleteMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('corrige l’attente : nouvelle adresse, nouveau jeton, nouveau lien', async () => {
    const result = await correctMyPendingEmailService({
      organizationId: ORG_ID,
      emailId: MARC_PENDING_ID,
      email: 'marc.dubois@exemple.fr',
    })

    expect(result).toMatchObject({
      status: 'sent',
      email: 'marc.dubois@exemple.fr',
    })
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      MARC_PENDING_ID,
      expect.objectContaining({
        email: 'marc.dubois@exemple.fr',
        confirmationTokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: expect.any(Date),
      })
    )
    expect(
      vi.mocked(updateMemberProfileEmailDao).mock.calls[0][1]
        .confirmationTokenHash
    ).not.toBe('hash-marc')
    expect(sendMemberEmailConfirmationEmailService).toHaveBeenCalledTimes(1)
  })

  it('corriger l’attente d’un autre : refusé', async () => {
    setupAuthUserMocked(jean)

    await expect(
      correctMyPendingEmailService({
        organizationId: ORG_ID,
        emailId: MARC_PENDING_ID,
        email: 'x@exemple.fr',
      })
    ).rejects.toThrow(AuthorizationError)
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
  })
})

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

describe('[MEMBRE] le lien transmis à l’envoi (revues M1, mi1) : son jeton et son hash, celui de toutes ses attentes', () => {
  const sentLink = () => {
    const [sent] = vi.mocked(sendMemberEmailConfirmationEmailService).mock
      .calls[0]
    return sent
  }

  it('ajout : le jeton de l’URL et le hash écrit sur les attentes du lien, pour qu’un report ne garde pas le jeton', async () => {
    let next = 0
    vi.mocked(insertMemberProfileEmailDao).mockImplementation(
      async (input) => row({id: `inserted-${(next += 1)}`, ...input}) as never
    )

    await addMyEmailService({
      organizationId: ORG_ID,
      email: 'sophie@exemple.fr',
    })

    const sent = sentLink()
    expect(sent.url.endsWith(`/${sent.token}`)).toBe(true)
    expect(sent.tokenHash).toBe(sha256(sent.token))
    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith(
      expect.objectContaining({confirmationTokenHash: sent.tokenHash})
    )
  })

  it('correction : le hash neuf de l’attente corrigée', async () => {
    await correctMyPendingEmailService({
      organizationId: ORG_ID,
      emailId: MARC_PENDING_ID,
      email: 'marc.dubois@exemple.fr',
    })

    const sent = sentLink()
    expect(sent.url.endsWith(`/${sent.token}`)).toBe(true)
    expect(sent.tokenHash).toBe(sha256(sent.token))
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      MARC_PENDING_ID,
      expect.objectContaining({confirmationTokenHash: sent.tokenHash})
    )
  })
})

describe('[MEMBRE] correctMyPendingEmailService — attentes échues purgées d’abord (revue m4)', () => {
  it('purge les attentes échues de l’association avant d’écrire : une adresse échue ne bloque plus la correction', async () => {
    await correctMyPendingEmailService({
      organizationId: ORG_ID,
      emailId: MARC_PENDING_ID,
      email: 'marc.dubois@exemple.fr',
    })

    expect(purgeExpiredPendingEmailsDao).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Date)
    )
    const [purged] = vi.mocked(purgeExpiredPendingEmailsDao).mock
      .invocationCallOrder
    const [written] = vi.mocked(updateMemberProfileEmailDao).mock
      .invocationCallOrder
    expect(purged).toBeLessThan(written)
  })
})

describe('[MEMBRE] accès après la vente — une fiche fermée ne reçoit plus d’adresse (s57, ADR 075 §4)', () => {
  beforeEach(() => {
    givenProfiles(LOT_21, LOT_40)
    vi.mocked(listOwnershipPeriodsByProfilesDao).mockResolvedValue([
      {
        memberProfileId: LOT_21,
        number: '21',
        meterNumber: null,
        startsOn: '2011-04-02',
        endsOn: null,
      },
      {
        memberProfileId: LOT_40,
        number: '40',
        meterNumber: null,
        startsOn: '2003-05-14',
        endsOn: '2019-10-01',
      },
    ])
  })

  it('l’adresse ajoutée n’est écrite que sur la fiche encore ouverte', async () => {
    await addMyEmailService({
      organizationId: ORG_ID,
      email: 'sophie@exemple.fr',
    })

    expect(
      vi
        .mocked(insertMemberProfileEmailDao)
        .mock.calls.map(([input]) => input.memberProfileId)
    ).toEqual([LOT_21])
    expect(getMemberProfileEmailsDao).toHaveBeenCalledWith([LOT_21])
  })
})
