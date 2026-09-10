import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import * as organizationRepository from '@/db/repositories/organization-repository'
import * as userRepository from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  getOrganizationByDomainService,
  provisionOrganizationService,
  updateOrganizationModulesService,
} from '../organization-service'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {Organization} from '../types/domain/organization-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

vi.mock('@/db/repositories/organization-repository')
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
  createUserDao: vi.fn(),
}))

const ORGANIZATION_ID = faker.string.uuid()
const ADMIN_USER_ID = faker.string.uuid()

const provisionParams = {
  name: 'ASL La Fourche',
  slug: 'asl-la-fourche',
  domain: 'asl-lafourche.fr',
  adminEmail: 'presidence@asl-lafourche.fr',
  enabledModules: ['voirie' as const],
}

const provisionedOrganization = {
  id: ORGANIZATION_ID,
  name: provisionParams.name,
  slug: provisionParams.slug,
  domain: provisionParams.domain,
  enabledModules: provisionParams.enabledModules,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  logo: null,
  metadata: null,
  limitOverrides: null,
} satisfies Organization

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(
    organizationRepository.getOrganizationByDomainDao
  ).mockResolvedValue(undefined)
  vi.mocked(organizationRepository.createOrganizationDao).mockResolvedValue(
    provisionedOrganization
  )
  vi.mocked(
    organizationRepository.createOrganizationMemberDao
  ).mockResolvedValue(undefined as never)
  vi.mocked(userRepository.getUserByEmailDao).mockResolvedValue(undefined)
  vi.mocked(userRepository.createUserDao).mockResolvedValue({
    ...userTest,
    id: ADMIN_USER_ID,
    email: provisionParams.adminEmail,
  } as never)
})

