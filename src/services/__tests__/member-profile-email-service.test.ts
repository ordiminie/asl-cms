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
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  deletePendingEmailsAddedByDao: vi.fn(),
  reassignPendingEmailsAddedByDao: vi.fn(),
  deleteMemberProfileEmailDao: vi.fn(),
  getMemberProfileEmailsDao: vi.fn(),
  insertMemberProfileEmailDao: vi.fn(),
  purgeExpiredPendingEmailsDao: vi.fn(),
  setMemberProfileEmailRoleDao: vi.fn(),
  updateMemberProfileEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  countLinkedProfilesDao: vi.fn(),
  getLinkedAccountsDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
  getMemberProfilesByEmailDao: vi.fn(),
  getMemberProfilesByUserIdDao: vi.fn(),
  linkMemberProfileAccountDao: vi.fn(),
  unlinkMemberProfileAccountDao: vi.fn(),
  getUnlinkedMemberProfilesWithEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  createUserIfAbsentTxnDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  createMemberIfAbsentTxnDao: vi.fn(),
  deleteMemberWithRoleDao: vi.fn(),
  getMemberAccountDao: vi.fn(),
  getUserOrganizationDao: vi.fn(),
  lockOrganizationRolesDao: vi.fn(),
  updateMemberRoleFromDao: vi.fn(),
}))

import {
  deleteMemberProfileEmailDao,
  deletePendingEmailsAddedByDao,
  getMemberProfileEmailsDao,
  insertMemberProfileEmailDao,
  purgeExpiredPendingEmailsDao,
  setMemberProfileEmailRoleDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  countLinkedProfilesDao,
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  getMemberProfilesByEmailDao,
  getMemberProfilesByUserIdDao,
  linkMemberProfileAccountDao,
  unlinkMemberProfileAccountDao,
} from '@/db/repositories/member-profile-repository'
import {insertMemberRoleEventDao} from '@/db/repositories/member-role-event-repository'
import {
  createMemberIfAbsentTxnDao,
  deleteMemberWithRoleDao,
  getMemberAccountDao,
  getUserOrganizationDao,
} from '@/db/repositories/organization-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'

import {getActingContext} from '../authentication/auth-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  addMemberProfileEmailService,
  designateMemberProfileHolderService,
  removeMemberProfileEmailService,
  updateMemberProfileEmailService,
} from '../member-profile-email-service'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const JEAN_ID = '55555555-5555-4555-8555-555555555555'
const CLAIRE_ID = '66666666-6666-4666-8666-666666666666'
const NEW_USER_ID = '77777777-7777-4777-8777-777777777777'
const HOLDER_EMAIL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CLAIRE_EMAIL_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const withRole = (role: OrganizationRole): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const profileRow = {
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Jean Dubois',
  email: 'jean@exemple.fr',
  mailOnly: false,
  phone: null,
  addressLine: null,
  addressComplement: null,
  postalCode: null,
  city: null,
  pennylaneCustomerId: null,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  updatedAt: new Date('2026-09-01T08:00:00Z'),
}

