import fs from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/document-template-service-facade', () => ({
  listDocumentTemplatesService: vi.fn(),
  getDocumentTemplateService: vi.fn(),
  canManageDocumentTemplatesService: vi.fn(),
  listDocumentLotGroupsService: vi.fn(),
  getTemplateDocumentRecipientService: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: ORG_A})),
}))

import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageDocumentTemplatesService,
  getDocumentTemplateService,
  getTemplateDocumentRecipientService,
  listDocumentLotGroupsService,
  listDocumentTemplatesService,
} from '@/services/facades/document-template-service-facade'

import {
  canManageCurrentDocumentTemplatesDal,
  getDocumentLotGroupsForBureauDal,
  getDocumentTemplateForBureauDal,
  getDocumentTemplatesForBureauDal,
  getTemplateDocumentRecipientForBureauDal,
} from './document-template-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('document-template-dal (s36)', () => {
  it('lit les modèles du tenant passé', async () => {
    vi.mocked(listDocumentTemplatesService).mockResolvedValue([])

    await expect(getDocumentTemplatesForBureauDal(ORG_A)).resolves.toEqual([])
    expect(listDocumentTemplatesService).toHaveBeenCalledWith(ORG_A)
  })

  it('un identifiant malformé devient `undefined` (404), un refus remonte', async () => {
    vi.mocked(getDocumentTemplateService).mockRejectedValueOnce(
      new ValidationParsedZodError()
    )
    await expect(
      getDocumentTemplateForBureauDal(ORG_A, 'pas-un-uuid')
    ).resolves.toBeUndefined()

    const refusal = new Error('refus')
    vi.mocked(getDocumentTemplateService).mockRejectedValueOnce(refusal)
    await expect(
      getDocumentTemplateForBureauDal(ORG_A, TEMPLATE_ID)
    ).rejects.toBe(refusal)
  })

  it('lit les groupes que le lot peut viser', async () => {
    vi.mocked(listDocumentLotGroupsService).mockResolvedValue([])

    await expect(getDocumentLotGroupsForBureauDal(ORG_A)).resolves.toEqual([])
    expect(listDocumentLotGroupsService).toHaveBeenCalledWith(ORG_A)
  })

  it('lit le destinataire imprimé d’une fiche ; identifiant malformé : undefined', async () => {
    vi.mocked(getTemplateDocumentRecipientService).mockResolvedValueOnce({
      addressLines: ['Bernard Lefèvre'],
    })
    await expect(
      getTemplateDocumentRecipientForBureauDal(ORG_A, TEMPLATE_ID)
    ).resolves.toEqual({addressLines: ['Bernard Lefèvre']})
    expect(getTemplateDocumentRecipientService).toHaveBeenCalledWith({
      organizationId: ORG_A,
      memberProfileId: TEMPLATE_ID,
    })

    vi.mocked(getTemplateDocumentRecipientService).mockRejectedValueOnce(
      new ValidationParsedZodError()
    )
    await expect(
      getTemplateDocumentRecipientForBureauDal(ORG_A, 'x')
    ).resolves.toBeUndefined()
  })

  it('juge le droit sur l’association du domaine appelé', async () => {
    vi.mocked(canManageDocumentTemplatesService).mockResolvedValue(true)

    await expect(canManageCurrentDocumentTemplatesDal()).resolves.toBe(true)
    expect(canManageDocumentTemplatesService).toHaveBeenCalledWith(ORG_A)
  })

  it('ne cache rien : donnée du bureau, jamais de `use cache`', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dirname, 'document-template-dal.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/^\s*['"]use cache/m)
  })
})
