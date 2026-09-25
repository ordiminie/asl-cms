import {ReactElement} from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./base-layout', () => ({default: () => null}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => Promise.resolve((key: string) => key)),
  setRequestLocale: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
  requireCurrentTenantDal: vi.fn(),
}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/app/dal/site-alert-dal', () => ({
  getPublicSiteAlertDal: vi.fn(),
}))

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getPublicSiteAlertDal} from '@/app/dal/site-alert-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import LocaleLayout from './layout'

const PINS_ID = '11111111-1111-4111-8111-111111111111'
const LAC_ID = '22222222-2222-4222-8222-222222222222'
const MESSAGE = 'Coupure d’eau rue des Pins, jeudi de 8 h à 12 h.'

const layoutProps = async () => {
  const element = (await LocaleLayout({
    children: null,
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{alert?: {message: string}}>
  return element.props
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
  )
  vi.mocked(getPublicSiteAlertDal).mockImplementation(async (id) =>
    id === PINS_ID ? {message: MESSAGE} : null
  )
})

describe('LocaleLayout — bandeau d alerte de l association du domaine appele', () => {
  it('passe le bandeau affiche au gabarit commun', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({
      id: PINS_ID,
    } as never)

    expect((await layoutProps()).alert).toEqual({message: MESSAGE})
    expect(getPublicSiteAlertDal).toHaveBeenCalledWith(PINS_ID)
  })

  it('ne passe rien quand l association n affiche aucun bandeau', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: LAC_ID} as never)

    const props = await layoutProps()

    expect(props.alert).toBeUndefined()
    expect(getPublicSiteAlertDal).toHaveBeenCalledWith(LAC_ID)
  })
})
