import {beforeEach, describe, expect, it, vi} from 'vitest'

const segments = vi.hoisted(() => ({
  list: ['/account', '/admin', '/bureau', '/dashboard', '/team'],
}))

vi.mock('server-only', () => ({}))
vi.mock('@/env', () => ({env: {BETTER_AUTH_URL: 'https://plateforme.test'}}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/lib/routing/authenticated-segments', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get AUTHENTICATED_SEGMENTS() {
    return segments.list
  },
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'

import robots from './robots'

const tenantOn = (domain: string) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: domain,
  slug: domain,
  domain,
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
})

const rulesOf = async () => {
  const result = await robots()
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
  return {result, rules}
}

beforeEach(() => {
  vi.clearAllMocks()
  segments.list = ['/account', '/admin', '/bureau', '/dashboard', '/team']
  vi.mocked(getCurrentTenantDal).mockResolvedValue(
    tenantOn('lesamisdeletang.fr')
  )
})

describe('robots.ts (critere 3)', () => {
  it('autorise le site public et interdit chaque segment authentifie du proxy', async () => {
    const {rules} = await rulesOf()

    expect(rules.userAgent).toBe('*')
    // Autorise par defaut : un `Allow: /` en tete tromperait les analyseurs
    // qui appliquent la premiere regle trouvee (revue s11, m9).
    expect(rules.allow).not.toContain('/')
    for (const segment of segments.list) {
      expect(rules.disallow).toContain(segment)
    }
  })

  it('un segment declare au proxy apparait sans toucher a robots.ts', async () => {
    segments.list = [...segments.list, '/tresorerie']

    const {rules} = await rulesOf()

    expect(rules.disallow).toContain('/tresorerie')
  })

  it('interdit aussi les routes de connexion et l API', async () => {
    const {rules} = await rulesOf()

    for (const path of [
      '/login',
      '/register',
      '/verify-request',
      '/reset-password',
      '/logout',
      '/auth-error',
      '/api/',
    ]) {
      expect(rules.disallow).toContain(path)
    }
  })

  it('la ligne de groupe de route, qui n excluait rien, a disparu', async () => {
    const {rules} = await rulesOf()

    expect(rules.disallow).not.toContain('/(app)/')
  })

  it('le sitemap est annonce sur le domaine appele (critere 5)', async () => {
    expect((await rulesOf()).result.sitemap).toBe(
      'https://lesamisdeletang.fr/sitemap.xml'
    )

    vi.mocked(getCurrentTenantDal).mockResolvedValue(tenantOn('laforche.fr'))
    expect((await rulesOf()).result.sitemap).toBe(
      'https://laforche.fr/sitemap.xml'
    )
  })

  it('domaine qui ne sert aucune association : tout est interdit, aucun sitemap', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const {result, rules} = await rulesOf()

    expect(rules).toEqual({userAgent: '*', disallow: '/'})
    expect(result).not.toHaveProperty('sitemap')
  })

  it('interdit aussi chaque segment authentifie sous un ancien prefixe de langue (revue s11, M2 ; s43)', async () => {
    const {rules} = await rulesOf()

    for (const prefix of ['fr', 'en', 'es']) {
      for (const segment of [...segments.list, '/login', '/register']) {
        expect(rules.disallow).toContain(`/${prefix}${segment}`)
      }
    }
    expect(rules.disallow).toContain('/en/bureau')
    expect(rules.disallow).toContain('/es/login')
  })

  it('un segment declare au proxy est aussi interdit sous chaque ancien prefixe', async () => {
    segments.list = [...segments.list, '/tresorerie']

    const {rules} = await rulesOf()

    expect(rules.disallow).toContain('/fr/tresorerie')
    expect(rules.disallow).toContain('/en/tresorerie')
  })

  it('l image de partage, le favicon et les fichiers publics restent explorables (revue s11, M1)', async () => {
    const {rules} = await rulesOf()

    expect(rules.disallow).toContain('/api/')
    for (const publicApi of [
      '/api/identity/',
      '/api/files/',
      '/api/pages/files/',
    ]) {
      expect(rules.allow).toContain(publicApi)
    }
    expect(rules.allow).toEqual([
      '/api/identity/',
      '/api/files/',
      '/api/pages/files/',
    ])
  })
})
