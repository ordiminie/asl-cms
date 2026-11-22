import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/shared-document-service-facade', () => ({
  readSharedDocumentFileService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {UnauthenticatedError} from '@/services/errors/unauthenticated-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {readSharedDocumentFileService} from '@/services/facades/shared-document-service-facade'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const PDF = '%PDF-1.7 statuts'

const tenant = {
  id: ORG_ID,
  name: 'ASL Clos-Fleuri',
  slug: 'clos-fleuri',
  domain: 'clos-fleuri.test',
  enabledModules: [],
  logoKey: null,
  faviconKey: null,
}

const call = (id = DOCUMENT_ID, query = '') =>
  GET(new Request(`http://localhost/api/documents/${id}${query}`), {
    params: Promise.resolve({id}),
  })

const expectNoDetail = async (response: Response) => {
  expect(response.headers.get('Content-Type')).not.toBe('application/pdf')
  expect(response.headers.get('Content-Disposition')).toBeNull()
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.text()).toBe('')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(readSharedDocumentFileService).mockResolvedValue({
    content: new Blob([PDF]),
    title: "Statuts de l'ASL",
  })
})

describe('GET /api/documents/[id] — document partagé (s31, ADR 069)', () => {
  it('rend le PDF en pièce jointe, sans cache, sous un nom ASCII tiré du titre', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="Statuts-de-l-ASL.pdf"'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.text()).toBe(PDF)
  })

  it("lit le document sous l'association du domaine appelé, par son identifiant seul", async () => {
    await call(DOCUMENT_ID, `?key=${ORG_ID}/shared-documents/x.pdf&org=autre`)

    expect(readSharedDocumentFileService).toHaveBeenCalledWith(
      ORG_ID,
      DOCUMENT_ID
    )
  })

  it('rend 404 sans association pour ce domaine, sans rien lire', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const response = await call()

    expect(response.status).toBe(404)
    await expectNoDetail(response)
    expect(readSharedDocumentFileService).not.toHaveBeenCalled()
  })

  it.each([
    ['sans session', new UnauthenticatedError(), 401],
    ['sans droit de lecture', new AuthorizationError(), 403],
    [
      'identifiant inconnu, retiré ou d une autre association',
      new NotFoundError(),
      404,
    ],
    ['identifiant invalide', new ValidationParsedZodError(), 404],
  ])('%s : %s', async (_, error, status) => {
    vi.mocked(readSharedDocumentFileService).mockRejectedValue(error)

    const response = await call()

    expect(response.status).toBe(status)
    await expectNoDetail(response)
  })

  it('laisse remonter une erreur inattendue', async () => {
    vi.mocked(readSharedDocumentFileService).mockRejectedValue(
      new Error('disk')
    )

    await expect(call()).rejects.toThrow('disk')
  })
})
