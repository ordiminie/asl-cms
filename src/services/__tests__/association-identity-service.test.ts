import {File as NodeFile} from 'node:buffer'

import {beforeEach, describe, expect, it, vi} from 'vitest'

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/lib/files/storage/storage-factory', () => ({
  createStorage: vi.fn(() => storage),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
  updateOrganizationIdentityKeyDao: vi.fn(),
}))

import {
  getOrganizationByIdDao,
  updateOrganizationIdentityKeyDao,
} from '@/db/repositories/organization-repository'
import {createStorage} from '@/lib/files/storage/storage-factory'

import {
  canManageAssociationIdentityService,
  readAssociationIdentityFileService,
  replaceAssociationIdentityFileService,
} from '../association-identity-service'
import {AuthorizationError} from '../errors/authorization-error'
import {UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const OLD_LOGO_KEY = `${ORG_ID}/identity/logo-00000000-0000-4000-8000-000000000000.png`

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]

const fileOf = (
  head: number[],
  size = 64,
  name = 'logo.png',
  type = 'image/png'
) => {
  const content = new Uint8Array(size)
  content.set(head)
  return new NodeFile([content], name, {type}) as unknown as File
}

const withBoardRole = (
  role: OrganizationRole,
  organizationId = ORG_ID
): User => ({
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

const organization = (keys: {logo?: string | null; favicon?: string | null}) =>
  ({
    id: ORG_ID,
    name: 'ASL Les Pins',
    identityLogoKey: keys.logo ?? null,
    identityFaviconKey: keys.favicon ?? null,
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  setupAuthUserMocked(withBoardRole(UserOrganizationRoleConst.ADMIN))
  vi.mocked(getOrganizationByIdDao).mockResolvedValue(
    organization({logo: OLD_LOGO_KEY})
  )
  vi.mocked(updateOrganizationIdentityKeyDao).mockResolvedValue()
  storage.upload.mockImplementation(async (_file: File, path: string) => ({
    path,
  }))
  storage.delete.mockResolvedValue(undefined)
})

describe('[ORGANIZATION ADMIN] replaceAssociationIdentityFileService — succes', () => {
  it('ecrit sous une nouvelle cle, met a jour la reference puis supprime l ancien', async () => {
    const result = await replaceAssociationIdentityFileService(
      ORG_ID,
      'logo',
      fileOf(PNG_HEAD)
    )

    expect(result.status).toBe('replaced')
    const newKey = storage.upload.mock.calls[0][1] as string
    expect(newKey).toMatch(new RegExp(`^${ORG_ID}/identity/logo-.+\\.png$`))
    expect(newKey).not.toBe(OLD_LOGO_KEY)
    expect(result).toEqual({status: 'replaced', key: newKey})
    expect(updateOrganizationIdentityKeyDao).toHaveBeenCalledWith(
      ORG_ID,
      'logo',
      newKey
    )
    expect(storage.delete).toHaveBeenCalledWith(OLD_LOGO_KEY)

    const order = [
      storage.upload.mock.invocationCallOrder[0],
      vi.mocked(updateOrganizationIdentityKeyDao).mock.invocationCallOrder[0],
      storage.delete.mock.invocationCallOrder[0],
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('utilise l adaptateur de stockage local', async () => {
    await replaceAssociationIdentityFileService(
      ORG_ID,
      'logo',
      fileOf(PNG_HEAD)
    )

    expect(createStorage).toHaveBeenCalledWith('local', expect.anything())
  })

  it('un premier favicon ne supprime rien', async () => {
    const ICO_HEAD = [0x00, 0x00, 0x01, 0x00]

    const result = await replaceAssociationIdentityFileService(
      ORG_ID,
      'favicon',
      fileOf(ICO_HEAD, 64, 'favicon.ico', 'image/x-icon')
    )

    expect(result.status).toBe('replaced')
    expect(storage.upload.mock.calls[0][1]).toMatch(
      /\/identity\/favicon-.+\.ico$/
    )
    expect(storage.delete).not.toHaveBeenCalled()
  })
})

describe('[ORGANIZATION OWNER] replaceAssociationIdentityFileService', () => {
  it('la presidente remplace le logo', async () => {
    setupAuthUserMocked(withBoardRole(UserOrganizationRoleConst.OWNER))

    await expect(
      replaceAssociationIdentityFileService(ORG_ID, 'logo', fileOf(PNG_HEAD))
    ).resolves.toMatchObject({status: 'replaced'})
  })
})

describe('[SUPER_ADMIN] replaceAssociationIdentityFileService', () => {
  it('le SuperAdmin remplace le logo', async () => {
    setupAuthUserMocked(userTestSuperAdmin)

    await expect(
      replaceAssociationIdentityFileService(ORG_ID, 'logo', fileOf(PNG_HEAD))
    ).resolves.toMatchObject({status: 'replaced'})
  })
})

describe('replaceAssociationIdentityFileService — refus d acces, sans aucune ecriture', () => {
  it.each<[string, User | undefined]>([
    ['[PUBLIC]', undefined],
    ['[ORGANIZATION MEMBER]', withBoardRole(UserOrganizationRoleConst.MEMBER)],
    ['[ADMIN] global', userTestAdmin],
    [
      '[OTHER ORGANIZATION OWNER]',
      withBoardRole(UserOrganizationRoleConst.OWNER, OTHER_ORG_ID),
    ],
  ])('%s est refuse', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(
      replaceAssociationIdentityFileService(ORG_ID, 'logo', fileOf(PNG_HEAD))
    ).rejects.toThrow(AuthorizationError)
    expect(storage.upload).not.toHaveBeenCalled()
    expect(updateOrganizationIdentityKeyDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })
})

describe('replaceAssociationIdentityFileService — fichier refuse, rien ne change', () => {
  it('refuse un JPEG en nommant le format', async () => {
    const result = await replaceAssociationIdentityFileService(
      ORG_ID,
      'logo',
      fileOf(JPEG_HEAD, 64, 'photo.jpg', 'image/jpeg')
    )

    expect(result).toEqual({
      status: 'rejected',
      validation: {valid: false, reason: 'format', detectedFormat: 'jpeg'},
    })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(updateOrganizationIdentityKeyDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('refuse un logo trop lourd en donnant poids et limite', async () => {
    const result = await replaceAssociationIdentityFileService(
      ORG_ID,
      'logo',
      fileOf(PNG_HEAD, 1024 * 1024 + 1)
    )

    expect(result).toEqual({
      status: 'rejected',
      validation: {
        valid: false,
        reason: 'size',
        size: 1024 * 1024 + 1,
        maxBytes: 1024 * 1024,
      },
    })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(updateOrganizationIdentityKeyDao).not.toHaveBeenCalled()
  })

  it('rejette des parametres invalides avant tout controle', async () => {
    await expect(
      replaceAssociationIdentityFileService(
        '../autre',
        'logo',
        fileOf(PNG_HEAD)
      )
    ).rejects.toThrow()
    await expect(
      replaceAssociationIdentityFileService(
        ORG_ID,
        'banniere' as never,
        fileOf(PNG_HEAD)
      )
    ).rejects.toThrow()
    expect(storage.upload).not.toHaveBeenCalled()
  })
})

describe('replaceAssociationIdentityFileService — echecs partiels (ADR 015)', () => {
  it('echec de mise a jour de la reference : le nouveau fichier est supprime, l ancien reste', async () => {
    vi.mocked(updateOrganizationIdentityKeyDao).mockRejectedValue(
      new Error('base indisponible')
    )

    await expect(
      replaceAssociationIdentityFileService(ORG_ID, 'logo', fileOf(PNG_HEAD))
    ).rejects.toThrow('base indisponible')

    const newKey = storage.upload.mock.calls[0][1]
    expect(storage.delete).toHaveBeenCalledTimes(1)
    expect(storage.delete).toHaveBeenCalledWith(newKey)
    expect(storage.delete).not.toHaveBeenCalledWith(OLD_LOGO_KEY)
  })

  it('echec d ecriture du fichier : ni reference mise a jour, ni suppression', async () => {
    storage.upload.mockRejectedValue(new Error('disque plein'))

    await expect(
      replaceAssociationIdentityFileService(ORG_ID, 'logo', fileOf(PNG_HEAD))
    ).rejects.toThrow('disque plein')
    expect(updateOrganizationIdentityKeyDao).not.toHaveBeenCalled()
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it('echec de suppression de l ancien : succes quand meme, reference a jour', async () => {
    storage.delete.mockRejectedValue(new Error('permission refusee'))

    const result = await replaceAssociationIdentityFileService(
      ORG_ID,
      'logo',
      fileOf(PNG_HEAD)
    )

    expect(result.status).toBe('replaced')
    expect(updateOrganizationIdentityKeyDao).toHaveBeenCalledWith(
      ORG_ID,
      'logo',
      storage.upload.mock.calls[0][1]
    )
  })
})

describe('readAssociationIdentityFileService', () => {
  it('lit le fichier et donne le type de contenu du format valide', async () => {
    storage.download.mockResolvedValue(new Blob(['png']))

    const read = await readAssociationIdentityFileService(
      ORG_ID,
      'logo',
      OLD_LOGO_KEY
    )

    expect(storage.download).toHaveBeenCalledWith(OLD_LOGO_KEY)
    expect(read.contentType).toBe('image/png')
    expect(await read.content.text()).toBe('png')
  })

  it.each([
    `${OTHER_ORG_ID}/identity/logo-a.png`,
    `${ORG_ID}/identity/favicon-a.png`,
    `${ORG_ID}/identity/logo-a.svg`,
    `${ORG_ID}/identity/../../${OTHER_ORG_ID}/identity/logo-a.png`,
  ])(
    'refuse une cle qui n est pas un logo de cette association : %s',
    async (key) => {
      await expect(
        readAssociationIdentityFileService(ORG_ID, 'logo', key)
      ).rejects.toThrow()
      expect(storage.download).not.toHaveBeenCalled()
    }
  )
})

describe('canManageAssociationIdentityService', () => {
  it('[ORGANIZATION ADMIN] accorde l acces au bureau de l association', async () => {
    await expect(canManageAssociationIdentityService(ORG_ID)).resolves.toBe(
      true
    )
  })

  it.each<[string, User | undefined]>([
    ['[PUBLIC]', undefined],
    ['[ORGANIZATION MEMBER]', withBoardRole(UserOrganizationRoleConst.MEMBER)],
    ['[ADMIN] global', userTestAdmin],
    [
      '[OTHER ORGANIZATION ADMIN]',
      withBoardRole(UserOrganizationRoleConst.ADMIN, OTHER_ORG_ID),
    ],
  ])('%s est refuse', async (_label, user) => {
    setupAuthUserMocked(user)

    await expect(canManageAssociationIdentityService(ORG_ID)).resolves.toBe(
      false
    )
  })

  it('refuse un identifiant d organisation invalide', async () => {
    await expect(canManageAssociationIdentityService('../x')).resolves.toBe(
      false
    )
  })
})
