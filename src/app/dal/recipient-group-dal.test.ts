import fs from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/services/facades/recipient-group-service-facade', () => ({
  listRecipientGroupsService: vi.fn(),
  getRecipientGroupService: vi.fn(),
  canManageRecipientGroupsService: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(async () => ({id: ORG_A})),
}))

import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageRecipientGroupsService,
  getRecipientGroupService,
  listRecipientGroupsService,
} from '@/services/facades/recipient-group-service-facade'

import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupForBureauDal,
  getRecipientGroupsForBureauDal,
} from './recipient-group-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recipient-group-dal (s27)', () => {
  it('lit les groupes du tenant passé', async () => {
    vi.mocked(listRecipientGroupsService).mockResolvedValue([])

    await expect(getRecipientGroupsForBureauDal(ORG_A)).resolves.toEqual([])
    expect(listRecipientGroupsService).toHaveBeenCalledWith(ORG_A)
  })

  it('un identifiant malformé devient `undefined` (404), un refus remonte', async () => {
    vi.mocked(getRecipientGroupService).mockRejectedValueOnce(
      new ValidationParsedZodError()
    )
    await expect(
      getRecipientGroupForBureauDal(ORG_A, 'pas-un-uuid')
    ).resolves.toBeUndefined()

    const refusal = new Error('refus')
    vi.mocked(getRecipientGroupService).mockRejectedValueOnce(refusal)
    await expect(getRecipientGroupForBureauDal(ORG_A, GROUP_ID)).rejects.toBe(
      refusal
    )
  })

  it('juge le droit sur l’association du domaine appelé', async () => {
    vi.mocked(canManageRecipientGroupsService).mockResolvedValue(true)

    await expect(canManageCurrentRecipientGroupsDal()).resolves.toBe(true)
    expect(canManageRecipientGroupsService).toHaveBeenCalledWith(ORG_A)
  })

  it('ne cache rien : donnée du bureau, jamais de `use cache`', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dirname, 'recipient-group-dal.ts'),
      'utf8'
    )
    expect(source).not.toMatch(/^\s*['"]use cache/m)
  })
})
