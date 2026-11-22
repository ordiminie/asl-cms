import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error('NEXT_REDIRECT'), {digest: 'NEXT_REDIRECT'})
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/shared-document-service-facade', () => ({
  deleteSharedDocumentService: vi.fn(),
  publishSharedDocumentService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  deleteSharedDocumentService,
  publishSharedDocumentService,
} from '@/services/facades/shared-document-service-facade'
import {SharedDocumentIssueConst} from '@/services/types/domain/shared-document-types'

import {
  deleteSharedDocumentAction,
  publishSharedDocumentAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'statuts.pdf')

const publishForm = (overrides: Record<string, string | File> = {}) => {
  const formData = new FormData()
  const entries = {
    title: "Statuts de l'ASL",
    categoryId: CATEGORY_ID,
    file: pdf,
    ...overrides,
  }
  for (const [key, value] of Object.entries(entries)) {
    formData.append(key, value)
  }
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(publishSharedDocumentService).mockResolvedValue({
    status: 'published',
    document: {
      id: DOCUMENT_ID,
      title: "Statuts de l'ASL",
      categoryId: CATEGORY_ID,
      categoryName: 'Statuts',
      fileBytes: 4,
      createdAt: new Date(),
    },
  })
  vi.mocked(deleteSharedDocumentService).mockResolvedValue({
    status: 'deleted',
    title: "Statuts de l'ASL",
  })
})

describe('publishSharedDocumentAction (s31, critère 1)', () => {
  it("dépose sous l'association du domaine, revalide, puis revient à la liste avec l'alerte", async () => {
    await expect(
      publishSharedDocumentAction({status: 'idle'}, publishForm())
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(requireActionAuth).toHaveBeenCalled()
    expect(publishSharedDocumentService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      title: "Statuts de l'ASL",
      categoryId: CATEGORY_ID,
      file: pdf,
    })
    expect(revalidatePath).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith(
      `/bureau/documents?statut=depose&document=${DOCUMENT_ID}`
    )
  })

  it('transmet un champ de fichier vide comme absent', async () => {
    const empty = new File([], '')

    await expect(
      publishSharedDocumentAction({status: 'idle'}, publishForm({file: empty}))
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(publishSharedDocumentService).toHaveBeenCalledWith(
      expect.objectContaining({file: undefined})
    )
  })

  it('rend les refus du service sans rediriger ni revalider', async () => {
    vi.mocked(publishSharedDocumentService).mockResolvedValue({
      status: 'rejected',
      issues: [SharedDocumentIssueConst.FILE_FORMAT],
    })

    const result = await publishSharedDocumentAction(
      {status: 'idle'},
      publishForm()
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: [SharedDocumentIssueConst.FILE_FORMAT],
    })
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await publishSharedDocumentAction(
      {status: 'idle'},
      publishForm()
    )

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
    expect(publishSharedDocumentService).not.toHaveBeenCalled()
  })

  it('rend un refus d autorisation du service comme interdit', async () => {
    vi.mocked(publishSharedDocumentService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await publishSharedDocumentAction(
      {status: 'idle'},
      publishForm()
    )

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
  })

  it('rend une panne comme un échec, sans rediriger', async () => {
    vi.mocked(publishSharedDocumentService).mockRejectedValue(new Error('db'))

    const result = await publishSharedDocumentAction(
      {status: 'idle'},
      publishForm()
    )

    expect(result).toEqual({status: 'error', message: 'errors.failed'})
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('deleteSharedDocumentAction (s31, critère 5)', () => {
  it('retire le document, revalide, puis revient à la liste avec l alerte', async () => {
    await expect(deleteSharedDocumentAction(DOCUMENT_ID)).rejects.toThrow(
      'NEXT_REDIRECT'
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(deleteSharedDocumentService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      documentId: DOCUMENT_ID,
    })
    expect(revalidatePath).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/bureau/documents?statut=retire')
  })

  it('refuse sans session, sans retirer', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await deleteSharedDocumentAction(DOCUMENT_ID)

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
    expect(deleteSharedDocumentService).not.toHaveBeenCalled()
  })

  it('rend un document déjà retiré comme un échec de retrait', async () => {
    vi.mocked(deleteSharedDocumentService).mockRejectedValue(
      new NotFoundError()
    )

    const result = await deleteSharedDocumentAction(DOCUMENT_ID)

    expect(result).toEqual({status: 'error', message: 'errors.deleteFailed'})
    expect(redirect).not.toHaveBeenCalled()
  })
})
