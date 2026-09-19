import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/association-settings-service-facade', () => ({
  updateAssociationSettingsService: vi.fn(),
}))

import {updateTag} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {updateAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  ACCENT_HUE_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  FORAGE_EMAIL_SETTING_KEY,
} from '@/services/types/domain/association-settings-types'

import {updateAssociationSettingsAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const settingsForm = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'user'} as never)
  vi.mocked(updateAssociationSettingsService).mockResolvedValue({
    status: 'saved',
  })
})

describe('updateAssociationSettingsAction — succes', () => {
  it('enregistre les reglages de l association du domaine appele', async () => {
    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({
        [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
        [FORAGE_EMAIL_SETTING_KEY]: '',
      })
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(updateAssociationSettingsService).toHaveBeenCalledWith(TENANT_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
      [FORAGE_EMAIL_SETTING_KEY]: '',
    })
    expect(state).toEqual({success: true, message: 'success'})
  })

  it('invalide la lecture cachee de cette association, et d elle seule', async () => {
    await updateAssociationSettingsAction(
      undefined,
      settingsForm({[CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test'})
    )

    expect(updateTag).toHaveBeenCalledTimes(1)
    expect(updateTag).toHaveBeenCalledWith(`association-settings:${TENANT_ID}`)
  })

  it('ignore une cle d une autre page : la teinte ne passe pas par les reglages', async () => {
    await updateAssociationSettingsAction(
      undefined,
      settingsForm({
        [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
        [ACCENT_HUE_SETTING_KEY]: '40',
        'cle.inconnue': 'x',
      })
    )

    expect(updateAssociationSettingsService).toHaveBeenCalledWith(TENANT_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
    })
  })
})

describe('updateAssociationSettingsAction — refus', () => {
  it('rend les erreurs par champ, sans invalider le cache', async () => {
    vi.mocked(updateAssociationSettingsService).mockResolvedValue({
      status: 'rejected',
      errors: {
        [CONTACT_EMAIL_SETTING_KEY]: {code: 'required'},
        [FORAGE_EMAIL_SETTING_KEY]: {code: 'invalidEmail'},
      },
    })

    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({
        [CONTACT_EMAIL_SETTING_KEY]: '',
        [FORAGE_EMAIL_SETTING_KEY]: 'pas-une-adresse',
      })
    )

    expect(state).toEqual({
      success: false,
      fieldErrors: {
        [CONTACT_EMAIL_SETTING_KEY]: {code: 'required'},
        [FORAGE_EMAIL_SETTING_KEY]: {code: 'invalidEmail'},
      },
    })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse cote serveur un utilisateur hors du bureau', async () => {
    vi.mocked(updateAssociationSettingsService).mockRejectedValue(
      new AuthorizationError()
    )

    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({[CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test'})
    )

    expect(state).toEqual({success: false, message: 'errors.forbidden'})
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({[CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test'})
    )

    expect(state).toEqual({success: false, message: 'errors.forbidden'})
    expect(updateAssociationSettingsService).not.toHaveBeenCalled()
  })

  it('une panne d enregistrement est rendue comme un resultat, jamais levee', async () => {
    vi.mocked(updateAssociationSettingsService).mockRejectedValue(
      new Error('connexion perdue')
    )

    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({[CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test'})
    )

    expect(state).toEqual({
      success: false,
      message: 'errors.failed',
      kept: 'errors.kept',
    })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('refuse sans formulaire', async () => {
    const state = await updateAssociationSettingsAction(undefined, undefined)

    expect(state).toEqual({success: false, message: 'errors.invalidData'})
    expect(updateAssociationSettingsService).not.toHaveBeenCalled()
  })
})
