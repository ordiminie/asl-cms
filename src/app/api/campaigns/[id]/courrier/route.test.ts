import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/campaign-letter-service-facade', () => ({
  generateCampaignLettersService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {generateCampaignLettersService} from '@/services/facades/campaign-letter-service-facade'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'

const tenant = {
  id: ORG_ID,
  name: 'ASL Les Pins',
  slug: 'asl-les-pins',
  domain: 'asl-les-pins.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const call = (query = '', id = CAMPAIGN_ID) =>
  GET(new Request(`http://localhost/api/campaigns/${id}/courrier${query}`), {
    params: Promise.resolve({id}),
  })

const expectNoDetail = async (response: Response) => {
  expect(response.headers.get('Content-Type')).not.toBe('application/pdf')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.text()).toBe('')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(generateCampaignLettersService).mockResolvedValue({
    status: 'ready',
    pdf: new TextEncoder().encode('%PDF-lettres'),
    sendDate: '2026-11-12',
    letterCount: 3,
    pageCount: 5,
  })
})

describe('GET /api/campaigns/[id]/courrier — le PDF du courrier (s28)', () => {
  it('rend le PDF en pièce jointe, sans cache, sans nom de membre dans le fichier', async () => {
    const response = await call('?lettres=par-personne')

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="courrier-12-11-2026.pdf"'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.text()).toBe('%PDF-lettres')
  })

  it('annonce le nombre de lettres et de pages du lot rendu (§6.1)', async () => {
    const response = await call('?lettres=par-personne')

    expect(response.headers.get('X-Letter-Count')).toBe('3')
    expect(response.headers.get('X-Page-Count')).toBe('5')
  })

  it('le tenant vient du domaine appelé, le choix du paramètre', async () => {
    await call('?lettres=par-personne')
    await call('?lettres=par-terrain')
    await call()

    expect(vi.mocked(generateCampaignLettersService).mock.calls).toEqual([
      [ORG_ID, CAMPAIGN_ID, 'per_person'],
      [ORG_ID, CAMPAIGN_ID, 'per_land'],
      [ORG_ID, CAMPAIGN_ID, null],
    ])
  })

  it('un paramètre inconnu ne vaut aucun choix', async () => {
    await call('?lettres=tous')

    expect(generateCampaignLettersService).toHaveBeenCalledWith(
      ORG_ID,
      CAMPAIGN_ID,
      null
    )
  })

  it('aucune association sur ce domaine : 404', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined as never)

    const response = await call()
    expect(response.status).toBe(404)
    await expectNoDetail(response)
    expect(generateCampaignLettersService).not.toHaveBeenCalled()
  })

  it('sans le droit campaign.manage : 403', async () => {
    vi.mocked(generateCampaignLettersService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    const response = await call()
    expect(response.status).toBe(403)
    await expectNoDetail(response)
  })

  it('une campagne introuvable sous ce domaine (autre association comprise) : 404', async () => {
    vi.mocked(generateCampaignLettersService).mockResolvedValue({
      status: 'not_found',
    })

    const response = await call()
    expect(response.status).toBe(404)
    await expectNoDetail(response)
  })

  it('un identifiant invalide : 404', async () => {
    vi.mocked(generateCampaignLettersService).mockRejectedValue(
      new ValidationParsedZodError({issues: []} as never)
    )

    const response = await call('', 'x')
    expect(response.status).toBe(404)
  })

  it('des homonymes sans choix : 409', async () => {
    vi.mocked(generateCampaignLettersService).mockResolvedValue({
      status: 'grouping_required',
    })

    const response = await call()
    expect(response.status).toBe(409)
    await expectNoDetail(response)
  })

  it.each(['none', 'legacy'] as const)(
    'pas de courrier à produire (%s) : 422, jamais un PDF vide',
    async (status) => {
      vi.mocked(generateCampaignLettersService).mockResolvedValue({status})

      const response = await call()
      expect(response.status).toBe(422)
      await expectNoDetail(response)
    }
  )
})
