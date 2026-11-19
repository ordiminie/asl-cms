import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({updateTag: vi.fn(), revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key
    )
  ),
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/association-settings-dal', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/association-settings-service-facade', () => ({
  updateAssociationSettingsService: vi.fn(),
}))
vi.mock('@/services/facades/pennylane-sync-service-facade', () => ({
  requestPennylaneSyncService: vi.fn(),
  schedulePennylaneSyncService: vi.fn(),
}))

import {revalidatePath, updateTag} from 'next/cache'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {updateAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  requestPennylaneSyncService,
  schedulePennylaneSyncService,
} from '@/services/facades/pennylane-sync-service-facade'
import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_PROVIDER_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  FORAGE_EMAIL_SETTING_KEY,
  GOOGLE_VERIFICATION_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import {
  requestPennylaneSyncAction,
  updateAssociationSettingsAction,
} from './actions'

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
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: GOOGLE_VERIFICATION_SETTING_KEY, value: 'ancien-code'},
    ])
  )
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

describe('updateAssociationSettingsAction — carte « Referencement » (s11)', () => {
  it('un reglage de referencement modifie : le succes dit que Google en tiendra compte', async () => {
    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({
        [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
        [GOOGLE_VERIFICATION_SETTING_KEY]: 'abc-DEF_123',
      })
    )

    expect(updateAssociationSettingsService).toHaveBeenCalledWith(TENANT_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
      [GOOGLE_VERIFICATION_SETTING_KEY]: 'abc-DEF_123',
    })
    expect(state).toEqual({success: true, message: 'successSeo'})
  })

  it('un reglage de referencement renvoye inchange : le succes habituel', async () => {
    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({
        [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
        [GOOGLE_VERIFICATION_SETTING_KEY]: 'ancien-code',
      })
    )

    expect(state).toEqual({success: true, message: 'success'})
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

describe('updateAssociationSettingsAction — passage à Pennylane (s20, ADR 062 §8)', () => {
  it('programme la synchronisation horaire quand le fournisseur passe à Pennylane', async () => {
    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({[BILLING_PROVIDER_SETTING_KEY]: 'pennylane'})
    )

    expect(state.success).toBe(true)
    expect(schedulePennylaneSyncService).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(Date)
    )
  })

  it('aucune tâche pour un autre réglage, ni pour « Saisie par le bureau »', async () => {
    await updateAssociationSettingsAction(
      undefined,
      settingsForm({[BILLING_PROVIDER_SETTING_KEY]: 'manual'})
    )
    await updateAssociationSettingsAction(
      undefined,
      settingsForm({[CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test'})
    )

    expect(schedulePennylaneSyncService).not.toHaveBeenCalled()
  })

  it('un refus d’enregistrement ne programme rien', async () => {
    vi.mocked(updateAssociationSettingsService).mockResolvedValue({
      status: 'rejected',
      errors: {[BILLING_PROVIDER_SETTING_KEY]: {code: 'invalidChoice'}},
    })

    await updateAssociationSettingsAction(
      undefined,
      settingsForm({[BILLING_PROVIDER_SETTING_KEY]: 'pennylane'})
    )

    expect(schedulePennylaneSyncService).not.toHaveBeenCalled()
  })

  it('une programmation impossible ne défait pas l’enregistrement', async () => {
    vi.mocked(schedulePennylaneSyncService).mockRejectedValue(new Error('base'))

    const state = await updateAssociationSettingsAction(
      undefined,
      settingsForm({[BILLING_PROVIDER_SETTING_KEY]: 'pennylane'})
    )

    expect(state).toEqual({success: true, message: 'success'})
  })
})

describe('requestPennylaneSyncAction — « Mettre à jour maintenant » (s20)', () => {
  const counts = {
    written: 3,
    draft: 0,
    creditNote: 0,
    noCustomer: 0,
    noDate: 0,
    notEur: 0,
    nonPositive: 0,
    unmatched: 0,
  }

  it('synchronise l’association du domaine appelé, puis rafraîchit la page', async () => {
    vi.mocked(requestPennylaneSyncService).mockResolvedValue({
      status: 'synced',
      counts,
    })

    const state = await requestPennylaneSyncAction()

    expect(requireActionAuth).toHaveBeenCalled()
    expect(requestPennylaneSyncService).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(Date)
    )
    expect(revalidatePath).toHaveBeenCalledWith('/bureau/reglages')
    expect(state).toEqual({status: 'synced', message: 'pennylaneSync.synced'})
  })

  it.each([
    'missing_key',
    'unauthorized',
    'unavailable',
    'rate_limited',
  ] as const)(
    'échec %s : rendu avec son motif, page rafraîchie',
    async (error) => {
      vi.mocked(requestPennylaneSyncService).mockResolvedValue({
        status: 'failed',
        error,
      })

      const state = await requestPennylaneSyncAction()

      expect(state).toEqual({
        status: 'failed',
        message: `pennylaneSync.errors.${error}`,
      })
      expect(revalidatePath).toHaveBeenCalled()
    }
  )

  it('le bureau d’une autre association est refusé par le service : rendu, jamais levé', async () => {
    vi.mocked(requestPennylaneSyncService).mockRejectedValue(
      new AuthorizationError('refus')
    )

    expect(await requestPennylaneSyncAction()).toEqual({
      status: 'error',
      message: 'errors.forbidden',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans session : refusé, sans appeler le service', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError('x'))

    expect(await requestPennylaneSyncAction()).toEqual({
      status: 'error',
      message: 'errors.forbidden',
    })
    expect(requestPennylaneSyncService).not.toHaveBeenCalled()
  })

  it('une panne est rendue comme un résultat', async () => {
    vi.mocked(requestPennylaneSyncService).mockRejectedValue(new Error('base'))

    expect(await requestPennylaneSyncAction()).toEqual({
      status: 'error',
      message: 'pennylaneSync.errors.unavailable',
    })
  })
})
