import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

vi.mock('server-only', () => ({}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getCurrentAssociationSettingsDal: vi.fn(),
}))

import {getCurrentAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import InvalidMagicLinkPage from './page'

const renderPage = async (searchParams: {motif?: string} = {}) =>
  render(
    await InvalidMagicLinkPage({
      params: Promise.resolve({locale: 'fr'}),
      searchParams: Promise.resolve(searchParams),
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/login/lien-invalide (s03, écran C ; s42a, écran 5)', () => {
  it('sans motif : l’explication du lien demandé, 20 minutes, sans lire les réglages', async () => {
    await renderPage()

    expect(screen.getByText(/reste valable 20 minutes/)).toBeInTheDocument()
    expect(getCurrentAssociationSettingsDal).not.toHaveBeenCalled()
  })

  it('motif invitation : la durée de l’invitation lue dans les réglages de l’association du domaine', async () => {
    vi.mocked(getCurrentAssociationSettingsDal).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: 'invitation.link_days', value: '10'},
      ])
    )

    await renderPage({motif: 'invitation'})

    expect(
      screen.getByText(
        /Un lien d'invitation ne sert qu'une fois et reste valable 10 jours/
      )
    ).toBeInTheDocument()
  })

  it('motif invitation sur un domaine sans association : la durée par défaut du registre', async () => {
    vi.mocked(getCurrentAssociationSettingsDal).mockResolvedValue(undefined)

    await renderPage({motif: 'invitation'})

    expect(screen.getByText(/reste valable 7 jours/)).toBeInTheDocument()
  })
})