const emailRow = (overrides: Record<string, unknown>) => ({
  organizationId: ORG_ID,
  memberProfileId: PROFILE_ID,
  role: 'additional',
  status: 'active',
  origin: 'site',
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

const jeanEmail = emailRow({
  id: HOLDER_EMAIL_ID,
  email: 'jean@exemple.fr',
  role: 'holder',
  origin: 'file',
})
const claireEmail = emailRow({id: CLAIRE_EMAIL_ID, email: 'claire@exemple.fr'})

const givenEmails = (...rows: ReturnType<typeof emailRow>[]) =>
  vi.mocked(getMemberProfileEmailsDao).mockResolvedValue(rows as never)

const givenAccounts = (
  accounts: {
    userId: string
    email: string
    role?: 'member' | 'board' | 'owner'
  }[]
) => {
  vi.mocked(getLinkedAccountsDao).mockResolvedValue(
    accounts.map(({userId, email}) => ({userId, email, name: email}))
  )
  vi.mocked(getMemberAccountDao).mockImplementation(async (userId) => {
    const account = accounts.find((candidate) => candidate.userId === userId)
    return account
      ? {
          email: account.email,
          name: account.email,
          role: account.role ?? 'member',
        }
      : undefined
  })
  vi.mocked(getUserOrganizationDao).mockImplementation(async (userId) => {
    const account = accounts.find((candidate) => candidate.userId === userId)
    return account
      ? ({
          id: 'm',
          organizationId: ORG_ID,
          userId,
          role: account.role ?? 'member',
          createdAt: new Date(),
        } as never)
      : undefined
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  setupAuthUserMocked(withRole('board'))
  vi.mocked(getActingContext).mockResolvedValue(undefined)
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue(profileRow as never)
  givenEmails(jeanEmail, claireEmail)
  givenAccounts([
    {userId: JEAN_ID, email: 'jean@exemple.fr'},
    {userId: CLAIRE_ID, email: 'claire@exemple.fr'},
  ])
  vi.mocked(getMemberProfilesByEmailDao).mockResolvedValue([])
  vi.mocked(getMemberProfilesByUserIdDao).mockResolvedValue([])
  vi.mocked(countLinkedProfilesDao).mockResolvedValue(1)
  vi.mocked(getUserByEmailDao).mockResolvedValue(undefined)
  vi.mocked(createUserIfAbsentTxnDao).mockResolvedValue({id: NEW_USER_ID})
  vi.mocked(createMemberIfAbsentTxnDao).mockImplementation(
    async (row) =>
      ({
        id: 'm',
        organizationId: ORG_ID,
        userId: row.userId,
        role: 'member',
        createdAt: new Date(),
      }) as never
  )
  vi.mocked(deleteMemberWithRoleDao).mockResolvedValue(1)
  vi.mocked(insertMemberProfileEmailDao).mockImplementation(
    async (row) => emailRow({id: 'new-email', ...row}) as never
  )
})

describe('[BUREAU] ajouter une adresse (critères 5, 8, 9)', () => {
  it('ajoute une supplémentaire active d’office, origine site, et ouvre son compte', async () => {
    const result = await addMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: ' marc@exemple.fr ',
    })

    expect(result.status).toBe('saved')
    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'marc@exemple.fr',
      role: 'additional',
      status: 'active',
      origin: 'site',
    })
    expect(setMemberProfileEmailRoleDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: NEW_USER_ID,
    })
    expect(purgeExpiredPendingEmailsDao).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Date)
    )
  })

  it('fiche sans adresse active : l’adresse ajoutée devient titulaire', async () => {
    givenEmails()
    givenAccounts([])

    await addMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'marc@exemple.fr',
    })

    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith(
      expect.objectContaining({role: 'holder', status: 'active'})
    )
  })

  it('refuse une adresse déjà sur la fiche, sans rien écrire', async () => {
    const result = await addMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'CLAIRE@exemple.fr',
    })

    expect(result).toEqual({status: 'already_listed'})
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('adresse portée par une autre fiche : rien n’est écrit avant la confirmation (4c)', async () => {
    vi.mocked(getMemberProfilesByEmailDao).mockResolvedValue([
      {
        ...profileRow,
        id: OTHER_PROFILE_ID,
        name: 'Bernard Lefèvre',
        userId: NEW_USER_ID,
        role: 'holder',
        currentParcelNumbers: ['27'],
      } as never,
    ])

    const result = await addMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'bernard@exemple.fr',
    })

    expect(result.status).toBe('email_shared')
    expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
  })

  it('confirmée comme titulaire de cette fiche : l’ancienne titulaire devient supplémentaire, le même compte est relié (critère 8)', async () => {
    vi.mocked(getMemberProfilesByEmailDao).mockResolvedValue([
      {
        ...profileRow,
        id: OTHER_PROFILE_ID,
        userId: NEW_USER_ID,
        role: 'holder',
        currentParcelNumbers: ['27'],
      } as never,
    ])
    const calls: string[] = []
    vi.mocked(setMemberProfileEmailRoleDao).mockImplementation(async () => {
      calls.push('demote')
    })
    vi.mocked(insertMemberProfileEmailDao).mockImplementation(async (row) => {
      calls.push('insert')
      return emailRow({id: 'new-email', ...row}) as never
    })

    await addMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'bernard@exemple.fr',
      role: 'holder',
      confirmedAccountUserId: NEW_USER_ID,
    })

    expect(setMemberProfileEmailRoleDao).toHaveBeenCalledWith(
      HOLDER_EMAIL_ID,
      'additional'
    )
    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith(
      expect.objectContaining({role: 'holder'})
    )
    expect(calls).toEqual(['demote', 'insert'])
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: NEW_USER_ID,
    })
  })
})

