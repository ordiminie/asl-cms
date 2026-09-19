import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock('@/app/dal/tenant-dal', () => ({
  getCurrentTenantDal: vi.fn(),
}))
vi.mock('@/services/facades/association-settings-service-facade', () => ({
  getAssociationSettingsService: vi.fn(),
}))

import {cacheLife, cacheTag} from 'next/cache'

import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {getAssociationSettingsService} from '@/services/facades/association-settings-service-facade'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  CONTACT_EMAIL_SETTING_KEY,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import {
  associationSettingsTag,
  getAssociationSettingsDal,
  getCurrentAssociationSettingsDal,
} from './association-settings-dal'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'

const settingsOf = (contact: string) =>
  resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
    {key: CONTACT_EMAIL_SETTING_KEY, value: contact},
  ])

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAssociationSettingsService).mockImplementation(async (id) =>
    settingsOf(id === ORG_A ? 'contact@a.test' : 'contact@b.test')
  )
})

describe('associationSettingsTag', () => {
  it('un tag par association, porte par son identifiant seul', () => {
    expect(associationSettingsTag(ORG_A)).toBe(`association-settings:${ORG_A}`)
    expect(associationSettingsTag(ORG_A)).not.toBe(
      associationSettingsTag(ORG_B)
    )
  })
})

describe('getAssociationSettingsDal', () => {
  it('rend les valeurs resolues de l association', async () => {
    const settings = await getAssociationSettingsDal(ORG_A)

    expect(getAssociationSettingsService).toHaveBeenCalledWith(ORG_A)
    expect(settings[CONTACT_EMAIL_SETTING_KEY].value).toBe('contact@a.test')
  })

  it('se cache sous le tag de l association, en heures', async () => {
    await getAssociationSettingsDal(ORG_A)

    expect(cacheLife).toHaveBeenCalledWith('hours')
    expect(cacheTag).toHaveBeenCalledWith(associationSettingsTag(ORG_A))
  })

  it('deux associations, deux lectures distinctes', async () => {
    const a = await getAssociationSettingsDal(ORG_A)
    const b = await getAssociationSettingsDal(ORG_B)

    expect(a[CONTACT_EMAIL_SETTING_KEY].value).toBe('contact@a.test')
    expect(b[CONTACT_EMAIL_SETTING_KEY].value).toBe('contact@b.test')
    expect(cacheTag).toHaveBeenCalledWith(associationSettingsTag(ORG_B))
  })
})

describe('getCurrentAssociationSettingsDal', () => {
  it('lit les parametres de l association du domaine appele', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue({id: ORG_B} as never)

    const settings = await getCurrentAssociationSettingsDal()

    expect(getAssociationSettingsService).toHaveBeenCalledWith(ORG_B)
    expect(settings?.[CONTACT_EMAIL_SETTING_KEY].value).toBe('contact@b.test')
  })

  it('ne lit rien sur un domaine qui ne sert aucune association', async () => {
    vi.mocked(getCurrentTenantDal).mockResolvedValue(undefined)

    await expect(getCurrentAssociationSettingsDal()).resolves.toBeUndefined()
    expect(getAssociationSettingsService).not.toHaveBeenCalled()
  })
})
