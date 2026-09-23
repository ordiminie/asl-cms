import {beforeEach, describe, expect, it, vi} from 'vitest'

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))

import {createStorage} from '@/lib/files/storage/storage-factory'

import {readContentFileService} from '../content-file-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const NEWS_ID = '33333333-3333-4333-8333-333333333333'
const PAGE_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  vi.clearAllMocks()
  storage.download.mockResolvedValue(new Blob(['contenu']))
})

describe('readContentFileService — sans autorisation, clé validée', () => {
  it("sert l'image d'une actualité de l'association résolue", async () => {
    const key = `${ORG_ID}/news/${NEWS_ID}/image-abc.webp`

    const result = await readContentFileService(ORG_ID, key)

    expect(result.contentType).toBe('image/webp')
    expect(storage.download).toHaveBeenCalledWith(key)
    expect(createStorage).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({bucket: 'pages'})
    )
  })

  it('sert toujours un fichier de page de s04', async () => {
    const key = `${ORG_ID}/pages/${PAGE_ID}/bloc-abc.pdf`

    const result = await readContentFileService(ORG_ID, key)

    expect(result.contentType).toBe('application/pdf')
  })

  it.each([
    `${OTHER_ORG_ID}/news/${NEWS_ID}/image-abc.png`,
    `${ORG_ID}/identity/logo-abc.png`,
    `${ORG_ID}/news/${NEWS_ID}/../../${OTHER_ORG_ID}/news/x.png`,
    `${ORG_ID}/news//image.png`,
    `${ORG_ID}/news/${NEWS_ID}/image-abc.svg`,
    '',
  ])('refuse %j sans lecture', async (key) => {
    await expect(readContentFileService(ORG_ID, key)).rejects.toThrow()
    expect(storage.download).not.toHaveBeenCalled()
  })
})
