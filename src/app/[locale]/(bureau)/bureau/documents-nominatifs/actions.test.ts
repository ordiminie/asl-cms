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
vi.mock('@/services/facades/member-document-service-facade', () => ({
  depositMemberDocumentBatchLineService: vi.fn(),
  depositMemberDocumentService: vi.fn(),
  removeMemberDocumentService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'
import {redirect} from 'next/navigation'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {
  depositMemberDocumentBatchLineService,
  depositMemberDocumentService,
  removeMemberDocumentService,
} from '@/services/facades/member-document-service-facade'
import {MemberDocumentIssueConst} from '@/services/types/domain/member-document-types'

import {
  depositMemberDocumentAction,
  depositMemberDocumentBatchLineAction,
  removeMemberDocumentAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'

const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'f.pdf')

const depositForm = (overrides: Record<string, string | File> = {}) => {
  const formData = new FormData()
  const entries = {
    memberProfileId: PROFILE_ID,
    title: 'Facture 2026',
    categoryId: CATEGORY_ID,
    documentDate: '2026-03-15',
    file: pdf,
    ...overrides,
  }
  for (const [key, value] of Object.entries(entries)) {
    formData.append(key, value)
  }
  return formData
}

const redirectError = expect.objectContaining({digest: 'NEXT_REDIRECT'})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(depositMemberDocumentService).mockResolvedValue({
    status: 'deposited',
    document: {
      id: DOCUMENT_ID,
      title: 'Facture 2026',
      categoryId: CATEGORY_ID,
      categoryName: 'Facture',
      documentDate: '2026-03-15',
      fileBytes: 4,
      createdAt: new Date(),
      memberProfileId: PROFILE_ID,
      memberProfileName: 'Bernard Lefèvre',
    },
  })
  vi.mocked(removeMemberDocumentService).mockResolvedValue({
    status: 'removed',
    title: 'Facture 2026',
    memberProfileId: PROFILE_ID,
  })
})

describe('depositMemberDocumentAction (s32, critère 1)', () => {
  it("dépose pour la fiche sous l'association du domaine, revalide, puis revient à la fiche avec l'alerte", async () => {
    await expect(
      depositMemberDocumentAction({status: 'idle'}, depositForm())
    ).rejects.toEqual(redirectError)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(depositMemberDocumentService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      title: 'Facture 2026',
      categoryId: CATEGORY_ID,
      documentDate: '2026-03-15',
      file: expect.any(File),
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/proprietaires/[id]',
      'layout'
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/documents-nominatifs',
      'layout'
    )
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard',
      'page'
    )
    expect(redirect).toHaveBeenCalledWith(
      `/bureau/proprietaires/${PROFILE_ID}?documents=depose&document=${DOCUMENT_ID}`
    )
  })

  it('rend les refus du serveur tels quels, sans revalider ni rediriger', async () => {
    vi.mocked(depositMemberDocumentService).mockResolvedValue({
      status: 'rejected',
      issues: [MemberDocumentIssueConst.FILE_FORMAT],
    })

    const result = await depositMemberDocumentAction(
      {status: 'idle'},
      depositForm()
    )

    expect(result).toEqual({
      status: 'rejected',
      issues: [MemberDocumentIssueConst.FILE_FORMAT],
    })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rend un refus d’autorisation comme un résultat, sans rien lever', async () => {
    vi.mocked(depositMemberDocumentService).mockRejectedValue(
      new AuthorizationError()
    )

    const result = await depositMemberDocumentAction(
      {status: 'idle'},
      depositForm()
    )

    expect(result).toEqual({status: 'error', message: 'errors.forbidden'})
    expect(redirect).not.toHaveBeenCalled()
  })

  it('une panne : un message, aucune redirection', async () => {
    vi.mocked(depositMemberDocumentService).mockRejectedValue(new Error('db'))

    const result = await depositMemberDocumentAction(
      {status: 'idle'},
      depositForm()
    )

    expect(result).toEqual({status: 'error', message: 'errors.failed'})
  })

  it('sans session : rien déposé', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await depositMemberDocumentAction(
      {status: 'idle'},
      depositForm()
    )

    expect(result.status).toBe('error')
    expect(depositMemberDocumentService).not.toHaveBeenCalled()
  })
})

