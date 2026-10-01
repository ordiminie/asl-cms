import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next/navigation', () => ({redirect: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/app/dal/page-dal', () => ({
  pageTag: (organizationId: string, slug: string) =>
    `page:${organizationId}:${slug}`,
}))
vi.mock('@/app/dal/site-navigation-dal', () => ({
  siteNavigationTag: (organizationId: string) => `nav:${organizationId}`,
}))
vi.mock('@/services/facades/page-service-facade', () => ({
  createPageService: vi.fn(),
  publishPageService: vi.fn(),
  unpublishPageService: vi.fn(),
  updatePageService: vi.fn(),
  uploadPageBlockFileService: vi.fn(),
  uploadPageShareImageService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  updatePageService,
  uploadPageShareImageService,
} from '@/services/facades/page-service-facade'

import {savePageDraftAction, uploadPageShareImageAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'

const shareForm = () => {
  const formData = new FormData()
  formData.set('file', new File(['x'], 'prelevement.jpg'))
  formData.set('pageId', PAGE_ID)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
})

describe('savePageDraftAction — referencement (s11)', () => {
  it('transmet les champs de referencement au service, pour l association du domaine', async () => {
    vi.mocked(updatePageService).mockResolvedValue({
      status: 'saved',
      page: {slug: 'qualite'} as never,
    })

    await savePageDraftAction({
      pageId: PAGE_ID,
      previousSlug: 'qualite',
      title: 'Qualité',
      slug: 'qualite',
      blocks: [],
      seoTitle: 'Titre moteur',
      seoDescription: 'Description',
      shareImageKey: null,
      shareImageAlt: '',
    })

    expect(updatePageService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      pageId: PAGE_ID,
      title: 'Qualité',
      slug: 'qualite',
      blocks: [],
      seoTitle: 'Titre moteur',
      seoDescription: 'Description',
      shareImageKey: null,
      shareImageAlt: '',
    })
  })
})

describe('uploadPageShareImageAction (s11)', () => {
  it('depose l image de la page et rend sa cle', async () => {
    vi.mocked(uploadPageShareImageService).mockResolvedValue({
      status: 'uploaded',
      key: 'k',
      fileName: 'prelevement.jpg',
      fileSize: 10,
    })

    const state = await uploadPageShareImageAction(shareForm())

    expect(uploadPageShareImageService).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: TENANT_ID, pageId: PAGE_ID})
    )
    expect(state).toEqual({
      status: 'uploaded',
      key: 'k',
      fileName: 'prelevement.jpg',
      fileSize: 10,
    })
  })

  it.each([
    [{status: 'rejected', reason: 'format'}, 'fileFormat'],
    [
      {status: 'rejected', reason: 'size', size: 9, maxBytes: 5},
      'fileTooLarge',
    ],
  ] as const)(
    'un fichier refuse devient un message : %o',
    async (result, message) => {
      vi.mocked(uploadPageShareImageService).mockResolvedValue(result)

      expect(await uploadPageShareImageAction(shareForm())).toEqual({
        status: 'error',
        message,
      })
    }
  )

  it('hors du bureau : refus rendu comme un resultat, jamais leve', async () => {
    vi.mocked(uploadPageShareImageService).mockRejectedValue(
      new AuthorizationError('non')
    )

    expect(await uploadPageShareImageAction(shareForm())).toEqual({
      status: 'error',
      message: 'forbidden',
    })
  })
})
