import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/document-template-service-facade', () => ({
  renderTemplateDocumentService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {renderTemplateDocumentService} from '@/services/facades/document-template-service-facade'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_ID = 'a1200000-0000-4000-8000-000000000001'

const tenant = {
  id: ORG_ID,
  name: 'Clos-Fleuri',
  slug: 'clos-fleuri',
  domain: 'clos-fleuri.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const call = (
  query = `?fiche=${PROFILE_ID}&date=2026-11-25`,
  id = TEMPLATE_ID
) =>
  GET(
    new Request(
      `http://localhost/api/document-templates/${id}/document${query}`
    ),
    {params: Promise.resolve({id})}
  )

const expectNoDetail = async (response: Response) => {
  expect(response.headers.get('Content-Type')).not.toBe('application/pdf')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.text()).toBe('')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(renderTemplateDocumentService).mockResolvedValue({
    status: 'ready',
    pdf: new TextEncoder().encode('%PDF-document'),
    fileName: 'document-25-11-2026.pdf',
  })
})

describe('GET /api/document-templates/[id]/document — critère 2', () => {
  it('rend le PDF en pièce jointe, sans cache, au nom sans donnée nominative', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="document-25-11-2026.pdf"'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.text()).toBe('%PDF-document')
  })

  it('le tenant vient du domaine appelé ; fiche et date viennent de l’adresse', async () => {
    await call()

    expect(renderTemplateDocumentService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      templateId: TEMPLATE_ID,
      memberProfileId: PROFILE_ID,
      documentDate: '2026-11-25',
    })
  })

  it('sans tenant : 404, aucun rendu', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(null as never)

    const response = await call()

    expect(response.status).toBe(404)
    expect(renderTemplateDocumentService).not.toHaveBeenCalled()
  })

  it('identifiant non uuid : 404', async () => {
    vi.mocked(renderTemplateDocumentService).mockRejectedValue(
      new ValidationParsedZodError({issues: []} as never)
    )

    const response = await call(undefined, 'pas-un-uuid')

    expect(response.status).toBe(404)
    await expectNoDetail(response)
  })

  it('modèle inconnu ou d’une autre association : 404', async () => {
    vi.mocked(renderTemplateDocumentService).mockResolvedValue({
      status: 'not_found',
    })

    const response = await call()

    expect(response.status).toBe(404)
    await expectNoDetail(response)
  })

  it('date invalide : 422', async () => {
    vi.mocked(renderTemplateDocumentService).mockResolvedValue({
      status: 'invalid_date',
    })

    const response = await call(`?fiche=${PROFILE_ID}&date=25-11-2026`)

    expect(response.status).toBe(422)
    await expectNoDetail(response)
  })

  it('modèle à variable inconnue : 422', async () => {
    vi.mocked(renderTemplateDocumentService).mockResolvedValue({
      status: 'unknown_variables',
      variables: ['adresse'],
    })

    expect((await call()).status).toBe(422)
  })

  it('échec du moteur : 500, sans détail', async () => {
    vi.mocked(renderTemplateDocumentService).mockResolvedValue({
      status: 'render_failed',
    })

    const response = await call()

    expect(response.status).toBe(500)
    await expectNoDetail(response)
  })

  it('sans l’action des modèles : 403', async () => {
    vi.mocked(renderTemplateDocumentService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    const response = await call()

    expect(response.status).toBe(403)
    await expectNoDetail(response)
  })
})
