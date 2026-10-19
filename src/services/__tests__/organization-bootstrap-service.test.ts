import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import * as organizationRepository from '@/db/repositories/organization-repository'
import * as organizationSettingRepository from '@/db/repositories/organization-setting-repository'
import * as userRepository from '@/db/repositories/user-repository'
import {withRlsBypass} from '@/db/tenant-scope'

import {
  ValidationError,
  ValidationParsedZodError,
} from '../errors/validation-error'
import {bootstrapPlatformService} from '../organization-service'
import {CONTACT_EMAIL_SETTING_KEY} from '../types/domain/association-settings-types'
import {RoleConst, UserOrganizationRoleConst} from '../types/domain/auth-types'
import {Organization} from '../types/domain/organization-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest} from './service-test-data'

const scope = vi.hoisted(() => ({
  bypass: false,
  tenant: undefined as string | undefined,
}))

vi.mock('@/db/repositories/organization-repository')
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  upsertOrganizationSettingsDao: vi.fn(),
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.tenant = organizationId
    try {
      return await callback()
    } finally {
      scope.tenant = undefined
    }
  }),
  withRlsBypass: vi.fn(async (callback: () => unknown) => {
    scope.bypass = true
    try {
      return await callback()
    } finally {
      scope.bypass = false
    }
  }),
}))
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
  getUserByEmailDao: vi.fn(),
  createUserDao: vi.fn(),
  updateUserSafeByUidDao: vi.fn(),
  hasSuperAdminDao: vi.fn(),
}))

const ORGANIZATION_ID = faker.string.uuid()
const SUPER_ADMIN_ID = faker.string.uuid()

const bootstrapParams = {
  name: 'ASL Exemple',
  slug: 'asl-exemple',
  domain: 'asl-exemple.test',
  adminEmail: 'prestataire@exemple.test',
  contactEmail: 'contact@asl-exemple.test',
}

const bootstrappedOrganization = {
  id: ORGANIZATION_ID,
  name: bootstrapParams.name,
  slug: bootstrapParams.slug,
  domain: bootstrapParams.domain,
  enabledModules: [],
  identityLogoKey: null,
  identityFaviconKey: null,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  logo: null,
  metadata: null,
  limitOverrides: null,
} satisfies Organization

beforeEach(() => {
  vi.clearAllMocks()
  scope.bypass = false
  scope.tenant = undefined
  setupAuthUserMocked(undefined)
  vi.mocked(userRepository.hasSuperAdminDao).mockResolvedValue(false)
  vi.mocked(
    organizationRepository.getOrganizationByDomainDao
  ).mockResolvedValue(undefined)
  vi.mocked(organizationRepository.createOrganizationDao).mockResolvedValue(
    bootstrappedOrganization
  )
  vi.mocked(
    organizationRepository.createOrganizationMemberDao
  ).mockResolvedValue(undefined as never)
  vi.mocked(userRepository.getUserByEmailDao).mockResolvedValue(undefined)
  vi.mocked(userRepository.createUserDao).mockResolvedValue({
    ...userTest,
    id: SUPER_ADMIN_ID,
    email: bootstrapParams.adminEmail,
  } as never)
  vi.mocked(userRepository.updateUserSafeByUidDao).mockResolvedValue()
  vi.mocked(
    organizationSettingRepository.upsertOrganizationSettingsDao
  ).mockResolvedValue(undefined)
})

describe('[CLI, sans session] bootstrapPlatformService — amorçage d une base neuve', () => {
  it('crée la première association, son paramétrage et le compte super_admin rattaché', async () => {
    const result = await bootstrapPlatformService(bootstrapParams)

    expect(organizationRepository.createOrganizationDao).toHaveBeenCalledWith({
      name: bootstrapParams.name,
      slug: bootstrapParams.slug,
      domain: bootstrapParams.domain,
      enabledModules: [],
    })
    expect(userRepository.createUserDao).toHaveBeenCalledWith(
      expect.objectContaining({email: bootstrapParams.adminEmail})
    )
    expect(userRepository.updateUserSafeByUidDao).toHaveBeenCalledWith(
      expect.objectContaining({role: RoleConst.SUPER_ADMIN}),
      SUPER_ADMIN_ID
    )
    expect(
      organizationRepository.createOrganizationMemberDao
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SUPER_ADMIN_ID,
        organizationId: ORGANIZATION_ID,
        role: UserOrganizationRoleConst.OWNER,
      })
    )
    expect(
      organizationSettingRepository.upsertOrganizationSettingsDao
    ).toHaveBeenCalledWith([
      {
        organizationId: ORGANIZATION_ID,
        key: CONTACT_EMAIL_SETTING_KEY,
        value: bootstrapParams.contactEmail,
      },
    ])
    expect(result).toEqual({
      organization: bootstrappedOrganization,
      superAdminUserId: SUPER_ADMIN_ID,
    })
  })

  it('écrit tout sous la porte dérobée de la RLS, le paramétrage sous le scope du nouveau tenant', async () => {
    const seen: {dao: string; bypass: boolean; tenant?: string}[] = []
    vi.mocked(organizationRepository.createOrganizationDao).mockImplementation(
      async () => {
        seen.push({dao: 'organization', bypass: scope.bypass})
        return bootstrappedOrganization
      }
    )
    vi.mocked(userRepository.createUserDao).mockImplementation(async () => {
      seen.push({dao: 'user', bypass: scope.bypass})
      return {...userTest, id: SUPER_ADMIN_ID} as never
    })
    vi.mocked(
      organizationSettingRepository.upsertOrganizationSettingsDao
    ).mockImplementation(async () => {
      seen.push({dao: 'setting', bypass: scope.bypass, tenant: scope.tenant})
    })

    await bootstrapPlatformService(bootstrapParams)

    expect(withRlsBypass).toHaveBeenCalledTimes(1)
    expect(seen).toEqual([
      {dao: 'organization', bypass: true},
      {dao: 'user', bypass: true},
      {dao: 'setting', bypass: true, tenant: ORGANIZATION_ID},
    ])
  })

  it('refuse de tourner si un super_admin existe déjà, sans rien créer', async () => {
    vi.mocked(userRepository.hasSuperAdminDao).mockResolvedValue(true)

    await expect(bootstrapPlatformService(bootstrapParams)).rejects.toThrow(
      ValidationError
    )
    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
    expect(userRepository.createUserDao).not.toHaveBeenCalled()
    expect(userRepository.updateUserSafeByUidDao).not.toHaveBeenCalled()
  })

  it('refuse de tourner si le domaine sert déjà une association, sans rien créer', async () => {
    vi.mocked(
      organizationRepository.getOrganizationByDomainDao
    ).mockResolvedValue(bootstrappedOrganization)

    await expect(bootstrapPlatformService(bootstrapParams)).rejects.toThrow(
      ValidationError
    )
    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
    expect(userRepository.createUserDao).not.toHaveBeenCalled()
  })

  it.each([
    ['un domaine invalide', {domain: 'pas un domaine'}],
    ['un email invalide', {adminEmail: 'pas-un-email'}],
    ['un nom vide', {name: ''}],
    ['une adresse de contact absente', {contactEmail: ''}],
  ])('refuse %s, avant toute lecture en base', async (_label, override) => {
    await expect(
      bootstrapPlatformService({...bootstrapParams, ...override})
    ).rejects.toThrow(ValidationParsedZodError)
    expect(withRlsBypass).not.toHaveBeenCalled()
    expect(userRepository.hasSuperAdminDao).not.toHaveBeenCalled()
    expect(organizationRepository.createOrganizationDao).not.toHaveBeenCalled()
  })
})
