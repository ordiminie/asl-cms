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
vi.mock('@/db/repositories/member-profile-repository', () => ({
  countMemberProfilesDao: vi.fn(),
  createMemberProfileTxnDao: vi.fn(),
  getMemberProfileByEmailDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
  getMemberProfilePageDao: vi.fn(),
  updateMemberProfileContactTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  createUserDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  createOrganizationMemberDao: vi.fn(),
  deleteUserOrganizationDao: vi.fn(),
}))

import {
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByEmailDao,
  getMemberProfileByIdDao,
  getMemberProfilePageDao,
  updateMemberProfileContactTxnDao,
} from '@/db/repositories/member-profile-repository'
import {
  createOrganizationMemberDao,
  deleteUserOrganizationDao,
} from '@/db/repositories/organization-repository'
import {
  createUserDao,
  getUserByEmailDao,
} from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  canManageMemberProfilesService,
  createMemberProfileService,
  getMemberProfilePageService,
  getMemberProfileService,
  updateMemberProfileContactService,
} from '../member-profile-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {MEMBER_PROFILES_PAGE_SIZE} from '../types/domain/member-profile-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_PROFILE_ID = '44444444-4444-4444-8444-444444444444'

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

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Jean et Odile Dubois',
  email: null as string | null,
  phone: null as string | null,
  addressLine: null as string | null,
  addressComplement: null as string | null,
  postalCode: null as string | null,
  city: null as string | null,
  mailOnly: true,
  createdAt: new Date('2026-09-01T08:00:00Z'),
  updatedAt: new Date('2026-09-01T08:00:00Z'),
  ...overrides,
})

const profileDaos = () => [
  countMemberProfilesDao,
  createMemberProfileTxnDao,
  getMemberProfileByEmailDao,
  getMemberProfileByIdDao,
  getMemberProfilePageDao,
  updateMemberProfileContactTxnDao,
]

const accountDaos = () => [
  createUserDao,
  getUserByEmailDao,
  createOrganizationMemberDao,
  deleteUserOrganizationDao,
]

beforeEach(() => {
  vi.clearAllMocks()
  scope.current = undefined
  vi.mocked(createMemberProfileTxnDao).mockResolvedValue({
    status: 'created',
    row: profileRow(),
  })
  vi.mocked(updateMemberProfileContactTxnDao).mockResolvedValue({
    status: 'updated',
    row: profileRow(),
  })
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue(profileRow())
  vi.mocked(getMemberProfileByEmailDao).mockResolvedValue(undefined)
  vi.mocked(getMemberProfilePageDao).mockResolvedValue({rows: [], total: 0})
  vi.mocked(countMemberProfilesDao).mockResolvedValue({total: 0, incomplete: 0})
})