describe('[BUREAU] modifier une adresse (critère 9 : titre transmis)', () => {
  it('modifie la titulaire : elle reste titulaire, son compte est remplacé', async () => {
    const result = await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      email: 'jean.nouveau@exemple.fr',
    })

    expect(result.status).toBe('saved')
    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(HOLDER_EMAIL_ID, {
      email: 'jean.nouveau@exemple.fr',
      unsubscribedAt: null,
    })
    expect(setMemberProfileEmailRoleDao).not.toHaveBeenCalled()
    expect(unlinkMemberProfileAccountDao).toHaveBeenCalledWith(
      PROFILE_ID,
      JEAN_ID
    )
    expect(unlinkMemberProfileAccountDao).not.toHaveBeenCalledWith(
      PROFILE_ID,
      CLAIRE_ID
    )
  })

  it('refuse une modification vers une autre adresse de la fiche', async () => {
    expect(
      await updateMemberProfileEmailService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        emailId: HOLDER_EMAIL_ID,
        email: 'claire@exemple.fr',
      })
    ).toEqual({status: 'already_listed'})
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('adresse inconnue de la fiche : not_found', async () => {
    expect(
      await updateMemberProfileEmailService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        emailId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        email: 'x@exemple.fr',
      })
    ).toEqual({status: 'not_found'})
  })
})

describe('[BUREAU] modifier l’adresse de la présidence (s14, D5, ADR 054 §6)', () => {
  const givenOwnerHolder = () => {
    givenAccounts([
      {userId: JEAN_ID, email: 'jean@exemple.fr', role: 'owner'},
      {userId: CLAIRE_ID, email: 'claire@exemple.fr'},
    ])
    vi.mocked(countLinkedProfilesDao).mockResolvedValue(0)
  }
  const modifyHolder = () =>
    updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      email: 'presidence@exemple.fr',
    })

  it('reporte le rôle de la présidence sur la nouvelle adresse, jamais sur l’adresse d’un proche', async () => {
    givenOwnerHolder()

    await modifyHolder()

    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      JEAN_ID,
      ORG_ID,
      'owner'
    )
    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: NEW_USER_ID,
        toRole: 'owner',
        reason: 'email_change',
      })
    )
    expect(insertMemberRoleEventDao).not.toHaveBeenCalledWith(
      expect.objectContaining({targetUserId: CLAIRE_ID})
    )
  })

  it('trace le départ de l’ancienne adresse, auteur = la personne connectée', async () => {
    givenOwnerHolder()

    await modifyHolder()

    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({
        memberProfileId: PROFILE_ID,
        targetUserId: JEAN_ID,
        authorUserId: userTest.id,
        onBehalfOfUserId: null,
        fromRole: 'owner',
        toRole: null,
        reason: 'email_change',
      })
    )
  })

  it('pendant une session à la place d’un compte : trace attribuée au SuperAdmin (s48), lue hors du scope', async () => {
    givenOwnerHolder()
    const viewer = withRole('board')
    const actingReadUnder: (string | undefined)[] = []
    vi.mocked(getActingContext).mockImplementation(async () => {
      actingReadUnder.push(scope.current)
      return {
        user: viewer,
        impersonator: {id: 'superadmin-support', name: 'Zoé Support'},
      }
    })

    await modifyHolder()

    expect(insertMemberRoleEventDao).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUserId: 'superadmin-support',
        authorName: 'Zoé Support',
        onBehalfOfUserId: viewer.id,
      })
    )
    expect(actingReadUnder.length).toBeGreaterThan(0)
    expect(actingReadUnder.every((under) => under === undefined)).toBe(true)
  })
})

