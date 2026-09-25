import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({refresh: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/contact-message-service-facade', () => ({
  setContactMessageReadService: vi.fn(),
}))

import {refresh} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {setContactMessageReadService} from '@/services/facades/contact-message-service-facade'

import {
  markContactMessageReadAction,
  markContactMessageUnreadAction,
} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const MESSAGE_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(setContactMessageReadService).mockResolvedValue({} as never)
})

describe('markContactMessageReadAction', () => {
  it('marque le message lu dans l’association du domaine, puis rafraîchit', async () => {
    const result = await markContactMessageReadAction(MESSAGE_ID)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(setContactMessageReadService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      messageId: MESSAGE_ID,
      read: true,
    })
    expect(result).toEqual({status: 'saved'})
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refuse sans le rôle, sans rafraîchir', async () => {
    vi.mocked(setContactMessageReadService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    const result = await markContactMessageReadAction(MESSAGE_ID)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(
      new AuthorizationError('Utilisateur non authentifié')
    )

    const result = await markContactMessageReadAction(MESSAGE_ID)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(setContactMessageReadService).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('markContactMessageUnreadAction', () => {
  it('rend le message non lu, puis rafraîchit', async () => {
    const result = await markContactMessageUnreadAction(MESSAGE_ID)

    expect(setContactMessageReadService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      messageId: MESSAGE_ID,
      read: false,
    })
    expect(result).toEqual({status: 'saved'})
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('écrit une panne sans rafraîchir', async () => {
    vi.mocked(setContactMessageReadService).mockRejectedValue(new Error('base'))

    const result = await markContactMessageUnreadAction(MESSAGE_ID)

    expect(result).toEqual({status: 'error', message: 'failed'})
    expect(refresh).not.toHaveBeenCalled()
  })
})