describe.each([
  ['[ORGANIZATION OWNER]', UserOrganizationRoleConst.OWNER],
  ['[ORGANIZATION ADMIN]', UserOrganizationRoleConst.ADMIN],
])('%s gère les fiches des propriétaires', (_label, role) => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(role))
  })

  it('should create a profile under the tenant scope and return the id given by the database (critère 1)', async () => {
    let writtenUnder: string | undefined
    vi.mocked(createMemberProfileTxnDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return {
        status: 'created',
        row: profileRow({email: 'claire@example.org', mailOnly: false}),
      }
    })

    const result = await createMemberProfileService({
      organizationId: ORG_ID,
      name: '  Claire Meunier ',
      email: ' claire@example.org ',
      phone: '0262 12 34 56',
      addressLine: '12 chemin des Pins',
      addressComplement: '',
      postalCode: '97400',
      city: 'Saint-Denis',
    })

    expect(createMemberProfileTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      name: 'Claire Meunier',
      email: 'claire@example.org',
      phone: '0262 12 34 56',
      addressLine: '12 chemin des Pins',
      addressComplement: null,
      postalCode: '97400',
      city: 'Saint-Denis',
    })
    expect(writtenUnder).toBe(ORG_ID)
    expect(result).toMatchObject({status: 'saved', profile: {id: PROFILE_ID}})
  })

  it('should never send an identifier to the repository: the database generates it', async () => {
    await createMemberProfileService({
      organizationId: ORG_ID,
      name: 'Claire Meunier',
      email: 'claire@example.org',
    })

    const [written] = vi.mocked(createMemberProfileTxnDao).mock.calls[0]
    expect(written).not.toHaveProperty('id')
  })

  it('should create a profile without email: mail only, and no account is opened (critère 7)', async () => {
    const result = await createMemberProfileService({
      organizationId: ORG_ID,
      name: 'Paul Ferrand',
      addressLine: '3 rue des Lilas',
      postalCode: '97400',
      city: 'Saint-Denis',
    })

    expect(createMemberProfileTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({email: null})
    )
    expect(result).toMatchObject({
      status: 'saved',
      profile: {email: null, mailOnly: true},
    })
    for (const dao of accountDaos()) {
      expect(dao).not.toHaveBeenCalled()
    }
  })

  it.each([
    ['vide', ''],
    ["faite d'espaces", '   '],
  ])(
    'should store an email left %s as absent, never as an empty string',
    async (_label, email) => {
      await createMemberProfileService({
        organizationId: ORG_ID,
        name: 'Paul Ferrand',
        email,
        phone: '',
        addressLine: ' ',
        postalCode: '',
        city: '',
      })

      expect(createMemberProfileTxnDao).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        name: 'Paul Ferrand',
        email: null,
        phone: null,
        addressLine: null,
        addressComplement: null,
        postalCode: null,
        city: null,
      })
    }
  )

  it('should save a profile without any postal address, and flag it incomplete (critère 8)', async () => {
    const result = await createMemberProfileService({
      organizationId: ORG_ID,
      name: 'Paul Ferrand',
    })

    expect(result).toMatchObject({
      status: 'saved',
      profile: {mailOnly: true, incomplete: true},
    })
  })

  it.each([
    ['an address line', {addressLine: '3 rue des Lilas'}],
    ['an email', {email: 'paul@example.org', mailOnly: false}],
  ])(
    'should not flag a profile incomplete when it has %s',
    async (_l, part) => {
      vi.mocked(getMemberProfileByIdDao).mockResolvedValue(profileRow(part))

      const profile = await getMemberProfileService(ORG_ID, PROFILE_ID)

      expect(profile?.incomplete).toBe(false)
    }
  )

  it('should answer email_taken with the other profile id, not a raw exception', async () => {
    vi.mocked(createMemberProfileTxnDao).mockResolvedValue({
      status: 'email_taken',
    })
    vi.mocked(getMemberProfileByEmailDao).mockResolvedValue(
      profileRow({id: OTHER_PROFILE_ID, email: 'claire@example.org'})
    )

    const result = await createMemberProfileService({
      organizationId: ORG_ID,
      name: 'Claire Meunier',
      email: 'Claire@Example.org',
    })

    expect(result).toEqual({
      status: 'email_taken',
      memberProfileId: OTHER_PROFILE_ID,
    })
    expect(getMemberProfileByEmailDao).toHaveBeenCalledWith(
      ORG_ID,
      'Claire@Example.org'
    )
  })

  it.each([
    ['a name left blank', {name: '   '}],
    ['a name over 200 characters', {name: 'a'.repeat(201)}],
    ['an invalid email', {email: 'pas-une-adresse'}],
    ['a postal code that is not five digits', {postalCode: '9740'}],
    ['a phone with letters', {phone: 'appelez-moi'}],
    ['a city over 100 characters', {city: 'a'.repeat(101)}],
  ])('should refuse %s and write nothing', async (_label, part) => {
    await expect(
      createMemberProfileService({
        organizationId: ORG_ID,
        name: 'Claire Meunier',
        ...part,
      })
    ).rejects.toThrow()

    expect(createMemberProfileTxnDao).not.toHaveBeenCalled()
  })

  it('should update the contact details of a profile (critère 6)', async () => {
    let writtenUnder: string | undefined
    vi.mocked(updateMemberProfileContactTxnDao).mockImplementation(async () => {
      writtenUnder = scope.current
      return {
        status: 'updated',
        row: profileRow({phone: '0692 00 00 00', city: 'Saint-Paul'}),
      }
    })

    const result = await updateMemberProfileContactService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: '',
      phone: '0692 00 00 00',
      addressLine: '3 rue des Lilas',
      postalCode: '97460',
      city: 'Saint-Paul',
    })

    expect(updateMemberProfileContactTxnDao).toHaveBeenCalledWith(PROFILE_ID, {
      email: null,
      phone: '0692 00 00 00',
      addressLine: '3 rue des Lilas',
      addressComplement: null,
      postalCode: '97460',
      city: 'Saint-Paul',
    })
    expect(writtenUnder).toBe(ORG_ID)
    expect(result).toMatchObject({
      status: 'saved',
      profile: {phone: '0692 00 00 00'},
    })
    for (const dao of accountDaos()) {
      expect(dao).not.toHaveBeenCalled()
    }
  })

  it('should answer not_found when the profile to update does not exist', async () => {
    vi.mocked(updateMemberProfileContactTxnDao).mockResolvedValue({
      status: 'not_found',
    })

    expect(
      await updateMemberProfileContactService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
      })
    ).toEqual({status: 'not_found'})
  })

  it('should answer email_taken on update when another profile holds the email', async () => {
    vi.mocked(updateMemberProfileContactTxnDao).mockResolvedValue({
      status: 'email_taken',
    })
    vi.mocked(getMemberProfileByEmailDao).mockResolvedValue(
      profileRow({id: OTHER_PROFILE_ID, email: 'claire@example.org'})
    )

    expect(
      await updateMemberProfileContactService({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        email: 'claire@example.org',
      })
    ).toEqual({status: 'email_taken', memberProfileId: OTHER_PROFILE_ID})
  })

  it('should read a profile under the tenant scope, and nothing when it is absent', async () => {
    let readUnder: string | undefined
    vi.mocked(getMemberProfileByIdDao).mockImplementation(async () => {
      readUnder = scope.current
      return undefined
    })

    expect(await getMemberProfileService(ORG_ID, PROFILE_ID)).toBeUndefined()
    expect(readUnder).toBe(ORG_ID)
  })

  it('should page the list by 25, with the search and the counts of the association', async () => {
    vi.mocked(getMemberProfilePageDao).mockResolvedValue({
      rows: [
        {...profileRow(), currentParcelNumbers: ['30', '5', '6']},
        {
          ...profileRow({
            id: OTHER_PROFILE_ID,
            name: 'SCI Les Pins',
            addressLine: '1 allée des Pins',
          }),
          currentParcelNumbers: [],
        },
      ],
      total: 27,
    })
    vi.mocked(countMemberProfilesDao).mockResolvedValue({
      total: 412,
      incomplete: 1,
    })

    const page = await getMemberProfilePageService({
      organizationId: ORG_ID,
      page: 2,
      search: '  dub ',
    })

    expect(getMemberProfilePageDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      search: 'dub',
      limit: MEMBER_PROFILES_PAGE_SIZE,
      offset: MEMBER_PROFILES_PAGE_SIZE,
    })
    expect(countMemberProfilesDao).toHaveBeenCalledWith(ORG_ID)
    expect(page).toMatchObject({
      page: 2,
      pageSize: 25,
      total: 27,
      totalPages: 2,
      profileCount: 412,
      incompleteCount: 1,
    })
    expect(page.items.map((item) => item.currentParcelNumbers)).toEqual([
      ['5', '6', '30'],
      [],
    ])
    expect(page.items.map((item) => item.incomplete)).toEqual([true, false])
  })

  it('should treat a blank search as no search', async () => {
    await getMemberProfilePageService({
      organizationId: ORG_ID,
      page: 1,
      search: '   ',
    })

    expect(getMemberProfilePageDao).toHaveBeenCalledWith(
      expect.objectContaining({search: undefined, offset: 0})
    )
  })
})

