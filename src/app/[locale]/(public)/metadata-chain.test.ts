import {readFileSync} from 'node:fs'
import path from 'node:path'

import {accumulateMetadata} from 'next/dist/lib/metadata/resolve-metadata'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * La chaine **reelle** des layouts publics, combinee par la fonction de Next
 * qui produit les balises (`accumulateMetadata`), et non par les objets que
 * chaque layout renvoie isolement. Un layout intermediaire qui renvoie un
 * titre en chaine remet le gabarit « · association » a zero : seul ce
 * test-la le voit (revue s11, C1).
 */

const messages = vi.hoisted(() => ({value: {} as Record<string, unknown>}))

/*
 * `resolve-metadata` de Next fait un `require('server-only')` CommonJS, que
 * `vi.mock` n'intercepte pas : le module est neutralise dans le cache de
 * `require` avant l'import, attendu pour ne pas dependre de l'ordre des
 * microtaches. Chemin interne de Next 16.3 (`next/dist/lib/metadata`) : une
 * montee de version peut le deplacer, le test echoue alors en rouge.
 */
await vi.hoisted(async () => {
  const {createRequire} = await import('node:module')
  const {dirname} = await import('node:path')
  const require = createRequire(import.meta.url)
  const nextMetadata =
    require.resolve('next/dist/lib/metadata/resolve-metadata')
  const serverOnly = require.resolve('server-only', {
    paths: [dirname(nextMetadata)],
  })
  require.cache[serverOnly] = {
    id: serverOnly,
    filename: serverOnly,
    loaded: true,
    exports: {},
  } as NodeJS.Module
})

vi.mock('server-only', () => ({}))
vi.mock('../base-layout', () => ({default: () => null}))
vi.mock('next-intl/server', () => {
  const lookup = (namespace: string, key: string) =>
    `${namespace}.${key}`
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages.value
      )
  return {
    getTranslations: vi.fn(
      async (scope: string | {namespace: string}) =>
        (key: string, values: Record<string, string> = {}) =>
          String(
            lookup(typeof scope === 'string' ? scope : scope.namespace, key)
          ).replaceAll(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '')
    ),
    setRequestLocale: vi.fn(),
  }
})
vi.mock('@/app/dal/seo-dal', () => ({getCurrentAssociationSeoDal: vi.fn()}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/app/dal/site-alert-dal', () => ({getPublicSiteAlertDal: vi.fn()}))
vi.mock('@/app/dal/site-navigation-dal', () => ({
  getCurrentPublicSiteNavigationDal: vi.fn(),
}))

import type {Metadata} from 'next'

import {AssociationSeoDTO, getCurrentAssociationSeoDal} from '@/app/dal/seo-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'

import * as localeLayout from '../layout'
import * as publicLayout from './layout'

const association: AssociationSeoDTO = {
  name: 'Les Amis de l’Étang',
  description: 'Association syndicale libre du domaine de l’Étang.',
  googleVerification: undefined,
  logoVersion: undefined,
  hue: 195,
  origin: 'https://lesamisdeletang.fr',
}

const params = Promise.resolve({locale: 'fr'})

type GenerateMetadata = (props: {
  params: Promise<{locale: string}>
}) => Promise<Metadata>

type LayoutModule = {generateMetadata?: GenerateMetadata; metadata?: Metadata}

/**
 * Ce que Next tire d'un module de layout (`getDefinedMetadata`) : son
 * `generateMetadata` enveloppe, sinon son `metadata`, sinon rien.
 */
const segmentOf = (layout: LayoutModule) => {
  const generate = layout.generateMetadata
  if (!generate) return layout.metadata ?? null
  return Object.assign(() => generate({params}), {
    $$original: (props: unknown) =>
      generate(props as Parameters<GenerateMetadata>[0]),
  })
}

/**
 * `/[locale]` (layout) → `(public)` (layout) → segment sans layout → page,
 * dans la forme d'`accumulateMetadata` : une entree par segment.
 */
const resolveChain = (page: Metadata | null) =>
  accumulateMetadata(
    '/[locale]/(public)/contact/page',
    [
      [segmentOf(localeLayout), null],
      [segmentOf(publicLayout as LayoutModule), null],
      [null, null],
      [page, null],
    ],
    Promise.resolve('/contact'),
    {trailingSlash: false, isStaticMetadataRouteFile: false}
  )

beforeEach(() => {
  vi.clearAllMocks()
  messages.value = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'messages/fr.json'), 'utf8')
  )
  vi.mocked(getCurrentTenantDal).mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    name: association.name,
    slug: 'les-amis-de-l-etang',
    domain: 'lesamisdeletang.fr',
    enabledModules: [],
    logoKey: null,
    faviconKey: null,
  })
  vi.mocked(getCurrentAssociationSeoDal).mockResolvedValue(association)
})

describe('metadonnees combinees des pages publiques (revue s11, C1)', () => {
  it('le titre d une page publique est suivi du nom de l association', async () => {
    const resolved = await resolveChain({title: 'Contact'})

    expect(resolved.title?.absolute).toBe('Contact · Les Amis de l’Étang')
  })

  it('une page sans metadonnees propres garde la description de l association', async () => {
    const resolved = await resolveChain({})

    expect(resolved.description).toBe(association.description)
    expect(resolved.title?.absolute).toBe(association.name)
  })
})
