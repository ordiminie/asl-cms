import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/site-alert-service-facade', () => ({
  canManageSiteAlertService: vi.fn(),
  getPublicSiteAlertService: vi.fn(),
  getSiteAlertService: vi.fn(),
}))

import {cacheLife, cacheTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  canManageSiteAlertService,
  getPublicSiteAlertService,
  getSiteAlertService,
} from '@/services/facades/site-alert-service-facade'

import {
  canManageCurrentSiteAlertDal,
  getPublicSiteAlertDal,
  getSiteAlertForBureauDal,
  siteAlertTag,
} from './site-alert-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPublicSiteAlertService).mockImplementation(async (id) =>
    id === ORG_A ? {message: 'Coupure d’eau'} : null
  )
})

describe('siteAlertTag', () => {
  it('un tag par association, porte par son identifiant seul', () => {
    expect(siteAlertTag(ORG_A)).toBe(`site-alert:${ORG_A}`)
    expect(siteAlertTag(ORG_A)).not.toBe(siteAlertTag(ORG_B))
  })
})

describe('getPublicSiteAlertDal', () => {
  it('rend le bandeau affiche de l association', async () => {
    await expect(getPublicSiteAlertDal(ORG_A)).resolves.toEqual({
      message: 'Coupure d’eau',
    })
    expect(getPublicSiteAlertService).toHaveBeenCalledWith(ORG_A)
  })

  it('rend null quand l association n affiche aucun bandeau', async () => {
    await expect(getPublicSiteAlertDal(ORG_B)).resolves.toBeNull()
  })

  it('se cache sous le tag de l association, en heures', async () => {
    await getPublicSiteAlertDal(ORG_B)

    expect(cacheLife).toHaveBeenCalledWith('hours')
    expect(cacheTag).toHaveBeenCalledWith(siteAlertTag(ORG_B))
  })
})

describe('getSiteAlertForBureauDal', () => {
  it('lit le bandeau du bureau sans cache, message conserve compris', async () => {
    vi.mocked(getSiteAlertService).mockResolvedValue({
      message: 'Coupure d’eau',
      active: false,
    })

    await expect(getSiteAlertForBureauDal(ORG_A)).resolves.toEqual({
      message: 'Coupure d’eau',
      active: false,
    })
    expect(getSiteAlertService).toHaveBeenCalledWith(ORG_A)
    expect(cacheTag).not.toHaveBeenCalled()
  })
})

describe('canManageCurrentSiteAlertDal', () => {
  it('interroge le droit sur l association du domaine appele', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_B} as never)
    vi.mocked(canManageSiteAlertService).mockResolvedValue(true)

    await expect(canManageCurrentSiteAlertDal()).resolves.toBe(true)
    expect(canManageSiteAlertService).toHaveBeenCalledWith(ORG_B)
  })
})

describe('scope cache — interdits', () => {
  it('le DAL n appelle ni le logger, ni l horloge, ni la requete', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, 'site-alert-dal.ts'),
      'utf8'
    )

    expect(source).toContain("'use cache'")
    for (const forbidden of [
      '@/lib/logger',
      'logger.',
      'new Date(',
      'Date.now(',
      'headers()',
      'cookies()',
      'Math.random(',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
