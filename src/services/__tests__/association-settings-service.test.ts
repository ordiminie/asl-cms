import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(),
  saveOrganizationSettingsTxnDao: vi.fn(),
}))

import {
  getOrganizationSettingsDao,
  saveOrganizationSettingsTxnDao,
} from '@/db/repositories/organization-setting-repository'
import {withTenant} from '@/db/tenant-scope'

import {
  getAssociationSettingsService,
  updateAssociationSettingsService,
} from '../association-settings-service'
import {AuthorizationError} from '../errors/authorization-error'
import {
  ACCENT_HUE_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  FORAGE_EMAIL_SETTING_KEY,
} from '../types/domain/association-settings-types'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'

const withRole = (role: OrganizationRole, organizationId = ORG_ID): User => ({
  ...userTest,
  organizations: [
    {
      id: 'membership',
      organizationId,
      userId: userTest.id,
      role,
      createdAt: new Date(),
    },
  ],
})

const row = (key: string, value: string) => ({
  organizationId: ORG_ID,
  key,
  value,
  updatedAt: new Date(),
  updatedBy: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getOrganizationSettingsDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
    return [row(CONTACT_EMAIL_SETTING_KEY, 'contact@asl.test')]
  })
  vi.mocked(saveOrganizationSettingsTxnDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
})

describe('getAssociationSettingsService — lecture resolue', () => {
  it('[PUBLIC] lit sans session, sous le scope de l association', async () => {
    setupAuthUserMocked(undefined)

    const settings = await getAssociationSettingsService(ORG_ID)

    expect(withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function))
    expect(getOrganizationSettingsDao).toHaveBeenCalledWith(ORG_ID)
    expect(settings[CONTACT_EMAIL_SETTING_KEY].value).toBe('contact@asl.test')
    expect(settings[FORAGE_EMAIL_SETTING_KEY]).toEqual({
      value: 'contact@asl.test',
      storedValue: null,
      defaultFromKey: CONTACT_EMAIL_SETTING_KEY,
    })
    expect(settings[ACCENT_HUE_SETTING_KEY].value).toBe('195')
  })

  it('refuse un identifiant d association invalide, sans lecture', async () => {
    await expect(getAssociationSettingsService('pas-un-uuid')).rejects.toThrow()
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

describe('updateAssociationSettingsService — acces accordes', () => {
  it.each<[string, User]>([
    ['[ORGANIZATION OWNER] la presidente', withRole('owner')],
    ['[ORGANIZATION ADMIN] le bureau', withRole('admin')],
    ['[SUPER_ADMIN]', userTestSuperAdmin],
  ])('%s enregistre', async (_label, user) => {
    setupAuthUserMocked(user)

    const result = await updateAssociationSettingsService(ORG_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'bureau@asl.test',
      [FORAGE_EMAIL_SETTING_KEY]: 'forage@asl.test',
    })

    expect(result).toEqual({status: 'saved'})
    expect(saveOrganizationSettingsTxnDao).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      upserts: [
        {key: CONTACT_EMAIL_SETTING_KEY, value: 'bureau@asl.test'},
        {key: FORAGE_EMAIL_SETTING_KEY, value: 'forage@asl.test'},
      ],
      deletions: [],
      updatedBy: user.id,
    })
  })
})

describe('updateAssociationSettingsService — refus d acces, sans aucun appel DAO', () => {
  it.each<[string, User | undefined]>([
    ['[PUBLIC]', undefined],
    ['[ORGANIZATION MEMBER]', withRole('member')],
    ['[OTHER ORGANIZATION ADMIN]', withRole('admin', OTHER_ORG_ID)],
    ['[OTHER ORGANIZATION OWNER]', withRole('owner', OTHER_ORG_ID)],
    ['[ADMIN] global', userTestAdmin],
  ])('%s est refuse', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(
      updateAssociationSettingsService(ORG_ID, {
        [CONTACT_EMAIL_SETTING_KEY]: 'bureau@asl.test',
      })
    ).rejects.toThrow(AuthorizationError)
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
    expect(withTenant).not.toHaveBeenCalled()
  })
})

describe('updateAssociationSettingsService — validation du registre', () => {
  it('une valeur invalide : rien n est ecrit, erreur par cle', async () => {
    const result = await updateAssociationSettingsService(ORG_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'bureau@asl.test',
      [FORAGE_EMAIL_SETTING_KEY]: 'pas-une-adresse',
    })

    expect(result).toEqual({
      status: 'rejected',
      errors: {[FORAGE_EMAIL_SETTING_KEY]: {code: 'invalidEmail'}},
    })
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('l adresse de contact videe est refusee, rien n est ecrit', async () => {
    const result = await updateAssociationSettingsService(ORG_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: '',
    })

    expect(result).toEqual({
      status: 'rejected',
      errors: {[CONTACT_EMAIL_SETTING_KEY]: {code: 'required'}},
    })
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('l adresse du forage videe : sa ligne est supprimee', async () => {
    const result = await updateAssociationSettingsService(ORG_ID, {
      [CONTACT_EMAIL_SETTING_KEY]: 'contact@asl.test',
      [FORAGE_EMAIL_SETTING_KEY]: '  ',
    })

    expect(result).toEqual({status: 'saved'})
    expect(saveOrganizationSettingsTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({
        upserts: [{key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'}],
        deletions: [FORAGE_EMAIL_SETTING_KEY],
      })
    )
  })

  it('une teinte hors des six teintes est refusee', async () => {
    const result = await updateAssociationSettingsService(ORG_ID, {
      [ACCENT_HUE_SETTING_KEY]: '10',
    })

    expect(result).toEqual({
      status: 'rejected',
      errors: {[ACCENT_HUE_SETTING_KEY]: {code: 'invalidChoice'}},
    })
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('refuse des modifications mal formees, sans appel DAO', async () => {
    await expect(
      updateAssociationSettingsService(ORG_ID, {
        [CONTACT_EMAIL_SETTING_KEY]: 42 as unknown as string,
      })
    ).rejects.toThrow()
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })
})
