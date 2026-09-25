import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/site-alert-service-facade', () => ({
  getSiteAlertService: vi.fn(),
  saveSiteAlertService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  getSiteAlertService,
  saveSiteAlertService,
} from '@/services/facades/site-alert-service-facade'
import {saveSiteAlertServiceSchema} from '@/services/validation/site-alert-validation'

import {removeSiteAlertAction, saveSiteAlertAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const ALERT_TAG = `site-alert:${TENANT_ID}`
const MESSAGE = 'Coupure d’eau rue des Pins, jeudi de 8 h à 12 h.'

/** L'erreur que leve reellement le service pour une saisie refusee. */
const validationErrorFor = (message: string, active: boolean) => {
  const parsed = saveSiteAlertServiceSchema.safeParse({
    organizationId: TENANT_ID,
    message,
    active,
  })
  if (parsed.success) throw new Error('saisie attendue invalide')
  return new ValidationParsedZodError(parsed.error)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(saveSiteAlertService).mockResolvedValue()
  vi.mocked(getSiteAlertService).mockResolvedValue({
    message: MESSAGE,
    active: true,
  })
})

describe('saveSiteAlertAction — succes', () => {
  it('affiche le bandeau et invalide le bandeau de cette association', async () => {
    const result = await saveSiteAlertAction(MESSAGE, true)

    expect(requireActionAuth).toHaveBeenCalled()
    expect(saveSiteAlertService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      message: MESSAGE,
      active: true,
    })
    expect(result).toEqual({status: 'saved', active: true})
    expect(updateTag).toHaveBeenCalledWith(ALERT_TAG)
  })
})

describe('removeSiteAlertAction — succes', () => {
  it('retire le bandeau en conservant le message enregistre', async () => {
    const result = await removeSiteAlertAction()

    expect(getSiteAlertService).toHaveBeenCalledWith(TENANT_ID)
    expect(saveSiteAlertService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      message: MESSAGE,
      active: false,
    })
    expect(result).toEqual({status: 'saved', active: false})
    expect(updateTag).toHaveBeenCalledWith(ALERT_TAG)
  })
})

describe('Actions du bandeau — refus', () => {
  it('refuse un membre hors du bureau, message traduit, rien invalide', async () => {
    vi.mocked(saveSiteAlertService).mockRejectedValue(new AuthorizationError())

    const result = await saveSiteAlertAction(MESSAGE, true)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse le retrait a un membre hors du bureau', async () => {
    vi.mocked(getSiteAlertService).mockRejectedValue(new AuthorizationError())

    const result = await removeSiteAlertAction()

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(saveSiteAlertService).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await saveSiteAlertAction(MESSAGE, true)

    expect(result).toEqual({status: 'error', message: 'forbidden'})
    expect(saveSiteAlertService).not.toHaveBeenCalled()
  })

  it('rend une panne comme un resultat, jamais levee', async () => {
    vi.mocked(saveSiteAlertService).mockRejectedValue(
      new Error('connexion perdue')
    )

    const result = await saveSiteAlertAction(MESSAGE, true)

    expect(result).toEqual({status: 'error', message: 'failed'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('saveSiteAlertAction — erreur de validation rendue au champ', () => {
  it('message vide a l affichage', async () => {
    vi.mocked(saveSiteAlertService).mockRejectedValue(
      validationErrorFor('', true)
    )

    const result = await saveSiteAlertAction('', true)

    expect(result).toEqual({status: 'invalid', message: 'messageRequired'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('message de plus de 280 caracteres', async () => {
    vi.mocked(saveSiteAlertService).mockRejectedValue(
      validationErrorFor('a'.repeat(281), true)
    )

    const result = await saveSiteAlertAction('a'.repeat(281), true)

    expect(result).toEqual({status: 'invalid', message: 'messageTooLong'})
    expect(updateTag).not.toHaveBeenCalled()
  })
})
