import fs from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))
const resize = vi.hoisted(() => ({
  resizeToSquareWebp: vi.fn(),
}))

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
vi.mock('@/db/repositories/board-member-repository', () => ({
  addBoardMemberDao: vi.fn(),
  getBoardMemberByIdDao: vi.fn(),
  getBoardMembersByOrganizationDao: vi.fn(),
  removeBoardMemberAndRenumberTxnDao: vi.fn(),
  reorderBoardMembersTxnDao: vi.fn(),
  updateBoardMemberDao: vi.fn(),
}))
vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))
vi.mock('@/lib/files/resize-image', () => resize)

import {
  addBoardMemberDao,
  getBoardMemberByIdDao,
  getBoardMembersByOrganizationDao,
  removeBoardMemberAndRenumberTxnDao,
  reorderBoardMembersTxnDao,
  updateBoardMemberDao,
} from '@/db/repositories/board-member-repository'

import {
  canManageBoardMembersService,
  createBoardMemberService,
  getBoardMembersForBureauService,
  getBoardMembersService,
  removeBoardMemberService,
  reorderBoardMembersService,
  updateBoardMemberService,
} from '../board-member-service'
import {AuthorizationError} from '../errors/authorization-error'
import {BoardMemberDTO} from '../types/domain/board-member-types'
import {CONTENT_FILE_MAX_BYTES} from '../types/domain/content-file-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const MEMBER_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_MEMBER_ID = '44444444-4444-4444-8444-444444444444'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
])
const WEBP_BYTES = new Uint8Array([0x77, 0x65, 0x62, 0x70])

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

