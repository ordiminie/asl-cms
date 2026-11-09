import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {MEMBER_NOTE_BODY_MAX} from '../types/domain/member-note-types'
import {
  addMemberExchangeServiceSchema,
  addMemberNoteServiceSchema,
  deleteMemberNoteServiceSchema,
  memberNotesPageServiceSchema,
  updateMemberExchangeServiceSchema,
  updateMemberNoteServiceSchema,
} from './member-note-validation'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const NOTE_ID = '44444444-4444-4444-8444-444444444444'

const note = (input: Record<string, unknown>) =>
  addMemberNoteServiceSchema.safeParse({
    organizationId: ORG_ID,
    memberProfileId: PROFILE_ID,
    ...input,
  })

const exchange = (input: Record<string, unknown>) =>
  addMemberExchangeServiceSchema.safeParse({
    organizationId: ORG_ID,
    memberProfileId: PROFILE_ID,
    body: 'Appelé au sujet du portail.',
    channel: 'phone',
    entryDate: '2026-11-09',
    ...input,
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('addMemberNoteServiceSchema — une note (s24)', () => {
  it('accepte une note sans canal ni date', () => {
    const result = note({body: 'Souhaite être prévenu des travaux.'})

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      body: 'Souhaite être prévenu des travaux.',
    })
  })

  it('retire ce qui serait glissé dans l’entrée (auteur, type, canal)', () => {
    const result = note({
      body: 'Texte',
      authorUserId: '55555555-5555-4555-8555-555555555555',
      kind: 'exchange',
      channel: 'phone',
    })

    expect(result.data).toEqual({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      body: 'Texte',
    })
  })

  it.each([[''], ['   '], ['\n\n']])(
    'refuse un texte vide (« %s »)',
    (body) => {
      expect(note({body}).success).toBe(false)
    }
  )

  it('accepte le plafond exact et refuse un caractère de plus', () => {
    expect(note({body: 'a'.repeat(MEMBER_NOTE_BODY_MAX)}).success).toBe(true)
    expect(note({body: 'a'.repeat(MEMBER_NOTE_BODY_MAX + 1)}).success).toBe(
      false
    )
  })

  it('refuse une fiche ou une association qui ne sont pas des uuid', () => {
    expect(note({body: 'Texte', memberProfileId: 'abc'}).success).toBe(false)
    expect(note({body: 'Texte', organizationId: 'abc'}).success).toBe(false)
  })
})

describe('addMemberExchangeServiceSchema — un échange (s24)', () => {
  it('accepte un échange d’aujourd’hui ou d’un jour passé', () => {
    expect(exchange({}).success).toBe(true)
    expect(
      exchange({entryDate: '2026-03-12', channel: 'in_person'}).success
    ).toBe(true)
  })

  it('refuse un échange sans canal', () => {
    expect(exchange({channel: undefined}).success).toBe(false)
  })

  it('refuse un canal hors de la liste', () => {
    expect(exchange({channel: 'sms'}).success).toBe(false)
  })

  it('refuse un jour futur (jour de Paris)', () => {
    expect(exchange({entryDate: '2026-11-10'}).success).toBe(false)
  })

  it('refuse un jour qui n’existe pas ou mal formé', () => {
    expect(exchange({entryDate: '2026-02-30'}).success).toBe(false)
    expect(exchange({entryDate: '09/11/2026'}).success).toBe(false)
  })

  it('refuse un résumé vide ou trop long', () => {
    expect(exchange({body: '  '}).success).toBe(false)
    expect(exchange({body: 'a'.repeat(MEMBER_NOTE_BODY_MAX + 1)}).success).toBe(
      false
    )
  })
})

describe('schémas de modification, de suppression et de lecture', () => {
  it('exige l’identifiant de l’entrée modifiée', () => {
    expect(
      updateMemberNoteServiceSchema.safeParse({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        body: 'Texte',
      }).success
    ).toBe(false)
    expect(
      updateMemberNoteServiceSchema.safeParse({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        noteId: NOTE_ID,
        body: 'Texte',
      }).success
    ).toBe(true)
  })

  it('revérifie canal et jour à la modification d’un échange', () => {
    const base = {
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      noteId: NOTE_ID,
      body: 'Texte',
      channel: 'mail',
      entryDate: '2026-11-09',
    }

    expect(updateMemberExchangeServiceSchema.safeParse(base).success).toBe(true)
    expect(
      updateMemberExchangeServiceSchema.safeParse({
        ...base,
        entryDate: '2027-01-01',
      }).success
    ).toBe(false)
  })

  it('valide la suppression et la lecture d’une page', () => {
    expect(
      deleteMemberNoteServiceSchema.safeParse({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        noteId: 'abc',
      }).success
    ).toBe(false)
    expect(
      memberNotesPageServiceSchema.safeParse({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        page: 0,
      }).success
    ).toBe(false)
    expect(
      memberNotesPageServiceSchema.safeParse({
        organizationId: ORG_ID,
        memberProfileId: PROFILE_ID,
        page: 2,
      }).success
    ).toBe(true)
  })
})
