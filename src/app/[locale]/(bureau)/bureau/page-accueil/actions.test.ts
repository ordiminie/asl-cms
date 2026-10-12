import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/app/dal/home-page-dal', () => ({
  homePageTag: (organizationId: string) => `home-page:${organizationId}`,
}))
vi.mock('@/services/facades/home-page-service-facade', () => ({
  setHomePageService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {setHomePageService} from '@/services/facades/home-page-service-facade'

import {saveHomePageAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PAGE_ID = '33333333-3333-4333-8333-333333333333'
const HOME_TAG = `home-page:${TENANT_ID}`

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(setHomePageService).mockResolvedValue({status: 'saved'})
})

describe('saveHomePageAction — succès', () => {
  it('désigne la page pour l association du domaine, puis invalide l accueil', async () => {
    const order: string[] = []
    vi.mocked(setHomePageService).mockImplementation(async () => {
      order.push('write')
      return {status: 'saved'}
    })
    vi.mocked(updateTag).mockImplementation(() => {
      order.push('invalidate')
    })

    const result = await saveHomePageAction(PAGE_ID)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(setHomePageService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      pageId: PAGE_ID,
    })
    expect(result).toEqual({status: 'saved'})
    expect(updateTag).toHaveBeenCalledWith(HOME_TAG)
    expect(order).toEqual(['write', 'invalidate'])
  })

  it('accepte null : retour à l accueil automatique', async () => {
    const result = await saveHomePageAction(null)

    expect(setHomePageService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      pageId: null,
    })
    expect(result).toEqual({status: 'saved'})
    expect(updateTag).toHaveBeenCalledWith(HOME_TAG)
  })
})

describe('saveHomePageAction — refus rendus comme résultats', () => {
  it('page non publiée : résultat traduit, rien invalidé', async () => {
    vi.mocked(setHomePageService).mockResolvedValue({status: 'not_published'})

    const result = await saveHomePageAction(PAGE_ID)

    expect(result).toEqual({
      status: 'not_published',
      message: 'notPublished',
    })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refus d autorisation : message traduit, rien invalidé', async () => {
    vi.mocked(setHomePageService).mockRejectedValue(new AuthorizationError())

    const result = await saveHomePageAction(PAGE_ID)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('sans session : refusé sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await saveHomePageAction(PAGE_ID)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(setHomePageService).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('page introuvable (autre association, identifiant forgé) : échec, rien invalidé', async () => {
    vi.mocked(setHomePageService).mockRejectedValue(new NotFoundError())

    const result = await saveHomePageAction(PAGE_ID)

    expect(result).toEqual({status: 'error', message: 'failed'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('panne : rendue comme un résultat, jamais levée', async () => {
    vi.mocked(setHomePageService).mockRejectedValue(
      new Error('connexion perdue')
    )

    const result = await saveHomePageAction(PAGE_ID)

    expect(result).toEqual({status: 'error', message: 'failed'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})
