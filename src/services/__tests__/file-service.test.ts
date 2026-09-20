/*
 * Le stockage du produit est le disque du serveur (ADR 004) : la configuration
 * simulee ici ne mentionne aucun service externe. Le chemin reel jusqu'au
 * disque est couvert par `file-service-blog.test.ts`.
 */
vi.mock('@/lib/files/storage/env', () => ({
  getStorageConfig: () => ({
    type: 'local',
    config: {
      bucket: 'files',
      basePath: 'dev',
      maxFileSize: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },
  }),
}))

import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  deleteFile,
  getFile,
  uploadFile,
} from '@/db/repositories/files-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {
  deleteFileService,
  getFileService,
  uploadFileForEntityService,
} from '../file-service'
import {RoleConst, UserOrganizationRoleConst} from '../types/domain/auth-types'
import {
  DeleteFile,
  EntityTypeConst,
  FileCategoryConst,
  GetFile,
  UploadFileForEntity,
} from '../types/domain/file-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

// Mock des repositories
vi.mock('@/db/repositories/files-repository')
vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))

import * as organizationRepository from '@/db/repositories/organization-repository'
import * as userRepository from '@/db/repositories/user-repository'

describe('[ADMIN] File Service', () => {
  const userId = faker.string.uuid()
  const organizationId = faker.string.uuid()
  const mockFile = new File(['test content'], 'test.jpg', {type: 'image/jpeg'})
  const mockBlob = new Blob(['test content'], {type: 'image/jpeg'})

  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()

    // Mock des repositories
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
      image: null,
      role: RoleConst.USER,
      visibility: 'private',
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      twoFactorEnabled: null,
      stripeCustomerId: null,
    })

    vi.mocked(organizationRepository.getOrganizationByIdDao).mockResolvedValue({
      id: organizationId,
      name: 'Test Organization',
      slug: 'test-organization',
      description: 'Test description',
      logo: null,
      metadata: null,
      limitOverrides: null,
      domain: null,
      enabledModules: [],
      identityLogoKey: null,
      identityFaviconKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(uploadFile as any).mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(getFile as any).mockResolvedValue(mockBlob)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(deleteFile as any).mockResolvedValue(undefined)
  })

  it('should upload file for user entity', async () => {
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.USER,
      entityId: userId,
      category: FileCategoryConst.PROFILE,
    }

    const result = await uploadFileForEntityService(params)

    expect(result).toMatchObject({
      size: mockFile.size,
      type: mockFile.type,
      name: mockFile.name,
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  it('should upload file for organization entity', async () => {
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.ORGANIZATION,
      entityId: organizationId,
      category: FileCategoryConst.LOGO,
    }

    const result = await uploadFileForEntityService(params)

    expect(result).toMatchObject({
      size: mockFile.size,
      type: mockFile.type,
      name: mockFile.name,
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  it('should get file by path', async () => {
    const params: GetFile = {
      path: 'users/123/profile.jpg',
    }

    const result = await getFileService(params)

    expect(result).toMatchObject({
      path: params.path,
      size: mockBlob.size,
      type: mockBlob.type,
    })
    expect(getFile).toHaveBeenCalledWith(params.path)
  })

  it('should delete file by path', async () => {
    const params: DeleteFile = {
      path: 'users/123/profile.jpg',
    }

    await deleteFileService(params)

    expect(deleteFile).toHaveBeenCalledWith(params.path)
  })
})

describe('[USER] File Service - Own Files', () => {
  const mockFile = new File(['test content'], 'test.jpg', {type: 'image/jpeg'})

  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()

    // Mock pour que l'utilisateur puisse accéder à ses propres fichiers
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue(userTest)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(uploadFile as any).mockResolvedValue(undefined)
  })

  it('should upload file to own profile', async () => {
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.USER,
      entityId: userTest.id, // Son propre ID
      category: FileCategoryConst.PROFILE,
    }

    const result = await uploadFileForEntityService(params)

    expect(result).toMatchObject({
      size: mockFile.size,
      type: mockFile.type,
      name: mockFile.name,
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  it('should NOT upload file to other user profile', async () => {
    const otherUserId = faker.string.uuid()
    vi.mocked(userRepository.getUserByIdDao).mockResolvedValue({
      id: otherUserId,
      name: 'Other User',
      email: 'other@example.com',
      emailVerified: true,
      image: null,
      role: RoleConst.USER,
      visibility: 'private',
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      twoFactorEnabled: null,
      stripeCustomerId: null,
    })

    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.USER,
      entityId: otherUserId, // ID d'un autre utilisateur
      category: FileCategoryConst.PROFILE,
    }

    await expect(uploadFileForEntityService(params)).rejects.toThrow(
      AuthorizationError
    )
    expect(uploadFile).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION OWNER] File Service', () => {
  const organizationId = faker.string.uuid()
  const mockFile = new File(['test content'], 'logo.png', {type: 'image/png'})

  beforeEach(() => {
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
            description: 'Test description',

            logo: null,
            metadata: null,
            limitOverrides: null,
            domain: null,
            enabledModules: [],
            identityLogoKey: null,
            identityFaviconKey: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }
    setupAuthUserMocked(userOwner)
    vi.clearAllMocks()

    vi.mocked(organizationRepository.getOrganizationByIdDao).mockResolvedValue({
      id: organizationId,
      name: 'Test Organization',
      slug: 'test-organization',
      description: 'Test description',
      logo: null,
      metadata: null,
      limitOverrides: null,
      domain: null,
      enabledModules: [],
      identityLogoKey: null,
      identityFaviconKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(uploadFile as any).mockResolvedValue(undefined)
  })

  it('should upload file to own organization', async () => {
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.ORGANIZATION,
      entityId: organizationId,
      category: FileCategoryConst.LOGO,
    }

    const result = await uploadFileForEntityService(params)

    expect(result).toMatchObject({
      size: mockFile.size,
      type: mockFile.type,
      name: mockFile.name,
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
  })
})

describe('[PUBLIC] File Service', () => {
  const userId = faker.string.uuid()
  const mockFile = new File(['test content'], 'public.jpg', {
    type: 'image/jpeg',
  })

  beforeEach(() => {
    setupAuthUserMocked(undefined) // Pas d'utilisateur connecté
    vi.clearAllMocks()
  })

  it('should NOT upload file as guest', async () => {
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.USER,
      entityId: userId,
      category: FileCategoryConst.PROFILE,
    }

    await expect(uploadFileForEntityService(params)).rejects.toThrow(
      AuthorizationError
    )
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('should NOT read files as guest', async () => {
    const params: GetFile = {
      path: `users/${userId}/private-document.pdf`,
    }

    await expect(getFileService(params)).rejects.toThrow(AuthorizationError)
    expect(getFile).not.toHaveBeenCalled()
  })

  it('should NOT delete files as guest', async () => {
    const params: DeleteFile = {
      path: `users/${userId}/document.pdf`,
    }

    await expect(deleteFileService(params)).rejects.toThrow(AuthorizationError)
    expect(deleteFile).not.toHaveBeenCalled()
  })
})

describe('File Service Validation', () => {
  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()
  })

  it('should throw validation error for invalid UUID', async () => {
    const mockFile = new File(['test'], 'test.jpg', {type: 'image/jpeg'})
    const params: UploadFileForEntity = {
      file: mockFile,
      entityType: EntityTypeConst.USER,
      entityId: 'invalid-uuid',
      category: FileCategoryConst.PROFILE,
    }

    await expect(uploadFileForEntityService(params)).rejects.toThrow(
      ValidationError
    )
  })

  it('should throw validation error for invalid file path', async () => {
    const params: GetFile = {
      path: '', // Chemin vide
    }

    await expect(getFileService(params)).rejects.toThrow(ValidationError)
  })
})
