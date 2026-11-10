import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/unsubscribe-service-facade', () => ({
  confirmUnsubscribeService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {logger} from '@/lib/logger'
import {confirmUnsubscribeService} from '@/services/facades/unsubscribe-service-facade'

import {confirmUnsubscribeAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')

const formOf = (token: string) => {
  const formData = new FormData()
  formData.set('token', token)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(confirmUnsubscribeService).mockResolvedValue({
    status: 'unsubscribed',
  })
})

describe('confirmUnsubscribeAction — action publique, sans session', () => {
  it('confirme dans le tenant du domaine appelé', async () => {
    await expect(
      confirmUnsubscribeAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'unsubscribed'})
    expect(confirmUnsubscribeService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      token: TOKEN,
    })
  })

  it.each([[{status: 'already'}], [{status: 'invalid'}]] as const)(
    'rend %j tel quel, sans détail',
    async (state) => {
      vi.mocked(confirmUnsubscribeService).mockResolvedValue(state)

      await expect(
        confirmUnsubscribeAction(undefined, formOf(TOKEN))
      ).resolves.toEqual(state)
    }
  )

  it('domaine sans association → lien invalide, sans écriture', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    await expect(
      confirmUnsubscribeAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'invalid'})
    expect(confirmUnsubscribeService).not.toHaveBeenCalled()
  })

  it('échec technique → error, sans jeton journalisé', async () => {
    vi.mocked(confirmUnsubscribeService).mockRejectedValue(new Error(TOKEN))

    await expect(
      confirmUnsubscribeAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'error'})
    const logged = JSON.stringify(
      Object.values(vi.mocked(logger)).flatMap(
        (method) => (method as ReturnType<typeof vi.fn>).mock.calls
      )
    )
    expect(logged).not.toContain(TOKEN)
  })
})
