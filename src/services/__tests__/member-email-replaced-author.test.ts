import {createHash} from 'node:crypto'

import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Scenario de la revue s54, round 3 (C1-bis) : l'auteur d'une adresse en
 * attente perd l'acces a la fiche quand le bureau modifie son adresse ; son
 * lien ne doit plus rien activer. Les attentes et les liens fiche ↔ compte
 * vivent dans une petite base en memoire, que les DAO mockes lisent et
 * modifient, pour que les deux services se parlent comme en vrai.
 */
const store = vi.hoisted(() => ({
  pending: [] as Record<string, unknown>[],
  links: new Map<string, Set<string>>(),
}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/member-profile-email-repository', () => ({
  deletePendingEmailsAddedByDao: vi.fn(
    async (memberProfileId: string, userId: string) => {
      store.pending = store.pending.filter(
        (row) =>
          !(
            row.memberProfileId === memberProfileId &&
            row.addedByUserId === userId
          )
      )
    }
  ),
  deleteMemberProfileEmailDao: vi.fn(),
  getActiveEmailCarriersDao: vi.fn(async () => []),
  getMemberProfileEmailsByTokenHashDao: vi.fn(async (hash: string) =>
    store.pending.filter((row) => row.confirmationTokenHash === hash)
  ),
  getMemberProfileEmailsDao: vi.fn(),
  insertMemberProfileEmailDao: vi.fn(),
  purgeExpiredPendingEmailsDao: vi.fn(),
  setMemberProfileEmailRoleDao: vi.fn(),
  updateMemberProfileEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-profile-repository', () => ({
  countLinkedProfilesDao: vi.fn(async () => 0),
  getCurrentParcelNumbersByProfileDao: vi.fn(async () => ({})),
  getLinkedAccountsDao: vi.fn(),
  getMemberProfileByIdDao: vi.fn(),
  getMemberProfilesByEmailDao: vi.fn(async () => []),
  getMemberProfilesByUserIdDao: vi.fn(async (_org: string, userId: string) =>
    [...(store.links.get(userId) ?? [])].map((id) => ({id}))
  ),
  linkMemberProfileAccountDao: vi.fn(
    async ({
      memberProfileId,
      userId,
    }: {
      memberProfileId: string
      userId: string
    }) => {
      store.links.set(
        userId,
        new Set([...(store.links.get(userId) ?? []), memberProfileId])
      )
    }
  ),
  unlinkMemberProfileAccountDao: vi.fn(
    async (memberProfileId: string, userId: string) => {
      store.links.get(userId)?.delete(memberProfileId)
    }
  ),
  getUnlinkedMemberProfilesWithEmailDao: vi.fn(),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  createUserIfAbsentTxnDao: vi.fn(),
  getUserByEmailDao: vi.fn(async () => undefined),
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-role-event-repository', () => ({
  insertMemberRoleEventDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  createMemberIfAbsentTxnDao: vi.fn(async () => ({role: 'member'})),
  deleteMemberWithRoleDao: vi.fn(async () => 1),
  getMemberAccountDao: vi.fn(),
  getUserOrganizationDao: vi.fn(),
  lockOrganizationRolesDao: vi.fn(),
  updateMemberRoleFromDao: vi.fn(),
}))

import {
  getMemberProfileEmailsDao,
  updateMemberProfileEmailDao,
} from '@/db/repositories/member-profile-email-repository'
import {
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  linkMemberProfileAccountDao,
} from '@/db/repositories/member-profile-repository'
import {
  getMemberAccountDao,
  getUserOrganizationDao,
} from '@/db/repositories/organization-repository'
import {
  createUserIfAbsentTxnDao,
  getUserByIdDao,
} from '@/db/repositories/user-repository'

import {getActingContext} from '../authentication/auth-service'
import {
  confirmMemberEmailService,
  getMemberEmailConfirmationStateService,
} from '../member-email-confirmation-service'
import {updateMemberProfileEmailService} from '../member-profile-email-service'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const O_USER_ID = '55555555-5555-4555-8555-555555555555'
const N_USER_ID = '77777777-7777-4777-8777-777777777777'
const O_EMAIL_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const X_PENDING_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')
const HASH = createHash('sha256').update(TOKEN).digest('hex')

const board: User = {
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId: ORG_ID,
      userId: userTest.id,
      role: 'board',
      createdAt: new Date(),
    },
  ],
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

const oEmail = emailRow({id: O_EMAIL_ID, email: 'o@exemple.fr'})
const xPending = emailRow({
  id: X_PENDING_ID,
  email: 'x@exemple.fr',
  status: 'pending',
  addedByUserId: O_USER_ID,
  addedByName: 'Odile',
  confirmationTokenHash: HASH,
  expiresAt: new Date('2999-01-01T00:00:00Z'),
})

