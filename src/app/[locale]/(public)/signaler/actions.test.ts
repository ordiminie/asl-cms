import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `ReportPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
}))
vi.mock('@/app/dal/association-category-dal', () => ({
  getActiveReportCategoriesDal: vi.fn(),
}))
vi.mock('@/services/facades/incident-report-service-facade', () => ({
  createIncidentReportService: vi.fn(),
}))
vi.mock('@/services/facades/rate-limit-service-facade', () => ({
  consumeContactMessageQuotaService: vi.fn(),
}))
vi.mock('next/headers', () => ({headers: vi.fn()}))

import {headers} from 'next/headers'
import {getTranslations} from 'next-intl/server'

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {createIncidentReportService} from '@/services/facades/incident-report-service-facade'
import {consumeContactMessageQuotaService} from '@/services/facades/rate-limit-service-facade'

import {submitReportAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const VISITOR_IP = '203.0.113.7'

const tenant = {
  id: TENANT_ID,
  name: "Les Amis de l'Étang",
  slug: 'amis-etang',
  domain: 'amis-etang.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const reportForm = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  const values = {
    locale: 'fr',
    categoryId: CATEGORY_ID,
    location: 'Chemin des Pins, devant la parcelle 47',
    description: 'L’eau sort de la chaussée.',
    name: '',
    email: '',
    phone: '',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(headers).mockResolvedValue(
    new Headers({'x-forwarded-for': VISITOR_IP}) as Awaited<
      ReturnType<typeof headers>
    >
  )
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(getActiveReportCategoriesDal).mockResolvedValue([
    {id: CATEGORY_ID, name: "Fuite d'eau"},
  ])
  vi.mocked(consumeContactMessageQuotaService).mockResolvedValue({
    allowed: true,
    limit: 3,
  })
  vi.mocked(createIncidentReportService).mockResolvedValue({
    status: 'created',
    id: '33333333-3333-4333-8333-333333333333',
    notificationFailed: false,
  })
})

describe('submitReportAction', () => {
  it("enregistre le signalement pour l'association servie par le domaine", async () => {
    const state = await submitReportAction(
      {status: 'idle'},
      reportForm({
        name: 'Paul Ferrand',
        email: 'p.ferrand@example.fr',
        phone: '06 12 34 56 78',
      })
    )

    expect(state).toEqual({
      status: 'sent',
      recontact: {phone: '06 12 34 56 78', email: 'p.ferrand@example.fr'},
    })
    expect(createIncidentReportService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      locale: 'fr',
      categoryId: CATEGORY_ID,
      location: 'Chemin des Pins, devant la parcelle 47',
      description: 'L’eau sort de la chaussée.',
      name: 'Paul Ferrand',
      email: 'p.ferrand@example.fr',
      phone: '06 12 34 56 78',
    })
  })

  it('omet les coordonnées laissées vides, et le dit dans la phrase de rappel', async () => {
    const state = await submitReportAction({status: 'idle'}, reportForm())

    expect(state).toEqual({status: 'sent', recontact: {}})
    const [input] = vi.mocked(createIncidentReportService).mock.calls[0]
    expect(input).not.toHaveProperty('name')
    expect(input).not.toHaveProperty('email')
    expect(input).not.toHaveProperty('phone')
  })

  it('reste un succès, sans rien dire, quand la notification au bureau n’est pas partie', async () => {
    vi.mocked(createIncidentReportService).mockResolvedValue({
      status: 'created',
      id: '33333333-3333-4333-8333-333333333333',
      notificationFailed: true,
    })

    const state = await submitReportAction({status: 'idle'}, reportForm())

    expect(state).toEqual({status: 'sent', recontact: {}})
  })

  it('rejette une saisie invalide champ par champ, sans quota ni écriture', async () => {
    const state = await submitReportAction(
      {status: 'idle'},
      reportForm({
        categoryId: '',
        description: '   ',
        email: 'p.ferrand@example',
      })
    )

    expect(state).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'categoryId',
          message: 'ReportPage.validation.categoryRequired',
        },
        {
          field: 'description',
          message: 'ReportPage.validation.descriptionRequired',
        },
        {field: 'email', message: 'ReportPage.validation.emailInvalid'},
      ],
    })
    expect(consumeContactMessageQuotaService).not.toHaveBeenCalled()
    expect(createIncidentReportService).not.toHaveBeenCalled()
  })

  it('refuse une catégorie que l’association ne propose pas, sans quota ni écriture', async () => {
    const state = await submitReportAction(
      {status: 'idle'},
      reportForm({categoryId: '55555555-5555-4555-8555-555555555555'})
    )

    expect(state).toMatchObject({
      status: 'invalid',
      errors: [{field: 'categoryId'}],
    })
    expect(consumeContactMessageQuotaService).not.toHaveBeenCalled()
    expect(createIncidentReportService).not.toHaveBeenCalled()
  })

  it('accepte un signalement sans catégorie quand l’association n’en propose aucune', async () => {
    vi.mocked(getActiveReportCategoriesDal).mockResolvedValue([])

    const state = await submitReportAction(
      {status: 'idle'},
      reportForm({categoryId: ''})
    )

    expect(state.status).toBe('sent')
    const [input] = vi.mocked(createIncidentReportService).mock.calls[0]
    expect(input).not.toHaveProperty('categoryId')
  })

  it('lit les catégories de l’association servie par le domaine', async () => {
    await submitReportAction({status: 'idle'}, reportForm())

    expect(getActiveReportCategoriesDal).toHaveBeenCalledWith(TENANT_ID)
  })

  it('consomme le quota partagé avec /contact, pour l’IP du visiteur (critère 9)', async () => {
    await submitReportAction({status: 'idle'}, reportForm())

    expect(consumeContactMessageQuotaService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      ip: VISITOR_IP,
    })
    expect(
      vi.mocked(consumeContactMessageQuotaService).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(createIncidentReportService).mock.invocationCallOrder[0]
    )
  })

  it('refuse au-delà du seuil, sans rien écrire, en rendant le seuil', async () => {
    vi.mocked(consumeContactMessageQuotaService).mockResolvedValue({
      allowed: false,
      limit: 3,
    })

    const state = await submitReportAction({status: 'idle'}, reportForm())

    expect(state).toEqual({status: 'rate_limited', limit: 3})
    expect(createIncidentReportService).not.toHaveBeenCalled()
  })

  it('ne transmet jamais l’adresse IP au service des signalements', async () => {
    await submitReportAction(
      {status: 'idle'},
      reportForm({email: 'p.ferrand@example.fr'})
    )

    const [input] = vi.mocked(createIncidentReportService).mock.calls[0]
    expect(JSON.stringify(input)).not.toContain(VISITOR_IP)
    expect(JSON.stringify(input)).not.toMatch(/"ip"|forwarded/i)
  })

  it('traduit dans la locale du formulaire, ramenée à celle du produit', async () => {
    await submitReportAction({status: 'idle'}, reportForm({locale: 'xx'}))

    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'fr',
      namespace: 'ReportPage',
    })
    expect(createIncidentReportService).toHaveBeenCalledWith(
      expect.objectContaining({locale: 'fr'})
    )
  })

  it("n'écrit rien sur un domaine qui ne sert aucune association", async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    await expect(
      submitReportAction({status: 'idle'}, reportForm())
    ).rejects.toThrow()
    expect(createIncidentReportService).not.toHaveBeenCalled()
  })
})
