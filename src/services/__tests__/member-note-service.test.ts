import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

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
  getMemberProfileByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/member-note-repository', () => ({
  getMemberNotesPageDao: vi.fn(),
  createMemberNoteTxnDao: vi.fn(),
  updateMemberNoteTxnDao: vi.fn(),
  deleteMemberNoteTxnDao: vi.fn(),
}))

import {
  createMemberNoteTxnDao,
  deleteMemberNoteTxnDao,
  getMemberNotesPageDao,
  updateMemberNoteTxnDao,
} from '@/db/repositories/member-note-repository'
import {getMemberProfileByIdDao} from '@/db/repositories/member-profile-repository'
import {withTenant} from '@/db/tenant-scope'

import {getActingContext} from '../authentication/auth-service'
import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  addMemberExchangeService,
  addMemberNoteService,
  deleteMemberNoteService,
  listMemberNotesService,
  updateMemberExchangeService,
  updateMemberNoteService,
} from '../member-note-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {MEMBER_NOTES_PAGE_SIZE} from '../types/domain/member-note-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const NOTE_ID = '44444444-4444-4444-8444-444444444444'
const ADMIN_ID = '77777777-7777-4777-8777-777777777777'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  name: 'Marie Delorme',
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
const plainMember = withRole(UserOrganizationRoleConst.MEMBER)

const profileRow = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  organizationId: ORG_ID,
  name: 'Jean et Odile Dubois',
  userId: null as string | null,
  ...overrides,
})

const noteRow = (overrides: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  kind: 'note' as const,
  channel: null,
  entryDate: '2026-11-09',
  body: 'Souhaite être prévenu des travaux.',
  authorName: 'Marie Delorme',
  createdAt: new Date('2026-11-09T10:00:00.000Z'),
  updatedAt: null,
  ...overrides,
})

const scopeInput = {organizationId: ORG_ID, memberProfileId: PROFILE_ID}

/** Les six portes du service, appelées avec une entrée valide. */
const calls: [string, () => Promise<unknown>][] = [
  ['lire le fil', () => listMemberNotesService({...scopeInput, page: 1})],
  ['ajouter une note', () => addMemberNoteService({...scopeInput, body: 'x'})],
  [
    'consigner un échange',
    () =>
      addMemberExchangeService({
        ...scopeInput,
        body: 'x',
        channel: 'phone',
        entryDate: '2026-11-01',
      }),
  ],
  [
    'modifier une note',
    () => updateMemberNoteService({...scopeInput, noteId: NOTE_ID, body: 'x'}),
  ],
  [
    'modifier un échange',
    () =>
      updateMemberExchangeService({
        ...scopeInput,
        noteId: NOTE_ID,
        body: 'x',
        channel: 'mail',
        entryDate: '2026-11-01',
      }),
  ],
  [
    'supprimer une entrée',
    () => deleteMemberNoteService({...scopeInput, noteId: NOTE_ID}),
  ],
]

const expectNoDaoCall = () => {
  expect(getMemberProfileByIdDao).not.toHaveBeenCalled()
  expect(getMemberNotesPageDao).not.toHaveBeenCalled()
  expect(createMemberNoteTxnDao).not.toHaveBeenCalled()
  expect(updateMemberNoteTxnDao).not.toHaveBeenCalled()
  expect(deleteMemberNoteTxnDao).not.toHaveBeenCalled()
  expect(withTenant).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(new Date('2026-11-09T22:30:00.000Z'))
  vi.mocked(getActingContext).mockResolvedValue(undefined)
  vi.mocked(getMemberProfileByIdDao).mockResolvedValue(profileRow() as never)
  vi.mocked(getMemberNotesPageDao).mockResolvedValue({
    rows: [noteRow()],
    total: 1,
  })
  vi.mocked(createMemberNoteTxnDao).mockResolvedValue(noteRow())
  vi.mocked(updateMemberNoteTxnDao).mockResolvedValue(noteRow())
  vi.mocked(deleteMemberNoteTxnDao).mockResolvedValue({id: NOTE_ID})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('critère 4 — aucun accès hors du bureau de l’association', () => {
  describe.each(calls)('%s', (_label, call) => {
    it('[GUEST] refuse un visiteur sans session, sans appel au DAO', async () => {
      await setupAuthUserMocked(undefined)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[ORGANIZATION MEMBER] refuse un membre simple, sans appel au DAO', async () => {
      await setupAuthUserMocked(plainMember)
      vi.mocked(getActingContext).mockResolvedValue({user: plainMember})

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[USER NOT IN ORGANIZATION] refuse le bureau d’une autre association', async () => {
      const otherBoard = withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID)
      await setupAuthUserMocked(otherBoard)

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })

    it('[SUPER_ADMIN À LA PLACE D’UN MEMBRE] refuse : le compte vu est jugé', async () => {
      await setupAuthUserMocked(plainMember)
      vi.mocked(getActingContext).mockResolvedValue({
        user: plainMember,
        impersonator: {id: ADMIN_ID, name: 'Zourite Studio'},
      })

      await expect(call()).rejects.toBeInstanceOf(AuthorizationError)
      expectNoDaoCall()
    })
  })

  it('[SUPER_ADMIN] autorise le SuperAdmin hors imitation', async () => {
    await setupAuthUserMocked(userTestSuperAdmin)

    await expect(
      listMemberNotesService({...scopeInput, page: 1})
    ).resolves.toBeDefined()
  })

  it('[ORGANIZATION BOARD] un membre du bureau lit les notes de sa propre fiche', async () => {
    await setupAuthUserMocked(board)
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(
      profileRow({userId: board.id}) as never
    )

    const page = await listMemberNotesService({...scopeInput, page: 1})

    expect(page?.items).toHaveLength(1)
  })
})

