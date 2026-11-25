import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/member-document-service-facade', () => ({
  readMemberDocumentFileService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {UnauthenticatedError} from '@/services/errors/unauthenticated-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {readMemberDocumentFileService} from '@/services/facades/member-document-service-facade'

import {GET} from './route'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333'
const PDF = '%PDF-1.7 facture'

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
  GET(new Request(`http://localhost/api/member-documents/${id}${query}`), {
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
  vi.mocked(readMemberDocumentFileService).mockResolvedValue({
    content: new Blob([PDF]),
    title: 'Facture 2026 — été',
  })
})

describe('GET /api/member-documents/[id] — document nominatif (s32, ADR 073 §5)', () => {
  it('rend le PDF en pièce jointe, sans cache, sous un nom ASCII tiré du titre', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="Facture-2026-ete.pdf"'
    )
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(await response.text()).toBe(PDF)
  })

  it("lit le document sous l'association du domaine appelé, par son identifiant seul", async () => {
    await call(DOCUMENT_ID, `?key=${ORG_ID}/member-documents/x/y.pdf&org=autre`)

    expect(readMemberDocumentFileService).toHaveBeenCalledWith(
      ORG_ID,
      DOCUMENT_ID
    )
  })

  it('rend 404 sans association pour ce domaine, sans rien lire', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    const response = await call()

    expect(response.status).toBe(404)
    await expectNoDetail(response)
    expect(readMemberDocumentFileService).not.toHaveBeenCalled()
  })

  it.each([
    ['sans session', new UnauthenticatedError(), 401],
    [
      'inconnu, retiré, d une autre association ou non possédé',
      new NotFoundError(),
      404,
    ],
    [
      'identifiant non uuid ou forgé (..%2F)',
      new ValidationParsedZodError(),
      404,
    ],
    ['refus d autorisation : 404, jamais 403', new AuthorizationError(), 404],
  ])('%s : %s', async (_, error, status) => {
    vi.mocked(readMemberDocumentFileService).mockRejectedValue(error)

    const response = await call('..%2F..%2Fetc')

    expect(response.status).toBe(status)
    await expectNoDetail(response)
  })

  it('laisse remonter une erreur inattendue', async () => {
    vi.mocked(readMemberDocumentFileService).mockRejectedValue(
      new Error('disk')
    )

    await expect(call()).rejects.toThrow('disk')
  })
})
