import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/board-member-service-facade', () => ({
  createBoardMemberService: vi.fn(),
  removeBoardMemberService: vi.fn(),
  reorderBoardMembersService: vi.fn(),
  updateBoardMemberService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createBoardMemberService,
  removeBoardMemberService,
  reorderBoardMembersService,
  updateBoardMemberService,
} from '@/services/facades/board-member-service-facade'

import {
  createBoardMemberAction,
  removeBoardMemberAction,
  reorderBoardMembersAction,
  updateBoardMemberAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MEMBER_ID = '22222222-2222-4222-8222-222222222222'
const BOARD_TAG = `board-members:${TENANT_ID}`

const savedMember = {
  id: MEMBER_ID,
  organizationId: TENANT_ID,
  name: 'Claire Besson',
  roleLabel: 'Présidente',
  photoKey: null,
  biography: '',
  rank: 0,
}

const formOf = (entries: Record<string, string>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    formData.append(key, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(createBoardMemberService).mockResolvedValue({
    status: 'saved',
    member: savedMember,
  })
  vi.mocked(updateBoardMemberService).mockResolvedValue({
    status: 'saved',
    member: savedMember,
  })
  vi.mocked(reorderBoardMembersService).mockResolvedValue()
  vi.mocked(removeBoardMemberService).mockResolvedValue()
})

describe('Actions des fiches du bureau — succès', () => {
  it('crée une fiche et invalide les fiches de cette association', async () => {
    const result = await createBoardMemberAction(
      formOf({
        name: 'Claire Besson',
        roleLabel: 'Présidente',
        biography: 'Quelques phrases.',
      })
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(createBoardMemberService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      name: 'Claire Besson',
      roleLabel: 'Présidente',
      biography: 'Quelques phrases.',
      photo: undefined,
    })
    expect(result).toEqual({status: 'saved'})
    expect(updateTag).toHaveBeenCalledWith(BOARD_TAG)
  })

  it('modifie une fiche, retrait de photo compris', async () => {
    const result = await updateBoardMemberAction(
      formOf({
        memberId: MEMBER_ID,
        name: 'Claire Besson',
        roleLabel: 'Présidente',
        biography: '',
        removePhoto: 'true',
      })
    )

    expect(updateBoardMemberService).toHaveBeenCalledWith(
      expect.objectContaining({memberId: MEMBER_ID, removePhoto: true})
    )
    expect(result).toEqual({status: 'saved'})
    expect(updateTag).toHaveBeenCalledWith(BOARD_TAG)
  })

  it("écrit l'ordre reçu et invalide", async () => {
    const result = await reorderBoardMembersAction([MEMBER_ID, 'other'])

    expect(reorderBoardMembersService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      orderedIds: [MEMBER_ID, 'other'],
    })
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(BOARD_TAG)
  })

  it('supprime une fiche et invalide', async () => {
    const result = await removeBoardMemberAction(MEMBER_ID)

    expect(removeBoardMemberService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberId: MEMBER_ID,
    })
    expect(result).toEqual({status: 'ok'})
    expect(updateTag).toHaveBeenCalledWith(BOARD_TAG)
  })
})

describe('Actions des fiches du bureau — échec', () => {
  it("n'invalide rien quand la création échoue", async () => {
    vi.mocked(createBoardMemberService).mockRejectedValue(
      new AuthorizationError('refusé')
    )

    const result = await createBoardMemberAction(
      formOf({name: 'Claire', roleLabel: 'Présidente', biography: ''})
    )

    expect(result).toMatchObject({status: 'error'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("n'invalide rien quand le réordonnancement échoue", async () => {
    vi.mocked(reorderBoardMembersService).mockRejectedValue(
      new Error('base indisponible')
    )

    const result = await reorderBoardMembersAction([MEMBER_ID])

    expect(result).toMatchObject({status: 'error'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("n'invalide rien quand la suppression échoue", async () => {
    vi.mocked(removeBoardMemberService).mockRejectedValue(
      new Error('base indisponible')
    )

    const result = await removeBoardMemberAction(MEMBER_ID)

    expect(result).toMatchObject({status: 'error'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("rend le refus d'une photo comme un résultat, sans invalider", async () => {
    vi.mocked(createBoardMemberService).mockResolvedValue({
      status: 'rejected',
      reason: 'format',
    })

    const result = await createBoardMemberAction(
      formOf({name: 'Claire', roleLabel: 'Présidente', biography: ''})
    )

    expect(result).toEqual({status: 'rejected', reason: 'format'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})
