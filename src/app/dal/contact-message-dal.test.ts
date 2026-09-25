import {beforeEach, describe, expect, it, vi} from 'vitest'
import {z} from 'zod'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/contact-message-service-facade', () => ({
  canManageContactMessagesService: vi.fn(),
  getContactMessageService: vi.fn(),
  getContactMessagesPageService: vi.fn(),
}))

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageContactMessagesService,
  getContactMessageService,
  getContactMessagesPageService,
} from '@/services/facades/contact-message-service-facade'
import {ContactMessageDTO} from '@/services/types/domain/contact-message-types'

import {
  canManageCurrentContactMessagesDal,
  getContactMessageForBureauDal,
  getContactMessagesForBureauDal,
} from './contact-message-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

const message: ContactMessageDTO = {
  id: MESSAGE_ID,
  organizationId: ORG_A,
  senderName: null,
  senderEmail: 'm.dubois@example.fr',
  subject: 'Vente de parcelle',
  body: 'Bonjour',
  read: false,
  notificationFailed: true,
  createdAt: new Date('2026-09-02T12:32:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: ORG_A} as never)
})

describe('contact-message-dal', () => {
  it('rend la page de la liste du bureau telle que le service la donne', async () => {
    const list = {
      items: [message],
      page: 2,
      pageSize: 25,
      total: 26,
      totalPages: 2,
      unreadCount: 1,
    }
    vi.mocked(getContactMessagesPageService).mockResolvedValue(list)

    await expect(getContactMessagesForBureauDal(ORG_A, 2)).resolves.toBe(list)
    expect(getContactMessagesPageService).toHaveBeenCalledWith(ORG_A, 2)
  })

  it('traduit un message absent en undefined', async () => {
    vi.mocked(getContactMessageService).mockRejectedValue(
      new NotFoundError('Message introuvable')
    )

    await expect(
      getContactMessageForBureauDal(ORG_A, MESSAGE_ID)
    ).resolves.toBeUndefined()
  })

  it('traduit un identifiant malformé en undefined, comme un message absent', async () => {
    const malformed = z.string().uuid().safeParse('pas-un-uuid')
    vi.mocked(getContactMessageService).mockRejectedValue(
      new ValidationParsedZodError(malformed.error)
    )

    await expect(
      getContactMessageForBureauDal(ORG_A, 'pas-un-uuid')
    ).resolves.toBeUndefined()
  })

  it('laisse remonter un refus d autorisation', async () => {
    vi.mocked(getContactMessageService).mockRejectedValue(
      new AuthorizationError()
    )

    await expect(
      getContactMessageForBureauDal(ORG_A, MESSAGE_ID)
    ).rejects.toThrow(AuthorizationError)
  })

  it('demande le droit pour l association du domaine appelé', async () => {
    vi.mocked(canManageContactMessagesService).mockResolvedValue(true)

    await expect(canManageCurrentContactMessagesDal()).resolves.toBe(true)
    expect(canManageContactMessagesService).toHaveBeenCalledWith(ORG_A)
  })
})