describe('[SUPER_ADMIN] provisionOrganizationService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestSuperAdmin)
  })

  it('cree l association avec son domaine et ses modules', async () => {
    const result = await provisionOrganizationService(provisionParams)

    expect(organizationRepository.createOrganizationDao).toHaveBeenCalledWith(
      expect.objectContaining({
        name: provisionParams.name,
        slug: provisionParams.slug,
        domain: provisionParams.domain,
        enabledModules: provisionParams.enabledModules,
      })
    )
    expect(result.organization.id).toBe(ORGANIZATION_ID)
  })

  it('cree le compte de l administrateur initial quand il n existe pas', async () => {
    const result = await provisionOrganizationService(provisionParams)

    expect(userRepository.createUserDao).toHaveBeenCalledWith(
      expect.objectContaining({email: provisionParams.adminEmail})
    )
    expect(result.adminAccountCreated).toBe(true)
  })

  it('reutilise le compte existant plutot que d en creer un second', async () => {
    vi.mocked(userRepository.getUserByEmailDao).mockResolvedValue({
      ...userTest,
      id: ADMIN_USER_ID,
      email: provisionParams.adminEmail,
    } as never)

    const result = await provisionOrganizationService(provisionParams)

    expect(userRepository.createUserDao).not.toHaveBeenCalled()
    expect(result.adminAccountCreated).toBe(false)
    expect(result.adminUserId).toBe(ADMIN_USER_ID)
  })

  it('rattache l administrateur a ce tenant, et a lui seul', async () => {
    await provisionOrganizationService(provisionParams)

    expect(
      organizationRepository.createOrganizationMemberDao
    ).toHaveBeenCalledTimes(1)
    expect(
      organizationRepository.createOrganizationMemberDao
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ADMIN_USER_ID,
        organizationId: ORGANIZATION_ID,
        role: UserOrganizationRoleConst.OWNER,
      })
    )
  })

  it('refuse un domaine deja servi par une autre association, en la nommant', async () => {
    vi.mocked(
      organizationRepository.getOrganizationByDomainDao
    ).mockResolvedValue({
      ...provisionedOrganization,
      id: faker.string.uuid(),
      name: 'ASL Les Sources',
    })

    await expect(provisionOrganizationService(provisionParams)).rejects.toThrow(
      /ASL Les Sources/
    )
    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
    expect(userRepository.createUserDao).not.toHaveBeenCalled()
  })

  it('refuse un domaine qui n en est pas un, avant tout acces base', async () => {
    await expect(
      provisionOrganizationService({
        ...provisionParams,
        domain: 'pas un domaine',
      })
    ).rejects.toThrow()

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })

  it('refuse une adresse email d administrateur invalide', async () => {
    await expect(
      provisionOrganizationService({
        ...provisionParams,
        adminEmail: 'pas-un-email',
      })
    ).rejects.toThrow()

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })

  it('refuse une cle de module inconnue', async () => {
    await expect(
      provisionOrganizationService({
        ...provisionParams,
        enabledModules: ['module-fictif'] as never,
      })
    ).rejects.toThrow()

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[ADMIN] provisionOrganizationService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
  })

  it('refuse : provisionner est un acte du prestataire, pas de l administrateur', async () => {
    await expect(provisionOrganizationService(provisionParams)).rejects.toThrow(
      AuthorizationError
    )

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[USER] provisionOrganizationService', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTest)
  })

  it('refuse', async () => {
    await expect(provisionOrganizationService(provisionParams)).rejects.toThrow(
      AuthorizationError
    )

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] provisionOrganizationService', () => {
  beforeEach(() => {
    setupAuthUserMocked(undefined)
  })

  it('refuse', async () => {
    await expect(provisionOrganizationService(provisionParams)).rejects.toThrow(
      AuthorizationError
    )

    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('getOrganizationByDomainService', () => {
  it('[PUBLIC] rend l association servie par le domaine : la resolution precede toute session', async () => {
    setupAuthUserMocked(undefined)
    vi.mocked(
      organizationRepository.getOrganizationByDomainDao
    ).mockResolvedValue(provisionedOrganization)

    const organization = await getOrganizationByDomainService(
      provisionParams.domain
    )

    expect(organization?.id).toBe(ORGANIZATION_ID)
  })

  it('ne rend rien pour un domaine qu aucune association ne sert', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      getOrganizationByDomainService('domaine-inconnu.fr')
    ).resolves.toBeUndefined()
  })

  it('ne touche pas la base pour un domaine vide', async () => {
    setupAuthUserMocked(undefined)

    await expect(getOrganizationByDomainService('')).resolves.toBeUndefined()
    expect(
      organizationRepository.getOrganizationByDomainDao
    ).not.toHaveBeenCalled()
  })
})

describe('updateOrganizationModulesService', () => {
  beforeEach(() => {
    vi.mocked(
      organizationRepository.updateOrganizationModulesDao
    ).mockResolvedValue(undefined)
  })

  it('[SUPER_ADMIN] remplace les drapeaux de modules de l association', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    await updateOrganizationModulesService(ORGANIZATION_ID, ['vote', 'voirie'])

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).toHaveBeenCalledWith(ORGANIZATION_ID, ['vote', 'voirie'])
  })

  it('[SUPER_ADMIN] accepte la liste vide : desactiver tout est une decision', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    await updateOrganizationModulesService(ORGANIZATION_ID, [])

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).toHaveBeenCalledWith(ORGANIZATION_ID, [])
  })

  it('[SUPER_ADMIN] refuse une cle inconnue, sans rien persister', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    await expect(
      updateOrganizationModulesService(ORGANIZATION_ID, [
        'module-fictif',
      ] as never)
    ).rejects.toThrow()

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).not.toHaveBeenCalled()
  })

  it('[ADMIN] refuse', async () => {
    setupAuthUserMocked(userTestAdmin)

    await expect(
      updateOrganizationModulesService(ORGANIZATION_ID, ['vote'])
    ).rejects.toThrow(AuthorizationError)

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).not.toHaveBeenCalled()
  })

  it('[USER] refuse', async () => {
    setupAuthUserMocked(userTest)

    await expect(
      updateOrganizationModulesService(ORGANIZATION_ID, ['vote'])
    ).rejects.toThrow(AuthorizationError)

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).not.toHaveBeenCalled()
  })

  it('[PUBLIC] refuse', async () => {
    setupAuthUserMocked(undefined)

    await expect(
      updateOrganizationModulesService(ORGANIZATION_ID, ['vote'])
    ).rejects.toThrow(AuthorizationError)

    expect(
      organizationRepository.updateOrganizationModulesDao
    ).not.toHaveBeenCalled()
  })
})