beforeEach(() => {
  vi.clearAllMocks()
  store.pending = [xPending]
  store.links = new Map([[O_USER_ID, new Set([PROFILE_ID])]])
  setupAuthUserMocked(board)
  vi.mocked(getActingContext).mockResolvedValue(undefined)
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue({
    id: PROFILE_ID,
    organizationId: ORG_ID,
    name: 'Odile Marchand',
  } as never)
  vi.mocked(getMemberProfileEmailsDao).mockImplementation(
    async () => [oEmail, ...store.pending] as never
  )
  vi.mocked(getLinkedAccountsDao).mockResolvedValue([
    {userId: O_USER_ID, email: 'o@exemple.fr', name: 'Odile'},
  ])
  vi.mocked(getMemberAccountDao).mockResolvedValue({
    email: 'o@exemple.fr',
    name: 'Odile',
    role: 'member',
  } as never)
  vi.mocked(getUserOrganizationDao).mockResolvedValue({
    id: 'm',
    organizationId: ORG_ID,
    userId: O_USER_ID,
    role: 'member',
    createdAt: new Date(),
  } as never)
  vi.mocked(createUserIfAbsentTxnDao).mockResolvedValue({id: N_USER_ID})
  vi.mocked(getUserByIdDao).mockResolvedValue({
    id: O_USER_ID,
    name: 'Odile',
  } as never)
})

describe('[BUREAU puis PUBLIC] le bureau modifie l’adresse de l’auteur d’une attente (revue s54 round 3, C1-bis)', () => {
  it('O ajoute X ; le bureau change l’adresse de O en N ; O clique le lien de X → 3c, rien n’est activé, aucun compte relié', async () => {
    const edited = await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: O_EMAIL_ID,
      email: 'n@exemple.fr',
    })
    expect(edited.status).toBe('saved')
    vi.mocked(updateMemberProfileEmailDao).mockClear()
    vi.mocked(linkMemberProfileAccountDao).mockClear()
    vi.mocked(createUserIfAbsentTxnDao).mockClear()

    await expect(
      confirmMemberEmailService({organizationId: ORG_ID, token: TOKEN})
    ).resolves.toEqual({status: 'invalid'})
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
    expect(store.pending).toEqual([])
  })
})

describe('[SUPERADMIN puis PUBLIC] l’auteur d’une attente reste relié à la fiche sans ligne member (revue s54 round 4, MA-r4)', () => {
  beforeEach(() => {
    vi.mocked(getUserOrganizationDao).mockResolvedValue(undefined)
  })

  it('sonde de la revue : le bureau change l’adresse de O en N ; O clique le lien de X → 3c, rien n’est activé, aucun compte relié', async () => {
    const edited = await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: O_EMAIL_ID,
      email: 'n@exemple.fr',
    })
    expect(edited.status).toBe('saved')
    vi.mocked(updateMemberProfileEmailDao).mockClear()
    vi.mocked(linkMemberProfileAccountDao).mockClear()
    vi.mocked(createUserIfAbsentTxnDao).mockClear()

    await expect(
      confirmMemberEmailService({organizationId: ORG_ID, token: TOKEN})
    ).resolves.toEqual({status: 'invalid'})
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('sans modification par le bureau : O, toujours relié à la fiche mais plus membre, clique le lien de X → 3c, à la lecture comme à la confirmation', async () => {
    await expect(
      getMemberEmailConfirmationStateService({
        organizationId: ORG_ID,
        token: TOKEN,
      })
    ).resolves.toEqual({status: 'invalid'})
    await expect(
      confirmMemberEmailService({organizationId: ORG_ID, token: TOKEN})
    ).resolves.toEqual({status: 'invalid'})
    expect(getUserOrganizationDao).toHaveBeenCalledWith(O_USER_ID, ORG_ID)
    expect(updateMemberProfileEmailDao).not.toHaveBeenCalled()
    expect(linkMemberProfileAccountDao).not.toHaveBeenCalled()
    expect(createUserIfAbsentTxnDao).not.toHaveBeenCalled()
  })

  it('le bureau change l’adresse de O en N : O est délié de la fiche et ses attentes sur la fiche sont supprimées', async () => {
    const edited = await updateMemberProfileEmailService({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      emailId: O_EMAIL_ID,
      email: 'n@exemple.fr',
    })

    expect(edited.status).toBe('saved')
    expect(store.links.get(O_USER_ID)?.has(PROFILE_ID)).toBe(false)
    expect(store.links.get(N_USER_ID)?.has(PROFILE_ID)).toBe(true)
    expect(store.pending).toEqual([])
  })
})
