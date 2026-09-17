import {existsSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./base-layout', () => ({default: () => null}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  requireCurrentTenantDal: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'

import {generateMetadata} from './layout'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const tenant = (faviconKey: string | null) => ({
  id: TENANT_ID,
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'localhost',
  enabledModules: [],
  logoKey: null,
  faviconKey,
})

const metadataFor = async () =>
  await generateMetadata({params: Promise.resolve({locale: 'fr'})})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateMetadata — favicon propre au tenant', () => {
  it('pointe le favicon televerse de l association, versionne', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(
      tenant(
        `${TENANT_ID}/identity/favicon-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.ico`
      )
    )

    const metadata = await metadataFor()

    expect(metadata.icons).toEqual({
      icon: '/api/identity/favicon?v=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })

  it('sans favicon televerse, pointe la meme route, qui sert le monogramme', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant(null))

    const metadata = await metadataFor()

    expect(metadata.icons).toEqual({icon: '/api/identity/favicon'})
  })

  it('aucun favicon unique du depot n est servi a tous les domaines', () => {
    // Next sert d'office src/app/favicon.ico a tous les domaines (critere 6).
    expect(existsSync(path.resolve(process.cwd(), 'src/app/favicon.ico'))).toBe(
      false
    )
  })
})
