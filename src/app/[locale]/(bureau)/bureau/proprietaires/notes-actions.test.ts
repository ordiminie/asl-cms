import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({revalidatePath: vi.fn()}))
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve(
      (key: string, values?: Record<string, unknown>) =>
        `BureauMemberProfilesPage.${key}${values ? JSON.stringify(values) : ''}`
    )
  ),
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock('@/app/dal/tenant-dal', () => ({requireCurrentTenantDal: vi.fn()}))
vi.mock('@/app/dal/user-dal', () => ({requireActionAuth: vi.fn()}))
vi.mock('@/services/facades/member-note-service-facade', () => ({
  addMemberNoteService: vi.fn(),
  addMemberExchangeService: vi.fn(),
  updateMemberNoteService: vi.fn(),
  updateMemberExchangeService: vi.fn(),
  deleteMemberNoteService: vi.fn(),
}))

import {revalidatePath} from 'next/cache'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {logger} from '@/lib/logger'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  addMemberExchangeService,
  addMemberNoteService,
  deleteMemberNoteService,
  updateMemberExchangeService,
  updateMemberNoteService,
} from '@/services/facades/member-note-service-facade'
import type {MemberNoteDTO} from '@/services/types/domain/member-note-types'

import {
  addMemberExchangeAction,
  addMemberNoteAction,
  deleteMemberNoteAction,
  updateMemberNoteAction,
} from './notes-actions'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const NOTE_ID = '44444444-4444-4444-8444-444444444444'
const ROUTE = '/[locale]/(bureau)/bureau/proprietaires'
const SECRET = 'Ne pas appeler avant 10 h : travaille de nuit.'

const formOf = (values: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const note: MemberNoteDTO = {
  id: NOTE_ID,
  kind: 'note',
  channel: null,
  entryDate: '2026-11-09',
  body: SECRET,
  authorName: 'Marie Delorme',
  createdAt: '2026-11-09T09:41:00.000Z',
  updatedAt: null,
}

const allLoggerCalls = () =>
  Object.values(vi.mocked(logger)).flatMap(
    (method) => (method as ReturnType<typeof vi.fn>).mock.calls
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({toFake: ['Date']})
  vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'))
  vi.mocked(requireCurrentTenantDal).mockResolvedValue({id: TENANT_ID} as never)
  vi.mocked(requireActionAuth).mockResolvedValue({id: 'u1'} as never)
  for (const service of [
    addMemberNoteService,
    addMemberExchangeService,
    updateMemberNoteService,
    updateMemberExchangeService,
  ]) {
    vi.mocked(service).mockResolvedValue({status: 'saved', note})
  }
  vi.mocked(deleteMemberNoteService).mockResolvedValue({status: 'deleted'})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('addMemberNoteAction', () => {
  it('écrit la note pour le tenant du domaine, puis revalide le segment', async () => {
    const result = await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: SECRET})
    )

    expect(addMemberNoteService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      body: SECRET,
    })
    expect(result).toEqual({
      status: 'saved',
      message: 'BureauMemberProfilesPage.detail.notes.saved.note.created',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('refuse sans session, sans appeler la façade ni revalider', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: SECRET})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(addMemberNoteService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend les erreurs d’une saisie vide, sans écriture', async () => {
    const result = await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: '   '})
    )

    expect(result).toEqual({
      status: 'invalid',
      errors: [
        {
          field: 'body',
          message:
            'BureauMemberProfilesPage.detail.notes.validation.bodyRequired.note',
        },
      ],
    })
    expect(addMemberNoteService).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend l’échec d’enregistrement sans revalider', async () => {
    vi.mocked(addMemberNoteService).mockRejectedValue(new Error('panne'))

    const result = await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: SECRET})
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.detail.notes.failed.save.note',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rend une fiche introuvable comme un échec, sans revalider', async () => {
    vi.mocked(addMemberNoteService).mockResolvedValue({status: 'not_found'})

    const result = await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: SECRET})
    )

    expect(result.status).toBe('error')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('ne fait passer le texte de la note dans aucun journal, même en échec', async () => {
    vi.mocked(addMemberNoteService).mockRejectedValue(new Error('panne'))

    await addMemberNoteAction(
      undefined,
      formOf({memberProfileId: PROFILE_ID, body: SECRET})
    )

    expect(JSON.stringify(allLoggerCalls())).not.toContain(SECRET)
  })
})