const memberRow = (overrides: Partial<BoardMemberDTO> = {}) => ({
  id: MEMBER_ID,
  organizationId: ORG_ID,
  name: 'Claire Besson',
  roleLabel: 'Présidente',
  photoKey: null as string | null,
  biography: '',
  rank: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const portrait = (bytes: Uint8Array = PNG_BYTES) =>
  new File([bytes as BlobPart], 'portrait.png', {type: 'image/png'})

const validInput = {
  organizationId: ORG_ID,
  name: 'Claire Besson',
  roleLabel: 'Présidente',
  biography: 'Quelques phrases.',
}

const resetMocks = () => {
  vi.clearAllMocks()
  resize.resizeToSquareWebp.mockResolvedValue(WEBP_BYTES)
  storage.upload.mockResolvedValue({path: 'ok'})
  storage.delete.mockResolvedValue(undefined)
  vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([])
  vi.mocked(addBoardMemberDao).mockResolvedValue(memberRow())
  vi.mocked(updateBoardMemberDao).mockResolvedValue(memberRow())
  vi.mocked(getBoardMemberByIdDao).mockResolvedValue(memberRow())
  vi.mocked(removeBoardMemberAndRenumberTxnDao).mockResolvedValue({
    photoKey: null,
  })
  vi.mocked(reorderBoardMembersTxnDao).mockResolvedValue(undefined)
}

describe('[ORGANIZATION OWNER] CRUD : BoardMemberService', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('owner'))
    resetMocks()
  })

  it('crée une fiche sans photo, au rang suivant', async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: OTHER_MEMBER_ID, rank: 0}),
      memberRow({id: MEMBER_ID, rank: 1}),
    ])

    const result = await createBoardMemberService(validInput)

    expect(result).toMatchObject({status: 'saved'})
    expect(addBoardMemberDao).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_ID, rank: 2, photoKey: null})
    )
    expect(storage.upload).not.toHaveBeenCalled()
  })

  it('redimensionne la photo avant de l’écrire, jamais après', async () => {
    const order: string[] = []
    resize.resizeToSquareWebp.mockImplementation(async () => {
      order.push('resize')
      return WEBP_BYTES
    })
    storage.upload.mockImplementation(async () => {
      order.push('upload')
      return {path: 'ok'}
    })

    await createBoardMemberService({...validInput, photo: portrait()})

    expect(order).toEqual(['resize', 'upload'])
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.stringMatching(
        new RegExp(`^${ORG_ID}/board/${MEMBER_ID}/photo-[0-9a-f-]{36}\\.webp$`)
      )
    )
    expect(updateBoardMemberDao).toHaveBeenCalledWith(
      MEMBER_ID,
      expect.objectContaining({
        photoKey: expect.stringContaining(`${ORG_ID}/board/${MEMBER_ID}/`),
      })
    )
  })

  it("refuse un fichier qui n'est pas une image, sans rien écrire", async () => {
    const result = await createBoardMemberService({
      ...validInput,
      photo: new File([new TextEncoder().encode('pdf?')], 'x.png', {
        type: 'image/png',
      }),
    })

    expect(result).toMatchObject({status: 'rejected', reason: 'format'})
    expect(resize.resizeToSquareWebp).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(addBoardMemberDao).not.toHaveBeenCalled()
  })

  it('refuse un nom vide, sans toucher à la base', async () => {
    await expect(
      createBoardMemberService({...validInput, name: '   '})
    ).rejects.toThrow()
    expect(addBoardMemberDao).not.toHaveBeenCalled()
  })

  it('refuse une biographie au-delà de 500 caractères', async () => {
    await expect(
      createBoardMemberService({...validInput, biography: 'a'.repeat(501)})
    ).rejects.toThrow()
    expect(addBoardMemberDao).not.toHaveBeenCalled()
  })

  it("efface l'ancienne photo après la mise à jour en base", async () => {
    const order: string[] = []
    vi.mocked(getBoardMemberByIdDao).mockResolvedValue(
      memberRow({photoKey: `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`})
    )
    vi.mocked(updateBoardMemberDao).mockImplementation(async () => {
      order.push('update')
      return memberRow()
    })
    storage.delete.mockImplementation(async () => {
      order.push('delete')
    })

    await updateBoardMemberService({
      ...validInput,
      memberId: MEMBER_ID,
      photo: portrait(),
    })

    expect(order).toEqual(['update', 'delete'])
    expect(storage.delete).toHaveBeenCalledWith(
      `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`
    )
  })

  it("n'échoue pas quand l'effacement de l'ancienne photo échoue", async () => {
    vi.mocked(getBoardMemberByIdDao).mockResolvedValue(
      memberRow({photoKey: `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`})
    )
    storage.delete.mockRejectedValue(new Error('disque plein'))

    const result = await updateBoardMemberService({
      ...validInput,
      memberId: MEMBER_ID,
      photo: portrait(),
    })

    expect(result).toMatchObject({status: 'saved'})
  })

  it('retire la photo sur demande et efface le fichier', async () => {
    vi.mocked(getBoardMemberByIdDao).mockResolvedValue(
      memberRow({photoKey: `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`})
    )

    await updateBoardMemberService({
      ...validInput,
      memberId: MEMBER_ID,
      removePhoto: true,
    })

    expect(updateBoardMemberDao).toHaveBeenCalledWith(
      MEMBER_ID,
      expect.objectContaining({photoKey: null})
    )
    expect(storage.delete).toHaveBeenCalledWith(
      `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`
    )
  })

  it('garde la photo quand le formulaire n’en dépose aucune', async () => {
    const previous = `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`
    vi.mocked(getBoardMemberByIdDao).mockResolvedValue(
      memberRow({photoKey: previous})
    )

    await updateBoardMemberService({...validInput, memberId: MEMBER_ID})

    expect(updateBoardMemberDao).toHaveBeenCalledWith(
      MEMBER_ID,
      expect.objectContaining({photoKey: previous})
    )
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('supprime, renumérote une seule fois, puis efface la photo', async () => {
    vi.mocked(removeBoardMemberAndRenumberTxnDao).mockResolvedValue({
      photoKey: `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`,
    })

    await removeBoardMemberService({
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
    })

    expect(removeBoardMemberAndRenumberTxnDao).toHaveBeenCalledTimes(1)
    expect(removeBoardMemberAndRenumberTxnDao).toHaveBeenCalledWith(
      ORG_ID,
      MEMBER_ID
    )
    expect(storage.delete).toHaveBeenCalledWith(
      `${ORG_ID}/board/${MEMBER_ID}/photo-old.webp`
    )
  })

  it("transmet l'ordre reçu, identifiant par identifiant", async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: MEMBER_ID, rank: 0}),
      memberRow({id: OTHER_MEMBER_ID, rank: 1}),
    ])

    await reorderBoardMembersService({
      organizationId: ORG_ID,
      orderedIds: [OTHER_MEMBER_ID, MEMBER_ID],
    })

    expect(reorderBoardMembersTxnDao).toHaveBeenCalledWith(ORG_ID, [
      OTHER_MEMBER_ID,
      MEMBER_ID,
    ])
  })

  it("refuse un identifiant étranger à l'association", async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: MEMBER_ID, rank: 0}),
    ])

    await expect(
      reorderBoardMembersService({
        organizationId: ORG_ID,
        orderedIds: [MEMBER_ID, OTHER_MEMBER_ID],
      })
    ).rejects.toThrow()
    expect(reorderBoardMembersTxnDao).not.toHaveBeenCalled()
  })

  it('lit la liste du bureau dans son ordre', async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: MEMBER_ID, rank: 0}),
      memberRow({id: OTHER_MEMBER_ID, rank: 1}),
    ])

    const members = await getBoardMembersForBureauService(ORG_ID)

    expect(members.map((member) => member.id)).toEqual([
      MEMBER_ID,
      OTHER_MEMBER_ID,
    ])
  })
})

