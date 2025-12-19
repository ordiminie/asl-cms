import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  createOrganizationDao,
  deleteInvitationByIdDao,
  deleteOrganizationDao,
  getOrganizationByIdDao,
  getOrganizationMembersDao,
  getOrganizationsByUserIdDao,
  getOrganizationsDao,
  updateOrganizationDao,
} from '@/db/repositories/organization-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {
  createOrganizationService,
  deleteInvitationByIdService,
  deleteOrganizationService,
  getOrganizationByIdService,
  getOrganizationMembersService,
  getOrganizationsByUserIdService,
  getOrganizationsService,
  updateOrganizationService,
} from '../organization-service'
import {Pagination} from '../types/common-type'
import {RoleConst, UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  CreateOrganization,
  Organization,
  UpdateOrganization,
} from '../types/domain/organization-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

// Mock des DAOs
vi.mock('@/db/repositories/organization-repository')

// Mock des données de test pour les membres
const mockMemberData = [
  {
    id: faker.string.uuid(),
    createdAt: new Date(),
    userId: 'user-1',
    organizationId: 'org-1',
    role: UserOrganizationRoleConst.MEMBER,
    user: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      role: RoleConst.USER,
      banned: null,
      banReason: null,
      banExpires: null,
      visibility: 'public' as const,
      twoFactorEnabled: false,
      stripeCustomerId: null,
    },
  },
  {
    id: faker.string.uuid(),
    createdAt: new Date(),
    userId: 'user-2',
    organizationId: 'org-1',
    role: UserOrganizationRoleConst.ADMIN,
    user: {
      id: 'user-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      role: RoleConst.USER,
      banned: null,
      banReason: null,
      banExpires: null,
      visibility: 'public' as const,
      twoFactorEnabled: false,
      stripeCustomerId: null,
    },
  },
]

describe('[ADMIN] CRUD : OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const createData: CreateOrganization = {
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
  }

  const updateData: UpdateOrganization = {
    id: organizationId,
    name: 'Updated Organization',
    slug: 'updated-organization',
    description: 'Description mise à jour',
  }

  const pagination: Pagination = {
    limit: 10,
    offset: 0,
  }

  beforeEach(() => {
    // Admin système peut tout faire
    const user = {
      ...userTestAdmin,
    }
    setupAuthUserMocked(user)
    vi.clearAllMocks()
    vi.mocked(createOrganizationDao).mockResolvedValue(organizationData)
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(getOrganizationsDao).mockResolvedValue({
      data: [organizationData],
      pagination: {total: 1, page: 1, limit: 10, totalPages: 1},
    })
    vi.mocked(getOrganizationsByUserIdDao).mockResolvedValue([organizationData])
    vi.mocked(updateOrganizationDao).mockResolvedValue()
    vi.mocked(deleteOrganizationDao).mockResolvedValue()
  })

  it('should create a new organization', async () => {
    const result = await createOrganizationService(createData)

    expect(result).toEqual(organizationData)
    expect(createOrganizationDao).toHaveBeenCalledTimes(1)
  })

  it('should get an organization by id', async () => {
    const result = await getOrganizationByIdService(organizationId)

    expect(result).toEqual(organizationData)
    expect(getOrganizationByIdDao).toHaveBeenCalledWith(organizationId)
  })

  it('should update an organization', async () => {
    await updateOrganizationService(updateData)

    expect(updateOrganizationDao).toHaveBeenCalledTimes(1)
  })

  it('should delete an organization', async () => {
    await deleteOrganizationService(organizationId)

    expect(deleteOrganizationDao).toHaveBeenCalledWith(organizationId)
  })

  it('should get all organizations', async () => {
    const result = await getOrganizationsService(pagination)

    expect(result).toEqual({
      data: [organizationData],
      pagination: {total: 1, page: 1, limit: 10, totalPages: 1},
    })
    expect(getOrganizationsDao).toHaveBeenCalledWith(pagination)
  })

  it('should get organizations by user id', async () => {
    const result = await getOrganizationsByUserIdService(userTestAdmin.id)

    expect(result).toEqual([organizationData])
    expect(getOrganizationsByUserIdDao).toHaveBeenCalledWith(userTestAdmin.id)
  })
})