describe('[BUREAU] retirer une adresse (critères 9 et 10)', () => {
  it('retire une supplémentaire : seul son compte est délié de cette fiche', async () => {
    const result = await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_EMAIL_ID,
    })

    expect(result.status).toBe('saved')
    expect(deleteMemberProfileEmailDao).toHaveBeenCalledWith(CLAIRE_EMAIL_ID)
    expect(unlinkMemberProfileAccountDao).toHaveBeenCalledTimes(1)
    expect(unlinkMemberProfileAccountDao).toHaveBeenCalledWith(
      PROFILE_ID,
      CLAIRE_ID
    )
    expect(setMemberProfileEmailRoleDao).not.toHaveBeenCalled()
  })

  it('ses autres fiches restent ouvertes : la ligne member reste', async () => {
    vi.mocked(countLinkedProfilesDao).mockResolvedValue(1)

    await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_EMAIL_ID,
    })

    expect(deleteMemberWithRoleDao).not.toHaveBeenCalled()
  })

  it('refuse de retirer la titulaire sans remplaçante', async () => {
    expect(
      await removeMemberProfileEmailService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        emailId: HOLDER_EMAIL_ID,
      })
    ).toEqual({status: 'replacement_required'})
    expect(deleteMemberProfileEmailDao).not.toHaveBeenCalled()
  })

  it('retire la titulaire en désignant une active : retrait puis promotion', async () => {
    const calls: string[] = []
    vi.mocked(deleteMemberProfileEmailDao).mockImplementation(async () => {
      calls.push('delete')
    })
    vi.mocked(setMemberProfileEmailRoleDao).mockImplementation(
      async (id, role) => {
        calls.push(`${role}:${id}`)
      }
    )

    await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      replacementEmailId: CLAIRE_EMAIL_ID,
    })

    expect(calls).toEqual(['delete', `holder:${CLAIRE_EMAIL_ID}`])
    expect(unlinkMemberProfileAccountDao).toHaveBeenCalledWith(
      PROFILE_ID,
      JEAN_ID
    )
  })

  it('retire la titulaire en saisissant une nouvelle adresse, qui devient titulaire et ouvre son compte', async () => {
    await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      replacementEmail: 'odile@exemple.fr',
    })

    expect(insertMemberProfileEmailDao).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'odile@exemple.fr',
        role: 'holder',
        status: 'active',
      })
    )
    expect(linkMemberProfileAccountDao).toHaveBeenCalledWith(
      expect.objectContaining({userId: NEW_USER_ID})
    )
  })

  it('retire la dernière adresse active sans remplaçante : courrier uniquement', async () => {
    givenEmails(jeanEmail)
    givenAccounts([{userId: JEAN_ID, email: 'jean@exemple.fr'}])
    vi.mocked(countLinkedProfilesDao).mockResolvedValue(0)

    const result = await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
    })

    expect(result.status).toBe('saved')
    expect(deleteMemberProfileEmailDao).toHaveBeenCalledWith(HOLDER_EMAIL_ID)
    expect(deleteMemberWithRoleDao).toHaveBeenCalledWith(
      JEAN_ID,
      ORG_ID,
      'member'
    )
  })

  it('refuse de retirer l’adresse d’un membre du bureau sur sa dernière fiche', async () => {
    givenAccounts([
      {userId: JEAN_ID, email: 'jean@exemple.fr'},
      {userId: CLAIRE_ID, email: 'claire@exemple.fr', role: 'board'},
    ])
    vi.mocked(countLinkedProfilesDao).mockResolvedValue(1)

    expect(
      await removeMemberProfileEmailService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        emailId: CLAIRE_EMAIL_ID,
      })
    ).toEqual({status: 'board_email_required'})
    expect(deleteMemberProfileEmailDao).not.toHaveBeenCalled()
  })
})

describe('[BUREAU] désigner la titulaire (critère 9)', () => {
  it('retrograde l’ancienne avant de promouvoir la nouvelle', async () => {
    const calls: string[] = []
    vi.mocked(setMemberProfileEmailRoleDao).mockImplementation(
      async (id, role) => {
        calls.push(`${role}:${id}`)
      }
    )

    const result = await designateMemberProfileHolderService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_EMAIL_ID,
    })

    expect(result.status).toBe('saved')
    expect(calls).toEqual([
      `additional:${HOLDER_EMAIL_ID}`,
      `holder:${CLAIRE_EMAIL_ID}`,
    ])
  })

  it('refuse une adresse en attente', async () => {
    givenEmails(
      jeanEmail,
      emailRow({
        id: CLAIRE_EMAIL_ID,
        email: 'claire@exemple.fr',
        status: 'pending',
        expiresAt: new Date('2999-01-01T00:00:00Z'),
      })
    )

    expect(
      (
        await designateMemberProfileHolderService({
          organizationId: ORG_ID,
          memberProfileId: PROFILE_ID,
          emailId: CLAIRE_EMAIL_ID,
        })
      ).status
    ).toBe('invalid_replacement')
    expect(setMemberProfileEmailRoleDao).not.toHaveBeenCalled()
  })
})

