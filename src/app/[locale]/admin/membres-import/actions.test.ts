import {beforeEach, describe, expect, it, vi} from 'vitest'

/*
 * La vraie garde `requireActionAuth` s'execute ; seule la session
 * (`getAuthUser`) est doublee, comme pour les actions des associations.
 */
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock('@/services/authentication/auth-service', () => ({
  getAuthUser: vi.fn(),
  getSessionActiveOrganizationId: vi.fn(),
}))
vi.mock('@/services/facades/user-service-facade', () => ({}))
vi.mock('@/services/facades/member-import-service-facade', () => ({
  importMembersService: vi.fn(),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../messages/fr.json')).default

  return {
    getTranslations: async (namespace: string) => (key: string) =>
      [...namespace.split('.'), ...key.split('.')].reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      ) as string,
  }
})

import {revalidatePath} from 'next/cache'

import {getAuthUser} from '@/services/authentication/auth-service'
import {importMembersService} from '@/services/facades/member-import-service-facade'
import {
  ImportReportDTO,
  MEMBER_IMPORT_MAX_FILE_BYTES,
} from '@/services/types/domain/member-import-types'

import {importMembersAction} from './actions'

const ORG_ID = '11111111-1111-4111-8111-111111111111'

const account = (role: string) => ({id: `${role}-1`, role}) as never

const REPORT: ImportReportDTO = {
  linesRead: 2,
  membersCreated: 2,
  accountsOpened: 1,
  mailOnlyMembers: 1,
  parcelsAttached: 2,
  linesRejected: 0,
  alreadyPresent: 0,
  rejections: [],
  remarks: [],
}

const csvFile = (name = 'proprietaires-fictifs.csv', content = 'a;b\n1;2\n') =>
  new File([content], name, {type: 'text/csv'})

const form = (file: File | null = csvFile(), organizationId = ORG_ID) => {
  const formData = new FormData()
  formData.set('organizationId', organizationId)
  if (file) formData.set('file', file)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(account('super_admin'))
  vi.mocked(importMembersService).mockResolvedValue({
    status: 'imported',
    report: REPORT,
  })
})

describe('importMembersAction', () => {
  it('refuse tout compte qui n’est pas SuperAdmin, sans rien importer', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(account('user'))

    const state = await importMembersAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'forbidden'})
    expect(importMembersService).not.toHaveBeenCalled()
  })

  it('refuse sans session', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(undefined)

    const state = await importMembersAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'forbidden'})
    expect(importMembersService).not.toHaveBeenCalled()
  })

  it('refuse un formulaire sans fichier', async () => {
    const state = await importMembersAction(undefined, form(null))

    expect(state).toMatchObject({success: false, error: 'invalid_data'})
    expect(importMembersService).not.toHaveBeenCalled()
  })

  it('refuse un fichier qui n’est pas un .csv', async () => {
    const state = await importMembersAction(
      undefined,
      form(csvFile('proprietaires.xlsx'))
    )

    expect(state).toMatchObject({success: false, error: 'file_type'})
    expect(importMembersService).not.toHaveBeenCalled()
  })

  it('refuse un fichier de plus de 16 Mo', async () => {
    const file = csvFile()
    Object.defineProperty(file, 'size', {
      value: MEMBER_IMPORT_MAX_FILE_BYTES + 1,
    })

    const state = await importMembersAction(undefined, form(file))

    expect(state).toMatchObject({success: false, error: 'file_too_large'})
    expect(importMembersService).not.toHaveBeenCalled()
  })

  it('dit « Rien n’a été importé. » pour un fichier illisible', async () => {
    vi.mocked(importMembersService).mockResolvedValue({
      status: 'file_refused',
      reason: 'binary',
    })

    const state = await importMembersAction(undefined, form())

    expect(state).toMatchObject({
      success: false,
      error: 'file_unreadable',
      title: 'Le fichier n’a pas pu être lu.',
      message: 'Rien n’a été importé.',
    })
  })

  it('signale une association disparue', async () => {
    vi.mocked(importMembersService).mockResolvedValue({
      status: 'organization_not_found',
    })

    const state = await importMembersAction(undefined, form())

    expect(state).toMatchObject({
      success: false,
      error: 'organization_missing',
      message: 'Rien n’a été importé.',
    })
  })

  it('rend l’erreur inattendue comme un résultat, jamais levée', async () => {
    vi.mocked(importMembersService).mockRejectedValue(new Error('panne'))

    const state = await importMembersAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'failed'})
  })

  it('transmet le contenu du fichier et rend le rapport', async () => {
    const state = await importMembersAction(
      undefined,
      form(csvFile('proprietaires-fictifs.CSV', 'x;y\n'))
    )

    const [input] = vi.mocked(importMembersService).mock.calls[0]
    expect(input.organizationId).toBe(ORG_ID)
    expect(new TextDecoder().decode(input.content)).toBe('x;y\n')
    expect(state).toMatchObject({
      success: true,
      report: REPORT,
      fileName: 'proprietaires-fictifs.CSV',
      organizationId: ORG_ID,
    })
    expect(revalidatePath).toHaveBeenCalled()
  })
})
