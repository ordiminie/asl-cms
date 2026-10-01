import {existsSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./base-layout', () => ({default: () => null}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string, values?: Record<string, string>) =>
      values?.association ? `%s · ${values.association}` : key
    )
  ),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/seo-dal', () => ({getCurrentAssociationSeoDal: vi.fn()}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  requireCurrentTenantDal: vi.fn(),
}))

import {AssociationSeoDTO, getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'
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

const association = (
  overrides: Partial<AssociationSeoDTO> = {}
): AssociationSeoDTO => ({
  name: 'Les Amis de l’Étang',
  description: 'Association syndicale libre du domaine de l’Étang.',
  googleVerification: undefined,
  logoVersion: undefined,
  hue: 195,
  origin: 'https://lesamisdeletang.fr',
  ...overrides,
})

describe('generateMetadata — metadonnees de l association du domaine (s11)', () => {
  beforeEach(() => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant(null))
    vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(association())
  })

  it('base des adresses = origine de l association du domaine appele', async () => {
    const metadata = await metadataFor()

    expect(metadata.metadataBase).toEqual(new URL('https://lesamisdeletang.fr'))
  })

  it('le titre de chaque page est suivi du nom de l association ; par defaut, le nom seul', async () => {
    const metadata = await metadataFor()

    expect(metadata.title).toEqual({
      template: '%s · Les Amis de l’Étang',
      default: 'Les Amis de l’Étang',
    })
  })

  it('description de l association quand elle est renseignee', async () => {
    const metadata = await metadataFor()

    expect(metadata.description).toBe(
      'Association syndicale libre du domaine de l’Étang.'
    )
  })

  it('sans description de l association : aucune description, pas celle du produit', async () => {
    vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(
      association({description: null})
    )

    const metadata = await metadataFor()

    expect(metadata.description).toBeUndefined()
  })

  it('code de verification renseigne : la balise de Google', async () => {
    vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(
      association({googleVerification: 'abc-DEF_123'})
    )

    const metadata = await metadataFor()

    expect(metadata.verification).toEqual({google: 'abc-DEF_123'})
  })

  it('code absent : aucune balise de verification, pas une balise vide', async () => {
    const metadata = await metadataFor()

    expect(metadata).not.toHaveProperty('verification')
  })

  it('partage par defaut : nom du site, locale francaise, image de repli absolue', async () => {
    const metadata = await metadataFor()

    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Les Amis de l’Étang',
      locale: 'fr_FR',
      images: [
        {
          url: 'https://lesamisdeletang.fr/api/identity/share-image?h=195',
          alt: 'Les Amis de l’Étang',
        },
      ],
    })
  })
})
