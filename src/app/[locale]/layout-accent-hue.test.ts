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

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import LocaleLayout from './layout'

const PINS_ID = '11111111-1111-4111-8111-111111111111'
const LAC_ID = '22222222-2222-4222-8222-222222222222'

const hueOfLayout = async () => {
  const element = (await LocaleLayout({
    children: null,
    params: Promise.resolve({locale: 'fr'}),
  })) as ReactElement<{accentHue?: number}>
  return element.props.accentHue
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssociationSettingsDal).mockImplementation(async (id) =>
    resolveSettings(
      ASSOCIATION_SETTINGS_REGISTRY,
      id === PINS_ID ? [{key: ACCENT_HUE_SETTING_KEY, value: '150'}] : []
    )
  )
})

describe('LocaleLayout — teinte de l association du domaine appele', () => {
  it('passe la teinte choisie par l association', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({
      id: PINS_ID,
    } as never)

    expect(await hueOfLayout()).toBe(150)
    expect(getAssociationSettingsDal).toHaveBeenCalledWith(PINS_ID)
  })

  it('une association sans teinte recoit la teinte par defaut', async () => {
    vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: LAC_ID} as never)

    expect(await hueOfLayout()).toBe(195)
  })
})