describe('removeMemberDocumentAction (s32)', () => {
  it('depuis la fiche : retire, revalide, puis revient à la fiche du document', async () => {
    await expect(
      removeMemberDocumentAction(DOCUMENT_ID, 'profile')
    ).rejects.toEqual(redirectError)

    expect(removeMemberDocumentService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      documentId: DOCUMENT_ID,
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard',
      'page'
    )
    expect(redirect).toHaveBeenCalledWith(
      `/bureau/proprietaires/${PROFILE_ID}?documents=retire`
    )
  })

  it("depuis la vue d'ensemble : revient à la vue d'ensemble", async () => {
    await expect(
      removeMemberDocumentAction(DOCUMENT_ID, 'overview')
    ).rejects.toEqual(redirectError)

    expect(redirect).toHaveBeenCalledWith(
      '/bureau/documents-nominatifs?statut=retire'
    )
  })

  it.each([
    ['refus d’autorisation', new AuthorizationError(), 'errors.forbidden'],
    ['document déjà retiré', new NotFoundError(), 'errors.removeFailed'],
  ])('%s : un message, aucune redirection', async (_, error, message) => {
    vi.mocked(removeMemberDocumentService).mockRejectedValue(error)

    const result = await removeMemberDocumentAction(DOCUMENT_ID, 'profile')

    expect(result).toEqual({status: 'error', message})
    expect(redirect).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('depositMemberDocumentBatchLineAction (s32, critère 7) — un fichier par appel', () => {
  const REFERENCE = '3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f'
  const lineForm = () => {
    const formData = new FormData()
    formData.append('title', 'Facture 2026')
    formData.append('categoryId', CATEGORY_ID)
    formData.append('documentDate', '2026-03-15')
    formData.append(
      'file',
      new File([new Uint8Array([0x25, 0x50])], `${REFERENCE}_facture.pdf`)
    )
    return formData
  }

  it('confie la ligne au service sous le tenant du domaine, nom du fichier compris, et rend son résultat', async () => {
    const deposited = {
      status: 'deposited' as const,
      fileName: `${REFERENCE}_facture.pdf`,
      memberProfileId: PROFILE_ID,
      memberProfileName: 'Bernard Lefèvre',
      parcelNumbers: ['61'],
      meterNumber: null,
    }
    vi.mocked(depositMemberDocumentBatchLineService).mockResolvedValue(
      deposited
    )

    const result = await depositMemberDocumentBatchLineAction(lineForm())

    expect(requireActionAuth).toHaveBeenCalled()
    expect(depositMemberDocumentBatchLineService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      fileName: `${REFERENCE}_facture.pdf`,
      title: 'Facture 2026',
      categoryId: CATEGORY_ID,
      documentDate: '2026-03-15',
      file: expect.any(File),
    })
    expect(result).toEqual(deposited)
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(app)/dashboard',
      'page'
    )
    expect(redirect).not.toHaveBeenCalled()
  })

  it('une ligne écartée : rendue telle quelle, rien revalidé', async () => {
    const rejected = {
      status: 'rejected' as const,
      fileName: 'facture.pdf',
      reason: 'no_reference_in_name' as const,
    }
    vi.mocked(depositMemberDocumentBatchLineService).mockResolvedValue(rejected)

    expect(await depositMemberDocumentBatchLineAction(lineForm())).toEqual(
      rejected
    )
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it.each([
    ['refus d’autorisation', new AuthorizationError(), 'errors.forbidden'],
    ['panne', new Error('disk'), 'errors.batchFailed'],
  ])(
    '%s : une erreur pour ce fichier, jamais levée',
    async (_, error, message) => {
      vi.mocked(depositMemberDocumentBatchLineService).mockRejectedValue(error)

      expect(await depositMemberDocumentBatchLineAction(lineForm())).toEqual({
        status: 'error',
        fileName: `${REFERENCE}_facture.pdf`,
        message,
      })
    }
  )
})
