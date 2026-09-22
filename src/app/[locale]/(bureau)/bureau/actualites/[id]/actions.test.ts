import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/news-service-facade', () => ({
  createNewsDraftService: vi.fn(),
  publishNewsService: vi.fn(),
  unpublishNewsService: vi.fn(),
  updateNewsService: vi.fn(),
  uploadNewsImageService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  publishNewsService,
  unpublishNewsService,
  updateNewsService,
  uploadNewsImageService,
} from '@/services/facades/news-service-facade'
import {NewsDTO} from '@/services/types/domain/news-types'

import {
  publishNewsAction,
  saveNewsDraftAction,
  unpublishNewsAction,
  uploadNewsImageAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const NEWS_ID = '33333333-3333-4333-8333-333333333333'
const LIST_TAG = `news:${TENANT_ID}`
const ITEM_TAG = `news:${TENANT_ID}:assemblee-generale`

const saved: NewsDTO = {
  id: NEWS_ID,
  organizationId: TENANT_ID,
  slug: 'assemblee-generale',
  title: 'Assemblée générale',
  publishedOn: '2026-10-10',
  imageKey: null,
  imageAlt: '',
  content: 'Rendez-vous le 10 octobre.',
  status: 'draft',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
}

const input = {
  newsId: NEWS_ID,
  title: 'Assemblée générale',
  publishedOn: '2026-10-10',
  content: 'Rendez-vous le 10 octobre.',
  imageAlt: '',
  removeImage: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(updateNewsService).mockResolvedValue({status: 'saved', news: saved})
  vi.mocked(publishNewsService).mockResolvedValue({
    status: 'published',
    news: {...saved, status: 'published'},
  })
  vi.mocked(unpublishNewsService).mockResolvedValue({
    status: 'unpublished',
    news: {...saved, status: 'unpublished'},
  })
})

describe('saveNewsDraftAction', () => {
  it('enregistre puis invalide la liste et la fiche', async () => {
    const result = await saveNewsDraftAction(input)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(updateNewsService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ...input,
    })
    expect(result).toEqual({status: 'saved', news: saved})
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(updateTag).toHaveBeenCalledWith(ITEM_TAG)
  })

  it("n'invalide rien quand l'enregistrement échoue", async () => {
    vi.mocked(updateNewsService).mockRejectedValue(new AuthorizationError())

    const result = await saveNewsDraftAction(input)

    expect(result.status).toBe('error')
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('publishNewsAction', () => {
  it('enregistre, publie, puis invalide', async () => {
    const result = await publishNewsAction(input)

    expect(updateNewsService).toHaveBeenCalled()
    expect(publishNewsService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      newsId: NEWS_ID,
    })
    expect(result.status).toBe('published')
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(updateTag).toHaveBeenCalledWith(ITEM_TAG)
  })

  it("rend les manques mais invalide quand même : l'enregistrement, lui, a réussi", async () => {
    vi.mocked(publishNewsService).mockResolvedValue({
      status: 'rejected',
      issues: ['missing_image_alt'],
    })

    const result = await publishNewsAction(input)

    expect(result).toEqual({
      status: 'incomplete',
      issues: ['missing_image_alt'],
    })
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(updateTag).toHaveBeenCalledWith(ITEM_TAG)
  })

  it('une actualité déjà publiée dont la republication est refusée sert quand même le nouveau contenu', async () => {
    vi.mocked(updateNewsService).mockResolvedValue({
      status: 'saved',
      news: {...saved, status: 'published', imageAlt: ''},
    })
    vi.mocked(publishNewsService).mockResolvedValue({
      status: 'rejected',
      issues: ['missing_image_alt'],
    })

    const result = await publishNewsAction(input)

    expect(result.status).toBe('incomplete')
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(updateTag).toHaveBeenCalledWith(ITEM_TAG)
  })

  it("n'invalide rien quand l'enregistrement lui-même échoue", async () => {
    vi.mocked(updateNewsService).mockRejectedValue(new AuthorizationError())

    const result = await publishNewsAction(input)

    expect(result.status).toBe('error')
    expect(publishNewsService).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('unpublishNewsAction', () => {
  it('dépublie puis invalide', async () => {
    const result = await unpublishNewsAction({newsId: NEWS_ID})

    expect(result.status).toBe('unpublished')
    expect(updateTag).toHaveBeenCalledWith(LIST_TAG)
    expect(updateTag).toHaveBeenCalledWith(ITEM_TAG)
  })

  it("n'invalide rien quand la dépublication échoue", async () => {
    vi.mocked(unpublishNewsService).mockRejectedValue(new Error('panne'))

    const result = await unpublishNewsAction({newsId: NEWS_ID})

    expect(result.status).toBe('error')
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('uploadNewsImageAction', () => {
  it('dépose le fichier et rend sa clé', async () => {
    const key = `${TENANT_ID}/news/${NEWS_ID}/image-a.png`
    vi.mocked(uploadNewsImageService).mockResolvedValue({
      status: 'uploaded',
      key,
      fileName: 'photo.png',
      fileSize: 10,
    })
    const formData = new FormData()
    formData.append('newsId', NEWS_ID)
    formData.append('file', new File(['x'], 'photo.png', {type: 'image/png'}))

    const result = await uploadNewsImageAction(formData)

    expect(result).toEqual({status: 'uploaded', key, fileName: 'photo.png'})
  })

  it('rend une erreur quand le format est refusé', async () => {
    vi.mocked(uploadNewsImageService).mockResolvedValue({
      status: 'rejected',
      reason: 'format',
    })
    const formData = new FormData()
    formData.append('newsId', NEWS_ID)
    formData.append('file', new File(['x'], 'photo.png', {type: 'image/png'}))

    const result = await uploadNewsImageAction(formData)

    expect(result.status).toBe('error')
  })
})
