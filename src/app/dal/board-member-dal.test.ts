import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/board-member-service-facade', () => ({
  canManageBoardMembersService: vi.fn(),
  getBoardMembersForBureauService: vi.fn(),
  getBoardMembersService: vi.fn(),
}))

import {cacheTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageBoardMembersService,
  getBoardMembersForBureauService,
  getBoardMembersService,
} from '@/services/facades/board-member-service-facade'
import {BoardMemberDTO} from '@/services/types/domain/board-member-types'

import {
  boardMemberPhotoUrl,
  boardMembersTag,
  canManageCurrentBoardMembersDal,
  getBoardMembersForBureauDal,
  getPublicBoardMembersDal,
} from './board-member-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const member = (id: string, rank: number): BoardMemberDTO => ({
  id,
  organizationId: ORG_A,
  name: `Personne ${rank}`,
  roleLabel: 'Membre du bureau',
  photoKey: null,
  biography: '',
  rank,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBoardMembersService).mockResolvedValue([])
})

describe('tag de cache', () => {
  it('un seul tag par association — la liste n’est ni paginée ni filtrée', () => {
    expect(boardMembersTag(ORG_A)).toBe(`board-members:${ORG_A}`)
    expect(boardMembersTag(ORG_A)).not.toBe(boardMembersTag(ORG_B))
  })
})

describe('getPublicBoardMembersDal', () => {
  it("rend les fiches dans l'ordre des rangs, sous le tag de l'association", async () => {
    vi.mocked(getBoardMembersService).mockResolvedValue([
      member('a', 0),
      member('b', 1),
      member('c', 2),
    ])

    const members = await getPublicBoardMembersDal(ORG_A)

    expect(members.map((row) => row.rank)).toEqual([0, 1, 2])
    expect(getBoardMembersService).toHaveBeenCalledWith(ORG_A)
    expect(cacheTag).toHaveBeenCalledWith(boardMembersTag(ORG_A))
  })

  it('rend une liste vide pour une association sans fiche, pas une erreur', async () => {
    await expect(getPublicBoardMembersDal(ORG_A)).resolves.toEqual([])
  })
})

describe('getBoardMembersForBureauDal', () => {
  it('lit la liste de gestion sans la cacher', async () => {
    vi.mocked(getBoardMembersForBureauService).mockResolvedValue([
      member('a', 0),
    ])

    const members = await getBoardMembersForBureauDal(ORG_A)

    expect(members).toHaveLength(1)
    expect(getBoardMembersForBureauService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('canManageCurrentBoardMembersDal', () => {
  it("interroge l'association du domaine appelé", async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({
      id: ORG_A,
    } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
    vi.mocked(canManageBoardMembersService).mockResolvedValue(true)

    await expect(canManageCurrentBoardMembersDal()).resolves.toBe(true)
    expect(canManageBoardMembersService).toHaveBeenCalledWith(ORG_A)
  })
})

describe('boardMemberPhotoUrl', () => {
  it('pointe vers la route de fichiers de contenu', () => {
    expect(boardMemberPhotoUrl(`${ORG_A}/board/abc/photo-1.webp`)).toBe(
      `/api/files/${ORG_A}/board/abc/photo-1.webp`
    )
  })
})
