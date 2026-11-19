import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../../messages/fr.json')).default

  return {
    setRequestLocale: vi.fn(),
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/association-identity-dal', () => ({
  canManageCurrentAssociationIdentityDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  canEditSuperAdminOnlySettingsDal: vi.fn(),
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/app/dal/member-invoice-dal', () => ({
  getBillingSyncOverviewForBureauDal: vi.fn(),
}))
vi.mock('./actions', () => ({
  requestPennylaneSyncAction: vi.fn(),
  updateAssociationSettingsAction: vi.fn(),
}))

import {render, screen} from '@/__tests__/customRender'
import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {
  canEditSuperAdminOnlySettingsDal,
  getAssociationSettingsDal,
} from '@/app/dal/association-settings-dal'
import {getBillingSyncOverviewForBureauDal} from '@/app/dal/member-invoice-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_PROVIDER_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import BureauSettingsPage from './page'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TENANT_ID = '11111111-1111-4111-8111-111111111111'

const renderPage = async () => {
  render(await BureauSettingsPage({params: Promise.resolve({locale: 'fr'})}))
}

const cardTitles = () =>
  screen
    .getAllByRole('heading', {level: 3})
    .map((heading) => heading.textContent)

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(canManageCurrentAssociationIdentityDal).mockResolvedValue(true)
  vi.mocked(canEditSuperAdminOnlySettingsDal).mockResolvedValue(false)
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
      {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
      {key: BILLING_PROVIDER_SETTING_KEY, value: 'pennylane'},
    ])
  )
})

describe('Page « Réglages » — synchronisation Pennylane (s20, écran 3)', () => {
  it('sous Pennylane : la carte d’état suit la carte « Factures »', async () => {
    vi.mocked(getBillingSyncOverviewForBureauDal).mockResolvedValue({
      lastAttemptAt: null,
      syncedAt: null,
      lastError: null,
      counts: null,
      unmatchedCustomers: [],
      terrainMismatches: [],
      profilesWithoutId: [],
    })

    await renderPage()

    expect(getBillingSyncOverviewForBureauDal).toHaveBeenCalledWith(TENANT_ID)
    const titles = cardTitles()
    expect(titles.indexOf('Synchronisation Pennylane')).toBe(
      titles.indexOf('Factures') + 1
    )
    expect(
      screen.getByText(
        'Pas encore de mise à jour. La première a lieu dans l’heure.'
      )
    ).toBeInTheDocument()
  })

  it('hors Pennylane, ou sans droit sur les factures : pas de carte', async () => {
    vi.mocked(getBillingSyncOverviewForBureauDal).mockResolvedValue(undefined)

    await renderPage()

    expect(cardTitles()).not.toContain('Synchronisation Pennylane')
  })

  it('hors du bureau : ni réglages, ni état lu', async () => {
    vi.mocked(canManageCurrentAssociationIdentityDal).mockResolvedValue(false)

    await renderPage()

    expect(getBillingSyncOverviewForBureauDal).not.toHaveBeenCalled()
  })
})
