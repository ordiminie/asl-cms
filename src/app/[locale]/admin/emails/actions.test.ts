import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * s47, critère 1 : la vraie garde `requireActionAuth` → `hasRequiredRoles`
 * s'exécute. Seule la session (`getAuthUser`) est doublée. Hors rendu serveur,
 * `cache()` de React ne mémorise pas : les cas successifs le prouvent, le
 * compte `user` et le SuperAdmin passant par les mêmes arguments.
 */
vi.mock('server-only', () => ({}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/organization-service-facade', () => ({}))
vi.mock('@/services/facades/email-service-facade', () => ({
  sendAdminInternalEmailService: vi.fn(),
  sendNotificationEmailService: vi.fn(),
  sendWelcomeFollowUpEmailService: vi.fn(),
}))

import {getAuthUser} from '@/services/authentication/auth-service'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {sendNotificationEmailService} from '@/services/facades/email-service-facade'

import {sendTestEmailAction} from './actions'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const notificationParams = {
  email: 'dest@asl.test',
  title: 'Titre',
  message: 'Message',
  type: 'info',
  language: 'fr',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendTestEmailAction — réservée au SuperAdmin (s47)', () => {
  it('[USER] refuse un compte user sans envoyer d’email', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    await expect(
      sendTestEmailAction('notification', notificationParams)
    ).rejects.toThrow(AuthorizationError)
    expect(sendNotificationEmailService).not.toHaveBeenCalled()
  })

  it('[SUPER_ADMIN] envoie l’email de test', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))

    const result = await sendTestEmailAction('notification', notificationParams)

    expect(result.success).toBe(true)
    expect(sendNotificationEmailService).toHaveBeenCalledTimes(1)
  })
})
