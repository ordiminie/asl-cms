import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => `ReportPage.${key}`)
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/app/dal/association-category-dal', () => ({
  getActiveReportCategoriesDal: vi.fn(),
}))
vi.mock('@/services/facades/incident-report-service-facade', () => ({
  createMyIncidentReportService: vi.fn(),
}))
vi.mock('@/services/facades/rate-limit-service-facade', () => ({
  consumeContactMessageQuotaService: vi.fn(),
}))

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {createMyIncidentReportService} from '@/services/facades/incident-report-service-facade'
import {consumeContactMessageQuotaService} from '@/services/facades/rate-limit-service-facade'

import {submitMyReportAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

const reportForm = (overrides: Record<string, string> = {}) => {
  const formData = new FormData()
  const values = {
    locale: 'fr',
    categoryId: CATEGORY_ID,
    location: 'Chemin des Pins, devant la parcelle 47',
    description: 'L’eau sort de la chaussée.',
    ...overrides,
  }
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireActionAuth).mockResolvedValue(
    {} as Awaited<ReturnType<typeof requireActionAuth>>
  )
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as Awaited<ReturnType<typeof requireCurrentTenantDal>>)
  vi.mocked(getActiveReportCategoriesDal).mockResolvedValue([
    {id: CATEGORY_ID, name: "Fuite d'eau"},
  ])
  vi.mocked(createMyIncidentReportService).mockResolvedValue({
    status: 'created',
    id: '33333333-3333-4333-8333-333333333333',
    notificationFailed: false,
  })
})

describe('submitMyReportAction — le membre déclare depuis son espace (s22)', () => {
  it('refuse sans session, sans rien écrire', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    await expect(
      submitMyReportAction({status: 'idle'}, reportForm())
    ).resolves.toEqual({status: 'failed'})
    expect(createMyIncidentReportService).not.toHaveBeenCalled()
  })

  it('rend les erreurs de s10 pour une saisie invalide, sans écriture', async () => {
    const result = await submitMyReportAction(
      {status: 'idle'},
      reportForm({categoryId: '', location: '  '})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'categoryId',
          message: 'ReportPage.validation.categoryRequired',
        },
        {field: 'location', message: 'ReportPage.validation.locationRequired'},
      ],
    })
    expect(createMyIncidentReportService).not.toHaveBeenCalled()
  })

  it('transmet le signalement sans aucune identité, puis revient à l’espace', async () => {
    const formData = reportForm()
    formData.set('name', 'Quelqu’un d’autre')
    formData.set('email', 'autre@example.test')
    formData.set('memberId', '99999999-9999-4999-8999-999999999999')

    await expect(
      submitMyReportAction({status: 'idle'}, formData)
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard?signalement=envoye')
    expect(createMyIncidentReportService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      locale: 'fr',
      categoryId: CATEGORY_ID,
      location: 'Chemin des Pins, devant la parcelle 47',
      description: 'L’eau sort de la chaussée.',
    })
  })

  it('n’envoie pas de catégorie quand l’association n’en propose aucune', async () => {
    vi.mocked(getActiveReportCategoriesDal).mockResolvedValue([])

    await expect(
      submitMyReportAction({status: 'idle'}, reportForm({categoryId: ''}))
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(createMyIncidentReportService).toHaveBeenCalledWith(
      expect.not.objectContaining({categoryId: expect.anything()})
    )
  })

  it('ne consomme aucun quota (arbitrage V1)', async () => {
    await expect(
      submitMyReportAction({status: 'idle'}, reportForm())
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(consumeContactMessageQuotaService).not.toHaveBeenCalled()
  })

  it('rend un échec générique sans fiche dans l’association', async () => {
    vi.mocked(createMyIncidentReportService).mockResolvedValue({
      status: 'not_found',
    })

    await expect(
      submitMyReportAction({status: 'idle'}, reportForm())
    ).resolves.toEqual({status: 'failed'})
  })

  it('rend un échec générique sur une erreur technique', async () => {
    vi.mocked(createMyIncidentReportService).mockRejectedValue(
      new Error('connexion perdue')
    )

    await expect(
      submitMyReportAction({status: 'idle'}, reportForm())
    ).resolves.toEqual({status: 'failed'})
  })
})