describe('listMemberNotesService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('lit la page demandée sous le scope du tenant, en DTO sans champ interne', async () => {
    vi.mocked(getMemberNotesPageDao).mockImplementation(async () => {
      expect(scope.current).toBe(ORG_ID)
      return {rows: [noteRow()], total: 23}
    })

    const page = await listMemberNotesService({...scopeInput, page: 2})

    expect(getMemberNotesPageDao).toHaveBeenCalledWith(PROFILE_ID, {
      limit: MEMBER_NOTES_PAGE_SIZE,
      offset: MEMBER_NOTES_PAGE_SIZE,
    })
    expect(page).toEqual({
      items: [
        {
          id: NOTE_ID,
          kind: 'note',
          channel: null,
          entryDate: '2026-11-09',
          body: 'Souhaite être prévenu des travaux.',
          authorName: 'Marie Delorme',
          createdAt: '2026-11-09T10:00:00.000Z',
          updatedAt: null,
        },
      ],
      page: 2,
      pageSize: MEMBER_NOTES_PAGE_SIZE,
      total: 23,
      totalPages: 3,
    })
  })

  it('ne lit rien pour une fiche introuvable (autre association)', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    await expect(
      listMemberNotesService({...scopeInput, page: 1})
    ).resolves.toBeUndefined()
    expect(getMemberNotesPageDao).not.toHaveBeenCalled()
  })

  it('refuse une page invalide avant toute lecture', async () => {
    await expect(
      listMemberNotesService({...scopeInput, page: 0})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expectNoDaoCall()
  })
})

describe('addMemberNoteService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('écrit une note du jour de Paris, signée par le compte connecté', async () => {
    const result = await addMemberNoteService({
      ...scopeInput,
      body: 'Souhaite être prévenu des travaux.',
    })

    expect(createMemberNoteTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      kind: 'note',
      channel: null,
      entryDate: '2026-11-09',
      body: 'Souhaite être prévenu des travaux.',
      authorUserId: board.id,
      authorName: 'Marie Delorme',
      onBehalfOfUserId: null,
      onBehalfOfName: null,
    })
    expect(result).toEqual({
      status: 'saved',
      note: expect.objectContaining({id: NOTE_ID, kind: 'note'}),
    })
  })

  it('lit l’auteur avant d’ouvrir le scope du tenant', async () => {
    vi.mocked(getActingContext).mockImplementation(async () => {
      expect(scope.current).toBeUndefined()
      return {user: board}
    })

    await addMemberNoteService({...scopeInput, body: 'Texte'})

    expect(getActingContext).toHaveBeenCalled()
  })

  it('signe au nom du SuperAdmin quand il agit à la place du bureau', async () => {
    vi.mocked(getActingContext).mockResolvedValue({
      user: board,
      impersonator: {id: ADMIN_ID, name: 'Zourite Studio'},
    })

    await addMemberNoteService({...scopeInput, body: 'Texte'})

    expect(createMemberNoteTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        authorUserId: ADMIN_ID,
        authorName: 'Zourite Studio',
        onBehalfOfUserId: board.id,
        onBehalfOfName: 'Marie Delorme',
      })
    )
  })

  it('ignore auteur, type et canal glissés dans l’entrée', async () => {
    await addMemberNoteService({
      ...scopeInput,
      body: 'Texte',
      authorUserId: ADMIN_ID,
      authorName: 'Usurpateur',
      kind: 'exchange',
      channel: 'phone',
      entryDate: '2020-01-01',
    } as never)

    expect(createMemberNoteTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        kind: 'note',
        channel: null,
        entryDate: '2026-11-09',
        authorUserId: board.id,
        authorName: 'Marie Delorme',
      })
    )
  })

  it('n’écrit rien sur une fiche introuvable', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    const result = await addMemberNoteService({...scopeInput, body: 'Texte'})

    expect(result).toEqual({status: 'not_found'})
    expect(createMemberNoteTxnDao).not.toHaveBeenCalled()
  })

  it('refuse un texte vide sans rien lire ni écrire', async () => {
    await expect(
      addMemberNoteService({...scopeInput, body: '   '})
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expectNoDaoCall()
  })
})

