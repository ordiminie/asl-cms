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
vi.mock('@/services/facades/member-email-confirmation-service-facade', () => ({
  confirmMemberEmailService: vi.fn(),
}))

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {logger} from '@/lib/logger'
import {confirmMemberEmailService} from '@/services/facades/member-email-confirmation-service-facade'

import {confirmMemberEmailAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')

const formOf = (token: string) => {
  const formData = new FormData()
  formData.set('token', token)
  formData.set('organizationId', 'autre-association')
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(confirmMemberEmailService).mockResolvedValue({
    status: 'confirmed',
    replaced: false,
  })
})

describe('confirmMemberEmailAction — action publique, sans session (s54, 3a)', () => {
  it('confirme dans le tenant du domaine appelé, jamais celui du formulaire', async () => {
    await expect(
      confirmMemberEmailAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'confirmed', replaced: false})
    expect(confirmMemberEmailService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      token: TOKEN,
    })
  })

  it('domaine inconnu : lien inutilisable, sans appeler le service', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    await expect(
      confirmMemberEmailAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'invalid'})
    expect(confirmMemberEmailService).not.toHaveBeenCalled()
  })

  it('une panne rend une erreur sans détail, et le jeton n’est jamais journalisé', async () => {
    vi.mocked(confirmMemberEmailService).mockRejectedValue(new Error('boom'))

    await expect(
      confirmMemberEmailAction(undefined, formOf(TOKEN))
    ).resolves.toEqual({status: 'error'})
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      TOKEN
    )
  })
})
