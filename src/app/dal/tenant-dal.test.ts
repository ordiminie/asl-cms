import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(
    async (_organizationId: string, callback: () => Promise<unknown>) =>
      await callback()
  ),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {headers} from 'next/headers'
import {notFound} from 'next/navigation'

import {withTenant} from '@/db/tenant-scope'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'

import {
  getCurrentTenantDal,
  getTenantByDomainDal,
  requireCurrentTenantDal,
  requireEnabledModuleDal,
  withCurrentTenant,
} from './tenant-dal'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const tenant = {
  id: TENANT_ID,
  name: 'ASL La Fourche',
  slug: 'asl-la-fourche',
  domain: 'asl-lafourche.fr',
  enabledModules: ['voirie'],
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  logo: null,
  metadata: null,
  limitOverrides: null,
  identityLogoKey: null,
  identityFaviconKey: null,
}

const withHost = (host: string) =>
  vi.mocked(headers).mockResolvedValue(new Headers({host}) as never)

beforeEach(() => {
  vi.clearAllMocks()
  withHost('asl-lafourche.fr')
  vi.mocked(getOrganizationByDomainService).mockResolvedValue(tenant as never)
})

describe('getTenantByDomainDal', () => {
  it('prend le domaine en argument, et ne lit jamais les en-tetes', async () => {
    // `headers()` est interdit dans un scope `'use cache'` : c'est cette
    // separation qui rend la fonction cachable.
    const resolved = await getTenantByDomainDal('asl-lafourche.fr')

    expect(resolved?.id).toBe(TENANT_ID)
    expect(headers).not.toHaveBeenCalled()
  })

  it('porte les cles des fichiers d identite quand l association en a (ADR 015)', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue({
      ...tenant,
      identityLogoKey: `${TENANT_ID}/identity/logo-a.png`,
      identityFaviconKey: `${TENANT_ID}/identity/favicon-b.ico`,
    } as never)

    const resolved = await getTenantByDomainDal('asl-lafourche.fr')

    expect(resolved?.logoKey).toBe(`${TENANT_ID}/identity/logo-a.png`)
    expect(resolved?.faviconKey).toBe(`${TENANT_ID}/identity/favicon-b.ico`)
  })

  it('rend des cles nulles quand l association n a ni logo ni favicon', async () => {
    const resolved = await getTenantByDomainDal('asl-lafourche.fr')

    expect(resolved).toMatchObject({logoKey: null, faviconKey: null})
  })
})

describe('getCurrentTenantDal', () => {
  it('resout le tenant du domaine appele', async () => {
    const resolved = await getCurrentTenantDal()

    expect(getOrganizationByDomainService).toHaveBeenCalledWith(
      'asl-lafourche.fr'
    )
    expect(resolved?.id).toBe(TENANT_ID)
  })

  it('retire le port que le Host porte en developpement', async () => {
    withHost('localhost:3000')

    await getCurrentTenantDal()

    expect(getOrganizationByDomainService).toHaveBeenCalledWith('localhost')
  })

  it('prefere x-forwarded-host, pose par le reverse proxy du VPS', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        host: 'interne:3000',
        'x-forwarded-host': 'asl-lafourche.fr',
      }) as never
    )

    await getCurrentTenantDal()

    expect(getOrganizationByDomainService).toHaveBeenCalledWith(
      'asl-lafourche.fr'
    )
  })

  it('ne rend aucun tenant quand le domaine n en sert aucun', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)

    await expect(getCurrentTenantDal()).resolves.toBeUndefined()
  })

  it('ne rend aucun tenant, et ne touche pas la base, sans en-tete Host', async () => {
    vi.mocked(headers).mockResolvedValue(new Headers() as never)

    await expect(getCurrentTenantDal()).resolves.toBeUndefined()
    expect(getOrganizationByDomainService).not.toHaveBeenCalled()
  })
})

describe('requireCurrentTenantDal', () => {
  it('rend le tenant du domaine appele', async () => {
    await expect(requireCurrentTenantDal()).resolves.toMatchObject({
      id: TENANT_ID,
    })
    expect(notFound).not.toHaveBeenCalled()
  })

  it('rend la page introuvable sur un domaine inconnu, sans servir aucun contenu', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)

    await expect(requireCurrentTenantDal()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})

describe('withCurrentTenant', () => {
  it('execute le callback dans le scope du tenant du domaine', async () => {
    const seen = await withCurrentTenant(async () => 'lu')

    expect(withTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function))
    expect(seen).toBe('lu')
  })

  it('sur un domaine inconnu, n ouvre aucun scope : la RLS ne rend alors rien', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)

    const seen = await withCurrentTenant(async () => 'lu')

    expect(withTenant).not.toHaveBeenCalled()
    expect(seen).toBe('lu')
  })
})

describe('requireEnabledModuleDal', () => {
  it('laisse passer un module active pour cette association', async () => {
    await expect(requireEnabledModuleDal('voirie')).resolves.toMatchObject({
      id: TENANT_ID,
    })
    expect(notFound).not.toHaveBeenCalled()
  })

  it('rend introuvable la route d un module desactive', async () => {
    await expect(requireEnabledModuleDal('vote')).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })

  it('rend introuvable une cle de module inconnue', async () => {
    await expect(requireEnabledModuleDal('module-fictif')).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })

  it('rend introuvable sur un domaine qui ne sert aucune association', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)

    await expect(requireEnabledModuleDal('voirie')).rejects.toThrow(
      'NEXT_NOT_FOUND'
    )
  })
})