describe('addMemberExchangeAction', () => {
  const exchangeForm = (values: Record<string, string> = {}) =>
    formOf({
      memberProfileId: PROFILE_ID,
      entryDate: '28/10/2026',
      channel: 'phone',
      body: 'Appelé au sujet de la cotisation.',
      ...values,
    })

  it('écrit l’échange au jour choisi, converti en ISO', async () => {
    const result = await addMemberExchangeAction(undefined, exchangeForm())

    expect(addMemberExchangeService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      entryDate: '2026-10-28',
      channel: 'phone',
      body: 'Appelé au sujet de la cotisation.',
    })
    expect(result).toEqual({
      status: 'saved',
      message: 'BureauMemberProfilesPage.detail.notes.saved.exchange.created',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('refuse une date future, un canal manquant et un résumé vide, sans écriture', async () => {
    const result = await addMemberExchangeAction(
      undefined,
      exchangeForm({entryDate: '12/12/2026', channel: '', body: ''})
    )

    expect(result.status).toBe('invalid')
    expect(
      result.status === 'invalid' && result.errors.map((e) => e.field).sort()
    ).toEqual(['body', 'channel', 'entryDate'])
    expect(addMemberExchangeService).not.toHaveBeenCalled()
  })
})

describe('updateMemberNoteAction', () => {
  it('modifie une note : texte seul', async () => {
    const result = await updateMemberNoteAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        noteId: NOTE_ID,
        kind: 'note',
        body: 'Nouveau texte',
      })
    )

    expect(updateMemberNoteService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      noteId: NOTE_ID,
      body: 'Nouveau texte',
    })
    expect(updateMemberExchangeService).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'saved',
      message: 'BureauMemberProfilesPage.detail.notes.saved.note.updated',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('modifie un échange : jour, canal et résumé', async () => {
    await updateMemberNoteAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        noteId: NOTE_ID,
        kind: 'exchange',
        entryDate: '01/10/2026',
        channel: 'mail',
        body: 'Résumé',
      })
    )

    expect(updateMemberExchangeService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      noteId: NOTE_ID,
      entryDate: '2026-10-01',
      channel: 'mail',
      body: 'Résumé',
    })
  })

  it('refuse un type inconnu sans rien écrire', async () => {
    const result = await updateMemberNoteAction(
      undefined,
      formOf({
        memberProfileId: PROFILE_ID,
        noteId: NOTE_ID,
        kind: 'autre',
        body: 'x',
      })
    )

    expect(result.status).toBe('error')
    expect(updateMemberNoteService).not.toHaveBeenCalled()
    expect(updateMemberExchangeService).not.toHaveBeenCalled()
  })
})

describe('deleteMemberNoteAction', () => {
  const deleteForm = (kind = 'note') =>
    formOf({memberProfileId: PROFILE_ID, noteId: NOTE_ID, kind})

  it('supprime l’entrée et revalide', async () => {
    const result = await deleteMemberNoteAction(undefined, deleteForm())

    expect(deleteMemberNoteService).toHaveBeenCalledWith({
      organizationId: TENANT_ID,
      memberProfileId: PROFILE_ID,
      noteId: NOTE_ID,
    })
    expect(result).toEqual({
      status: 'deleted',
      message: 'BureauMemberProfilesPage.detail.notes.saved.note.deleted',
    })
    expect(revalidatePath).toHaveBeenCalledWith(ROUTE, 'layout')
  })

  it('rend l’échec de suppression d’un échange, sans revalider', async () => {
    vi.mocked(deleteMemberNoteService).mockResolvedValue({status: 'not_found'})

    const result = await deleteMemberNoteAction(
      undefined,
      deleteForm('exchange')
    )

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.detail.notes.failed.delete.exchange',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('refuse sans session, sans appeler la façade', async () => {
    vi.mocked(requireActionAuth).mockRejectedValue(new AuthorizationError())

    const result = await deleteMemberNoteAction(undefined, deleteForm())

    expect(result).toEqual({
      status: 'error',
      message: 'BureauMemberProfilesPage.errors.forbidden',
    })
    expect(deleteMemberNoteService).not.toHaveBeenCalled()
  })
})