describe('addMemberExchangeService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('écrit un échange au jour choisi, avec son canal', async () => {
    await addMemberExchangeService({
      ...scopeInput,
      body: 'Appelé au sujet du portail.',
      channel: 'phone',
      entryDate: '2026-03-12',
    })

    expect(createMemberNoteTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'exchange',
        channel: 'phone',
        entryDate: '2026-03-12',
        body: 'Appelé au sujet du portail.',
      })
    )
  })

  it('refuse un jour futur sans rien écrire', async () => {
    await expect(
      addMemberExchangeService({
        ...scopeInput,
        body: 'Texte',
        channel: 'phone',
        entryDate: '2026-11-11',
      })
    ).rejects.toBeInstanceOf(ValidationParsedZodError)
    expectNoDaoCall()
  })
})

describe('updateMemberNoteService / updateMemberExchangeService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('modifie le texte d’une note, scopée par son type', async () => {
    const result = await updateMemberNoteService({
      ...scopeInput,
      noteId: NOTE_ID,
      body: 'Nouveau texte',
    })

    expect(updateMemberNoteTxnDao).toHaveBeenCalledWith(
      NOTE_ID,
      PROFILE_ID,
      'note',
      {body: 'Nouveau texte'}
    )
    expect(result).toMatchObject({status: 'saved'})
  })

  it('modifie les trois champs d’un échange, scopé par son type', async () => {
    await updateMemberExchangeService({
      ...scopeInput,
      noteId: NOTE_ID,
      body: 'Nouveau résumé',
      channel: 'in_person',
      entryDate: '2026-10-01',
    })

    expect(updateMemberNoteTxnDao).toHaveBeenCalledWith(
      NOTE_ID,
      PROFILE_ID,
      'exchange',
      {body: 'Nouveau résumé', channel: 'in_person', entryDate: '2026-10-01'}
    )
  })

  it('rend not_found quand on modifie un échange avec l’id d’une note', async () => {
    vi.mocked(updateMemberNoteTxnDao).mockResolvedValue(undefined)

    const result = await updateMemberExchangeService({
      ...scopeInput,
      noteId: NOTE_ID,
      body: 'Texte',
      channel: 'mail',
      entryDate: '2026-10-01',
    })

    expect(result).toEqual({status: 'not_found'})
  })

  it('n’écrit rien sur une fiche introuvable', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    const result = await updateMemberNoteService({
      ...scopeInput,
      noteId: NOTE_ID,
      body: 'Texte',
    })

    expect(result).toEqual({status: 'not_found'})
    expect(updateMemberNoteTxnDao).not.toHaveBeenCalled()
  })
})

describe('deleteMemberNoteService', () => {
  beforeEach(async () => {
    await setupAuthUserMocked(board)
  })

  it('supprime l’entrée de la fiche', async () => {
    const result = await deleteMemberNoteService({
      ...scopeInput,
      noteId: NOTE_ID,
    })

    expect(deleteMemberNoteTxnDao).toHaveBeenCalledWith(NOTE_ID, PROFILE_ID)
    expect(result).toEqual({status: 'deleted'})
  })

  it('rend not_found quand l’entrée n’existe pas', async () => {
    vi.mocked(deleteMemberNoteTxnDao).mockResolvedValue(undefined)

    await expect(
      deleteMemberNoteService({...scopeInput, noteId: NOTE_ID})
    ).resolves.toEqual({status: 'not_found'})
  })

  it('ne supprime rien sur une fiche introuvable', async () => {
    vi.mocked(getMemberProfileByIdDao).mockResolvedValue(undefined)

    await expect(
      deleteMemberNoteService({...scopeInput, noteId: NOTE_ID})
    ).resolves.toEqual({status: 'not_found'})
    expect(deleteMemberNoteTxnDao).not.toHaveBeenCalled()
  })
})