const calls = {
  create: () =>
    createMemberProfileService({organizationId: ORG_ID, name: 'Paul Ferrand'}),
  updateContact: () =>
    updateMemberProfileContactService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      city: 'Saint-Paul',
    }),
  get: () => getMemberProfileService(ORG_ID, PROFILE_ID),
  getPage: () => getMemberProfilePageService({organizationId: ORG_ID, page: 1}),
}

describe.each([
  ['[ORGANIZATION MEMBER]', withRole(UserOrganizationRoleConst.MEMBER)],
  [
    '[USER NOT IN ORGANIZATION]',
    withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
  ],
  ['[PUBLIC]', undefined],
])('%s ne touche à aucune fiche', (_label, user) => {
  beforeEach(() => {
    setupAuthUserMocked(user)
  })

  it.each(Object.entries(calls))(
    'should refuse %s without calling any DAO',
    async (_name, call) => {
      await expect(call()).rejects.toThrow(AuthorizationError)

      for (const dao of profileDaos()) {
        expect(dao).not.toHaveBeenCalled()
      }
    }
  )
})

describe('canManageMemberProfilesService — qui gère les fiches', () => {
  it.each([
    ['[ORGANIZATION OWNER]', withRole(UserOrganizationRoleConst.OWNER), true],
    ['[ORGANIZATION ADMIN]', withRole(UserOrganizationRoleConst.ADMIN), true],
    [
      '[ORGANIZATION MEMBER]',
      withRole(UserOrganizationRoleConst.MEMBER),
      false,
    ],
    [
      '[USER NOT IN ORGANIZATION]',
      withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
      false,
    ],
    ['[PUBLIC]', undefined, false],
  ])('%s → %s', async (_label, user, expected) => {
    setupAuthUserMocked(user)

    expect(await canManageMemberProfilesService(ORG_ID)).toBe(expected)
  })

  it('should answer false for a malformed organization id, without throwing', async () => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))

    expect(await canManageMemberProfilesService('pas-un-uuid')).toBe(false)
  })
})