describe('[MEMBRE] et [INVITÉ] : aucune écriture d’adresse depuis le bureau', () => {
  for (const [label, user] of [
    ['membre', withRole('member')],
    ['invité', undefined],
  ] as const) {
    it(`refuse au ${label}`, async () => {
      setupAuthUserMocked(user)

      for (const call of [
        () =>
          addMemberProfileEmailService({
            organizationId: ORG_ID,
            memberProfileId: PROFILE_ID,
            email: 'x@exemple.fr',
          }),
        () =>
          updateMemberProfileEmailService({
            organizationId: ORG_ID,
            memberProfileId: PROFILE_ID,
            emailId: HOLDER_EMAIL_ID,
            email: 'x@exemple.fr',
          }),
        () =>
          removeMemberProfileEmailService({
            organizationId: ORG_ID,
            memberProfileId: PROFILE_ID,
            emailId: CLAIRE_EMAIL_ID,
          }),
        () =>
          designateMemberProfileHolderService({
            organizationId: ORG_ID,
            memberProfileId: PROFILE_ID,
            emailId: CLAIRE_EMAIL_ID,
          }),
      ]) {
        await expect(call()).rejects.toThrow(AuthorizationError)
      }
      expect(insertMemberProfileEmailDao).not.toHaveBeenCalled()
      expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
      expect(deleteMemberProfileEmailDao).not.toHaveBeenCalled()
      expect(setMemberProfileEmailRoleDao).not.toHaveBeenCalled()
    })
  }
})

describe('[BUREAU] retirer l’adresse d’un proche qui a ajouté une adresse en attente (revue C1)', () => {
  it('ses ajouts en attente sur cette fiche partent avec son lien : son lien ne pourra plus rien activer', async () => {
    await removeMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: CLAIRE_EMAIL_ID,
    })

    expect(deletePendingEmailsAddedByDao).toHaveBeenCalledWith(
      PROFILE_ID,
      CLAIRE_ID
    )
    expect(deletePendingEmailsAddedByDao).not.toHaveBeenCalledWith(
      PROFILE_ID,
      JEAN_ID
    )
  })
})

describe('[BUREAU] une adresse modifiée n’hérite pas du refus de l’ancienne (revue m3, ADR 057)', () => {
  it('nouvelle valeur : le refus des envois de l’ancienne adresse est effacé', async () => {
    givenEmails(
      emailRow({
        ...jeanEmail,
        unsubscribedAt: new Date('2026-10-01T08:00:00Z'),
      }),
      claireEmail
    )

    await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      email: 'jean.nouveau@exemple.fr',
    })

    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(HOLDER_EMAIL_ID, {
      email: 'jean.nouveau@exemple.fr',
      unsubscribedAt: null,
    })
  })

  it('même adresse, casse corrigée : le refus reste', async () => {
    givenEmails(
      emailRow({
        ...jeanEmail,
        unsubscribedAt: new Date('2026-10-01T08:00:00Z'),
      }),
      claireEmail
    )

    await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: HOLDER_EMAIL_ID,
      email: 'Jean@Exemple.fr',
    })

    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(HOLDER_EMAIL_ID, {
      email: 'Jean@Exemple.fr',
    })
  })
})

describe('[BUREAU] une attente modifiée et activée par le bureau n’hérite pas d’un refus (revue m3)', () => {
  it('nouvelle valeur : le refus porté par l’ancienne valeur est effacé', async () => {
    const PENDING_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    givenEmails(
      jeanEmail,
      emailRow({
        id: PENDING_ID,
        email: 'marc@exemple.fr',
        status: 'pending',
        addedByUserId: JEAN_ID,
        confirmationTokenHash: 'hash',
        expiresAt: new Date('2999-01-01T00:00:00Z'),
        unsubscribedAt: new Date('2026-10-01T08:00:00Z'),
      })
    )

    await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: PENDING_ID,
      email: 'marc.dubois@exemple.fr',
    })

    expect(updateMemberProfileEmailDao).toHaveBeenCalledWith(
      PENDING_ID,
      expect.objectContaining({
        email: 'marc.dubois@exemple.fr',
        status: 'active',
        unsubscribedAt: null,
      })
    )
  })
})