describe('[ORGANIZATION OWNER] CRUD : OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const updateData: UpdateOrganization = {
    id: organizationId,
    name: 'Updated Organization',
    slug: 'updated-organization',
    description: 'Description mise à jour',
  }

  beforeEach(() => {
    // Utilisateur qui est OWNER de cette organisation
    const userOwner = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.OWNER,
          joinedAt: new Date(),
          organization: {
            id: organizationId,
            name: 'Test Organization',
            slug: 'test-organization',
            description: 'Description de test',
            logo: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }
    setupAuthUserMocked(userOwner)
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(updateOrganizationDao).mockResolvedValue()
    vi.mocked(deleteOrganizationDao).mockResolvedValue()
  })

  it('should update organization as owner', async () => {
    await updateOrganizationService(updateData)

    expect(updateOrganizationDao).toHaveBeenCalledTimes(1)
  })

  it('should delete organization as owner', async () => {
    await deleteOrganizationService(organizationId)

    expect(deleteOrganizationDao).toHaveBeenCalledWith(organizationId)
  })
})

describe('[ORGANIZATION ADMIN] CRUD : OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const updateData: UpdateOrganization = {
    id: organizationId,
    name: 'Updated Organization',
    slug: 'updated-organization',
    description: 'Description mise à jour',
  }

  beforeEach(() => {
    // Utilisateur qui est ADMIN de cette organisation
    const userAdmin = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.ADMIN,
          joinedAt: new Date(),
          organization: {
            id: organizationId,
            name: 'Test Organization',
            slug: 'test-organization',
            description: 'Description de test',
            logo: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }
    setupAuthUserMocked(userAdmin)
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(updateOrganizationDao).mockResolvedValue()
    vi.mocked(deleteOrganizationDao).mockResolvedValue()
  })

  it('should update organization as admin', async () => {
    await updateOrganizationService(updateData)

    expect(updateOrganizationDao).toHaveBeenCalledTimes(1)
  })

  it('should NOT delete organization as admin (only owner can)', async () => {
    await expect(deleteOrganizationService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER] CRUD : OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const updateData: UpdateOrganization = {
    id: organizationId,
    name: 'Updated Organization',
    slug: 'updated-organization',
    description: 'Description mise à jour',
  }

  beforeEach(() => {
    // Utilisateur qui est MEMBER de cette organisation
    const userMember = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.MEMBER,
          joinedAt: new Date(),
          organization: {
            id: organizationId,
            name: 'Test Organization',
            slug: 'test-organization',
            description: 'Description de test',
            logo: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }
    setupAuthUserMocked(userMember)
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(updateOrganizationDao).mockResolvedValue()
    vi.mocked(deleteOrganizationDao).mockResolvedValue()
  })

  it('should read organization as member', async () => {
    const result = await getOrganizationByIdService(organizationId)

    expect(result).toEqual(organizationData)
    expect(getOrganizationByIdDao).toHaveBeenCalledWith(organizationId)
  })

  it('should NOT update organization as member', async () => {
    await expect(updateOrganizationService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateOrganizationDao).not.toHaveBeenCalled()
  })

  it('should NOT delete organization as member', async () => {
    await expect(deleteOrganizationService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[USER NOT IN ORGANIZATION] CRUD : OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const otherOrganizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const createData: CreateOrganization = {
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
  }

  const updateData: UpdateOrganization = {
    id: organizationId,
    name: 'Updated Organization',
    slug: 'updated-organization',
    description: 'Description mise à jour',
  }

  beforeEach(() => {
    // Utilisateur connecté mais pas membre de cette organisation
    const userNotInOrg = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId: otherOrganizationId, // Différente organisation
          role: UserOrganizationRoleConst.OWNER,
          joinedAt: new Date(),
          organization: {
            id: otherOrganizationId,
            name: 'Other Organization',
            slug: 'other-organization',
            description: 'Description autre',
            logo: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }
    setupAuthUserMocked(userNotInOrg)
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(updateOrganizationDao).mockResolvedValue()
    vi.mocked(deleteOrganizationDao).mockResolvedValue()
  })

  it('should create a new organization (any user can create)', async () => {
    vi.mocked(createOrganizationDao).mockResolvedValue(organizationData)

    const result = await createOrganizationService(createData)

    expect(result).toEqual(organizationData)
    expect(createOrganizationDao).toHaveBeenCalledTimes(1)
  })

  it('should read organization (general read permission)', async () => {
    const result = await getOrganizationByIdService(organizationId)

    expect(result).toEqual(organizationData)
    expect(getOrganizationByIdDao).toHaveBeenCalledWith(organizationId)
  })

  it('should NOT update organization if not member', async () => {
    await expect(updateOrganizationService(updateData)).rejects.toThrow(
      AuthorizationError
    )
    expect(updateOrganizationDao).not.toHaveBeenCalled()
  })

  it('should NOT delete organization if not owner', async () => {
    await expect(deleteOrganizationService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteOrganizationDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] OrganizationService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  const createData: CreateOrganization = {
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
  }

  beforeEach(() => {
    // Pas d'utilisateur connecté (guest)
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
  })

  it('should NOT create organization as guest', async () => {
    await expect(createOrganizationService(createData)).rejects.toThrow(
      AuthorizationError
    )
    expect(createOrganizationDao).not.toHaveBeenCalled()
  })

  it('should NOT read organization as guest (authentication required)', async () => {
    await expect(getOrganizationByIdService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationByIdDao).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION MEMBER READ ACCESS] getOrganizationMembersService', () => {
  const organizationId = faker.string.uuid()
  const organizationData: Organization = {
    id: organizationId,
    name: 'Test Organization',
    slug: 'test-organization',
    description: 'Description de test',
    logo: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    limitOverrides: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByIdDao).mockResolvedValue(organizationData)
    vi.mocked(getOrganizationMembersDao).mockResolvedValue(mockMemberData)
  })

  it('[ORGANIZATION OWNER] should be able to read organization members', async () => {
    const userOwner = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.OWNER,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userOwner)

    const result = await getOrganizationMembersService(organizationId)

    expect(result).toEqual(mockMemberData)
    expect(getOrganizationMembersDao).toHaveBeenCalledWith(organizationId)
  })

  it('[ORGANIZATION ADMIN] should be able to read organization members', async () => {
    const userAdmin = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.ADMIN,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userAdmin)

    const result = await getOrganizationMembersService(organizationId)

    expect(result).toEqual(mockMemberData)
    expect(getOrganizationMembersDao).toHaveBeenCalledWith(organizationId)
  })

  it('[ORGANIZATION MEMBER] should be able to read organization members', async () => {
    const userMember = {
      ...userTest,
      organizations: [
        {
          id: faker.string.uuid(),
          createdAt: new Date(),
          userId: userTest.id,
          organizationId,
          role: UserOrganizationRoleConst.MEMBER,
          joinedAt: new Date(),
        },
      ],
    }
    setupAuthUserMocked(userMember)

    const result = await getOrganizationMembersService(organizationId)

    expect(result).toEqual(mockMemberData)
    expect(getOrganizationMembersDao).toHaveBeenCalledWith(organizationId)
  })

  it('[ADMIN SYSTEM] should be able to read organization members', async () => {
    setupAuthUserMocked(userTestAdmin)

    const result = await getOrganizationMembersService(organizationId)

    expect(result).toEqual(mockMemberData)
    expect(getOrganizationMembersDao).toHaveBeenCalledWith(organizationId)
  })

  it('[USER NOT IN ORGANIZATION] should NOT be able to read organization members', async () => {
    const userNotInOrg = {
      ...userTest,
      organizations: [], // Pas membre de cette organisation
    }
    setupAuthUserMocked(userNotInOrg)

    await expect(getOrganizationMembersService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationMembersDao).not.toHaveBeenCalled()
  })

  it('[PUBLIC/GUEST] should NOT be able to read organization members', async () => {
    setupAuthUserMocked(undefined) // Pas d'utilisateur connecté

    await expect(getOrganizationMembersService(organizationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(getOrganizationMembersDao).not.toHaveBeenCalled()
  })
})

describe('[ADMIN] deleteInvitationByIdService', () => {
  const invitationId = faker.string.uuid()

  beforeEach(() => {
    // Admin système peut supprimer les invitations
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
    vi.mocked(deleteInvitationByIdDao).mockResolvedValue()
  })

  it('should delete invitation as admin', async () => {
    await deleteInvitationByIdService(invitationId)

    expect(deleteInvitationByIdDao).toHaveBeenCalledWith(invitationId)
  })

  it('should throw ValidationError for invalid UUID', async () => {
    await expect(deleteInvitationByIdService('invalid-uuid')).rejects.toThrow()
    expect(deleteInvitationByIdDao).not.toHaveBeenCalled()
  })
})

describe('[NON-ADMIN] deleteInvitationByIdService', () => {
  const invitationId = faker.string.uuid()

  beforeEach(() => {
    // Utilisateur normal sans permissions admin
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()
    vi.mocked(deleteInvitationByIdDao).mockResolvedValue()
  })

  it('should NOT delete invitation as non-admin user', async () => {
    await expect(deleteInvitationByIdService(invitationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteInvitationByIdDao).not.toHaveBeenCalled()
  })
})

describe('[PUBLIC] deleteInvitationByIdService', () => {
  const invitationId = faker.string.uuid()

  beforeEach(() => {
    // Pas d'utilisateur connecté (guest)
    setupAuthUserMocked(undefined)
    vi.clearAllMocks()
    vi.mocked(deleteInvitationByIdDao).mockResolvedValue()
  })

  it('should NOT delete invitation as guest', async () => {
    await expect(deleteInvitationByIdService(invitationId)).rejects.toThrow(
      AuthorizationError
    )
    expect(deleteInvitationByIdDao).not.toHaveBeenCalled()
  })
})
