import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/dal/tenant-dal', () => ({getCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/association-settings-dal', () => ({
  getAssociationSettingsDal: vi.fn(),
}))
vi.mock('@/env', () => ({
  env: {BETTER_AUTH_URL: 'https://plateforme.test'},
}))

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  ACCENT_HUE_SETTING_KEY,
  ASSOCIATION_DESCRIPTION_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  GOOGLE_VERIFICATION_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import {getCurrentAssociationSeoDal} from './seo-dal'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const tenant = {
  id: ORG_ID,
  name: 'Les Amis de l’Étang',
  slug: 'amis-etang',
  domain: 'lesamisdeletang.fr',
  enabledModules: [],
  logoKey: `${ORG_ID}/identity/logo-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
  faviconKey: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentTenantDal).mockResolvedValue(tenant)
  vi.mocked(getAssociationSettingsDal).mockResolvedValue(
    resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [])
  )
})

describe('getCurrentAssociationSeoDal (s11)', () => {
  it('rassemble nom, description, code, version du logo, teinte et origine de l association du domaine', async () => {
    vi.mocked(getAssociationSettingsDal).mockResolvedValue(
      resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
        {key: ASSOCIATION_DESCRIPTION_SETTING_KEY, value: 'Réseau privé.'},
        {key: GOOGLE_VERIFICATION_SETTING_KEY, value: 'abc-DEF_123'},
        {key: ACCENT_HUE_SETTING_KEY, value: '40'},
      ])
    )

    expect(await getCurrentAssociationSeoDal()).toEqual({
      name: 'Les Amis de l’Étang',
      description: 'Réseau privé.',
      googleVerification: 'abc-DEF_123',
      logoVersion: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      hue: 40,
      origin: 'https://lesamisdeletang.fr',
    })
    expect(getAssociationSettingsDal).toHaveBeenCalledWith(ORG_ID)
  })

  it('reglages vides : ni description ni code', async () => {
    const seo = await getCurrentAssociationSeoDal()

    expect(seo?.description).toBeNull()
    expect(seo?.googleVerification).toBeUndefined()
    expect(seo?.hue).toBe(195)
  })

  it('domaine qui ne sert aucune association : rien', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    expect(await getCurrentAssociationSeoDal()).toBeUndefined()
    expect(getAssociationSettingsDal).not.toHaveBeenCalled()
  })
})
