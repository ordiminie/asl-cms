import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-annual-import-service-facade', () => ({
  importAnnualMemberContactsService: vi.fn(),
}))
vi.mock('next-intl/server', async () => {
  const messages = (await import('../../../../../../../messages/fr.json'))
    .default

  return {
    getTranslations:
      async (namespace: string) =>
      (key: string, values?: Record<string, unknown>) => {
        const text = [
          ...namespace.split('.'),
          ...key.split('.'),
        ].reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)?.[part],
          messages
        ) as string
        return values ? `${text} ${JSON.stringify(values)}` : text
      },
  }
})

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {importAnnualMemberContactsService} from '@/services/facades/member-annual-import-service-facade'
import {AnnualImportReportDTO} from '@/services/types/domain/member-annual-import-types'
import {MEMBER_IMPORT_MAX_FILE_BYTES} from '@/services/types/domain/member-import-types'

import {importAnnualMemberContactsAction} from './actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

const REPORT: AnnualImportReportDTO = {
  linesRead: 1,
  profilesUpdated: 1,
  profilesUnchanged: 0,
  membersToCreate: 0,
  linesRejected: 0,
  updated: [],
  kept: [],
  replaced: [],
  designated: [],
  disabled: [],
  manual: [],
  toCreate: [],
  rejections: [],
}

const csvFile = (name = 'clients-pennylane-2026.csv') =>
  new File(['a;b\n1;2\n'], name, {type: 'text/csv'})

const form = (
  file: File | null = csvFile(),
  extra: Record<string, string> = {}
) => {
  const formData = new FormData()
  if (file) formData.set('file', file)
  for (const [key, value] of Object.entries(extra)) formData.set(key, value)
  return formData
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({
    id: TENANT_ID,
    name: 'Rives Vertes',
  } as never)
  vi.mocked(requireActionAuth).mockResolvedValue({} as never)
  vi.mocked(importAnnualMemberContactsService).mockResolvedValue({
    status: 'imported',
    report: REPORT,
  })
})

describe('importAnnualMemberContactsAction (s56)', () => {
  it('met à jour l’association du domaine, jamais celle du formulaire, et relit les fiches', async () => {
    const state = await importAnnualMemberContactsAction(
      undefined,
      form(csvFile(), {organizationId: OTHER_ID})
    )

    expect(requireActionAuth).toHaveBeenCalled()
    expect(importAnnualMemberContactsService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      content: expect.any(Uint8Array),
    })
    expect(state).toMatchObject({
      success: true,
      report: REPORT,
      fileName: 'clients-pennylane-2026.csv',
      importedAt: expect.any(String),
    })
    expect(revalidatePath).toHaveBeenCalledWith(
      '/[locale]/(bureau)/bureau/proprietaires',
      'layout'
    )
  })

  it('un membre du Bureau est refusé par le service : rendu, jamais levé', async () => {
    vi.mocked(importAnnualMemberContactsService).mockRejectedValue(
      new AuthorizationError('non')
    )

    const state = await importAnnualMemberContactsAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'forbidden'})
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('sans session : refusé, rien n’est importé', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const state = await importAnnualMemberContactsAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'forbidden'})
    expect(importAnnualMemberContactsService).not.toHaveBeenCalled()
  })

  it('refuse un formulaire sans fichier', async () => {
    const state = await importAnnualMemberContactsAction(undefined, form(null))

    expect(state).toMatchObject({success: false, error: 'invalid_data'})
    expect(importAnnualMemberContactsService).not.toHaveBeenCalled()
  })

  it('refuse un fichier qui n’est pas un .csv', async () => {
    const state = await importAnnualMemberContactsAction(
      undefined,
      form(csvFile('clients.xlsx'))
    )

    expect(state).toMatchObject({success: false, error: 'file_type'})
    expect(importAnnualMemberContactsService).not.toHaveBeenCalled()
  })

  it('refuse un fichier de plus de 16 Mo', async () => {
    const file = csvFile()
    Object.defineProperty(file, 'size', {
      value: MEMBER_IMPORT_MAX_FILE_BYTES + 1,
    })

    const state = await importAnnualMemberContactsAction(undefined, form(file))

    expect(state).toMatchObject({success: false, error: 'file_too_large'})
    expect(importAnnualMemberContactsService).not.toHaveBeenCalled()
  })

  it('fichier illisible : la cause et « aucune fiche n’a été modifiée » (1d)', async () => {
    vi.mocked(importAnnualMemberContactsService).mockResolvedValue({
      status: 'file_refused',
      reason: 'missing_columns',
      missingColumns: ['Identifiant Client'],
    })

    const state = await importAnnualMemberContactsAction(undefined, form())

    expect(state).toMatchObject({
      success: false,
      error: 'file_unreadable',
      title: 'Le fichier n’a pas pu être lu.',
      message: 'Aucune fiche n’a été modifiée.',
    })
    expect(state.detail).toContain('« Identifiant Client »')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('arrêt en cours : relancer le même fichier termine (1e)', async () => {
    vi.mocked(importAnnualMemberContactsService).mockRejectedValue(
      new Error('coupure')
    )

    const state = await importAnnualMemberContactsAction(undefined, form())

    expect(state).toMatchObject({success: false, error: 'failed'})
    expect(revalidatePath).toHaveBeenCalled()
  })
})