describe('[ORGANIZATION ADMIN] CRUD : BoardMemberService', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole('board'))
    resetMocks()
  })

  it('le bureau exerce les quatre verbes', async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: MEMBER_ID, rank: 0}),
    ])

    await expect(createBoardMemberService(validInput)).resolves.toMatchObject({
      status: 'saved',
    })
    await expect(
      updateBoardMemberService({...validInput, memberId: MEMBER_ID})
    ).resolves.toMatchObject({status: 'saved'})
    await expect(
      reorderBoardMembersService({
        organizationId: ORG_ID,
        orderedIds: [MEMBER_ID],
      })
    ).resolves.toBeUndefined()
    await expect(
      removeBoardMemberService({organizationId: ORG_ID, memberId: MEMBER_ID})
    ).resolves.toBeUndefined()
  })
})

describe.each([
  ['[ORGANIZATION MEMBER]', () => withRole('member')],
  ['[USER NOT IN ORGANIZATION]', () => withRole('owner', OTHER_ORG_ID)],
  ['[PUBLIC]', () => undefined],
])('%s : BoardMemberService refuse toute écriture', (_label, makeUser) => {
  beforeEach(() => {
    setupAuthUserMocked(makeUser())
    resetMocks()
  })

  it('refuse la création, sans écrire ni fichier ni ligne', async () => {
    await expect(
      createBoardMemberService({...validInput, photo: portrait()})
    ).rejects.toThrow(AuthorizationError)
    expect(addBoardMemberDao).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(resize.resizeToSquareWebp).not.toHaveBeenCalled()
  })

  it('refuse la modification, le réordonnancement et la suppression', async () => {
    await expect(
      updateBoardMemberService({...validInput, memberId: MEMBER_ID})
    ).rejects.toThrow(AuthorizationError)
    await expect(
      reorderBoardMembersService({
        organizationId: ORG_ID,
        orderedIds: [MEMBER_ID],
      })
    ).rejects.toThrow(AuthorizationError)
    await expect(
      removeBoardMemberService({organizationId: ORG_ID, memberId: MEMBER_ID})
    ).rejects.toThrow(AuthorizationError)

    expect(updateBoardMemberDao).not.toHaveBeenCalled()
    expect(reorderBoardMembersTxnDao).not.toHaveBeenCalled()
    expect(removeBoardMemberAndRenumberTxnDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('refuse la liste du bureau', async () => {
    await expect(getBoardMembersForBureauService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('ne se dit pas gestionnaire', async () => {
    await expect(canManageBoardMembersService(ORG_ID)).resolves.toBe(false)
  })
})

describe('lecture publique', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
    resetMocks()
  })

  it("ne demande aucune autorisation, et rend l'ordre des rangs", async () => {
    vi.mocked(getBoardMembersByOrganizationDao).mockResolvedValue([
      memberRow({id: MEMBER_ID, rank: 0}),
      memberRow({id: OTHER_MEMBER_ID, rank: 1}),
    ])

    const members = await getBoardMembersService(ORG_ID)

    expect(members.map((member) => member.id)).toEqual([
      MEMBER_ID,
      OTHER_MEMBER_ID,
    ])
  })

  it('rend une liste vide pour une association sans fiche', async () => {
    await expect(getBoardMembersService(ORG_ID)).resolves.toEqual([])
  })
})

describe('plafond de téléversement (next.config.ts)', () => {
  const parseSize = (literal: string): number => {
    const match = literal.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)$/i)
    if (!match) throw new Error(`Taille illisible : ${literal}`)
    const units: Record<string, number> = {
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    }
    return Number(match[1]) * units[match[2].toLowerCase()]
  }

  it("dépasse le plafond d'une image, sinon le message « Il pèse… » n'est jamais rendu", () => {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../../next.config.ts'),
      'utf8'
    )
    const match = source.match(/bodySizeLimit:\s*'([^']+)'/)

    expect(
      match,
      'bodySizeLimit introuvable dans next.config.ts'
    ).not.toBeNull()
    expect(parseSize(match?.[1] ?? '')).toBeGreaterThanOrEqual(
      CONTENT_FILE_MAX_BYTES.image
    )
  })
})
