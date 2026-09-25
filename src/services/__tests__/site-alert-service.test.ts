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
  upsertOrganizationSettingsDao: vi.fn(),
  deleteOrganizationSettingsDao: vi.fn(),
  saveOrganizationSettingsTxnDao: vi.fn(),
}))

import {
  getOrganizationSettingsDao,
  saveOrganizationSettingsTxnDao,
} from '@/db/repositories/organization-setting-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationParsedZodError} from '../errors/validation-error'
import {
  canManageSiteAlertService,
  getPublicSiteAlertService,
  getSiteAlertService,
  saveSiteAlertService,
} from '../site-alert-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {
  SITE_ALERT_ACTIVE_SETTING_KEY,
  SITE_ALERT_MESSAGE_SETTING_KEY,
} from '../types/domain/site-alert-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const MESSAGE = 'Coupure d’eau rue des Pins, jeudi 8 h – 12 h'

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

const settingRow = (key: string, value: string) => ({
  organizationId: ORG_ID,
  key,
  value,
  updatedAt: new Date(),
  updatedBy: null,
})

const storedAlert = (message: string, active: string) => {
  vi.mocked(getOrganizationSettingsDao).mockImplementation(async (id) => {
    expect(scope.current).toBe(id)
    return [
      settingRow('site.footer_content', 'Pied de page'),
      settingRow(SITE_ALERT_MESSAGE_SETTING_KEY, message),
      settingRow(SITE_ALERT_ACTIVE_SETTING_KEY, active),
    ]
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER))
  vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
  vi.mocked(saveOrganizationSettingsTxnDao).mockImplementation(async () => {
    expect(scope.current).toBe(ORG_ID)
  })
})

const expectSavedWith = (message: string, active: boolean) => {
  expect(saveOrganizationSettingsTxnDao).toHaveBeenCalledTimes(1)
  expect(saveOrganizationSettingsTxnDao).toHaveBeenCalledWith({
    organizationId: ORG_ID,
    upserts: [
      {key: SITE_ALERT_MESSAGE_SETTING_KEY, value: message},
      {key: SITE_ALERT_ACTIVE_SETTING_KEY, value: String(active)},
    ],
    deletions: [],
    updatedBy: userTest.id,
  })
}

describe('[ORGANIZATION OWNER] gestion du bandeau', () => {
  it('affiche le bandeau : message et etat ecrits ensemble, sous le scope', async () => {
    await saveSiteAlertService({
      organizationId: ORG_ID,
      message: MESSAGE,
      active: true,
    })

    expectSavedWith(MESSAGE, true)
  })

  it('retire le bandeau en conservant le message', async () => {
    await saveSiteAlertService({
      organizationId: ORG_ID,
      message: MESSAGE,
      active: false,
    })

    expectSavedWith(MESSAGE, false)
  })

  it('lit le bandeau pour l ecran du bureau, meme masque', async () => {
    storedAlert(MESSAGE, 'false')

    await expect(getSiteAlertService(ORG_ID)).resolves.toEqual({
      message: MESSAGE,
      active: false,
    })
  })

  it('sans ligne enregistree, un message vide et un bandeau masque', async () => {
    await expect(getSiteAlertService(ORG_ID)).resolves.toEqual({
      message: '',
      active: false,
    })
  })

  it('peut gerer le bandeau', async () => {
    await expect(canManageSiteAlertService(ORG_ID)).resolves.toBe(true)
  })
})

describe('[ORGANIZATION ADMIN] un membre du bureau gere le bandeau (critere 4)', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.ADMIN))
  })

  it('affiche, modifie et retire le bandeau', async () => {
    await saveSiteAlertService({
      organizationId: ORG_ID,
      message: MESSAGE,
      active: true,
    })
    expectSavedWith(MESSAGE, true)

    vi.mocked(saveOrganizationSettingsTxnDao).mockClear()
    await saveSiteAlertService({
      organizationId: ORG_ID,
      message: MESSAGE,
      active: false,
    })
    expectSavedWith(MESSAGE, false)
  })

  it('peut gerer le bandeau', async () => {
    await expect(canManageSiteAlertService(ORG_ID)).resolves.toBe(true)
  })
})

describe('[ORGANIZATION MEMBER] un membre simple ne touche pas au bandeau', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.MEMBER))
  })

  it('refuse l enregistrement sans rien ecrire', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: MESSAGE,
        active: true,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('refuse la lecture de l ecran du bureau', async () => {
    await expect(getSiteAlertService(ORG_ID)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })

  it('ne peut pas gerer le bandeau', async () => {
    await expect(canManageSiteAlertService(ORG_ID)).resolves.toBe(false)
  })
})

describe('[USER NOT IN ORGANIZATION] le bureau d une autre association est refuse', () => {
  beforeEach(() => {
    setupAuthUserMocked(withRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID))
  })

  it('refuse l enregistrement sans rien ecrire', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: MESSAGE,
        active: true,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })
})

describe('[ADMIN] un administrateur global sans appartenance est refuse', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
  })

  it('refuse l enregistrement sans rien ecrire', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: MESSAGE,
        active: true,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })
})

describe('[SUPER ADMIN] le SuperAdmin passe', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('enregistre le bandeau de n importe quelle association', async () => {
    await saveSiteAlertService({
      organizationId: ORG_ID,
      message: MESSAGE,
      active: true,
    })

    expect(saveOrganizationSettingsTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_ID})
    )
  })
})

describe('[PUBLIC] un visiteur non connecte', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('ne peut pas enregistrer le bandeau', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: MESSAGE,
        active: true,
      })
    ).rejects.toThrow(AuthorizationError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('ne peut pas gerer le bandeau', async () => {
    await expect(canManageSiteAlertService(ORG_ID)).resolves.toBe(false)
  })

  it('voit le bandeau affiche, sans session', async () => {
    storedAlert(MESSAGE, 'true')

    await expect(getPublicSiteAlertService(ORG_ID)).resolves.toEqual({
      message: MESSAGE,
    })
  })

  it('ne recoit rien quand le bandeau est masque — le message ne sort pas', async () => {
    storedAlert(MESSAGE, 'false')

    await expect(getPublicSiteAlertService(ORG_ID)).resolves.toBeNull()
  })

  it('ne recoit rien sans bandeau enregistre', async () => {
    await expect(getPublicSiteAlertService(ORG_ID)).resolves.toBeNull()
  })

  it('ne recoit rien pour un bandeau actif au message vide', async () => {
    storedAlert('', 'true')

    await expect(getPublicSiteAlertService(ORG_ID)).resolves.toBeNull()
  })

  it('ne recoit rien pour un identifiant d association invalide', async () => {
    await expect(getPublicSiteAlertService('pas-un-uuid')).resolves.toBeNull()
    expect(getOrganizationSettingsDao).not.toHaveBeenCalled()
  })
})

describe('[BUREAU] validation avant toute ecriture', () => {
  it('refuse d afficher un bandeau sans message', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: '  ',
        active: true,
      })
    ).rejects.toThrow(ValidationParsedZodError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })

  it('refuse un message de plus de 280 caracteres', async () => {
    await expect(
      saveSiteAlertService({
        organizationId: ORG_ID,
        message: 'a'.repeat(281),
        active: true,
      })
    ).rejects.toThrow(ValidationParsedZodError)
    expect(saveOrganizationSettingsTxnDao).not.toHaveBeenCalled()
  })
})
