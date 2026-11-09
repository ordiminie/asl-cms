import {describe, expect, it} from 'vitest'

import {toMemberNoteDto} from './member-note-rules'

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  organizationId: '11111111-1111-4111-8111-111111111111',
  memberProfileId: '33333333-3333-4333-8333-333333333333',
  kind: 'exchange' as const,
  channel: 'phone' as const,
  entryDate: '2026-03-12',
  body: 'Appelé au sujet du portail.',
  authorUserId: '55555555-5555-4555-8555-555555555555',
  authorName: 'Marie Delorme',
  onBehalfOfUserId: '66666666-6666-4666-8666-666666666666',
  onBehalfOfName: 'Jean-Paul Rivière',
  createdAt: new Date('2026-03-13T09:15:00.000Z'),
  updatedAt: null,
}

describe('toMemberNoteDto — liste blanche (ADR 050)', () => {
  it('rend les champs du fil, et eux seuls', () => {
    expect(toMemberNoteDto(row)).toEqual({
      id: row.id,
      kind: 'exchange',
      channel: 'phone',
      entryDate: '2026-03-12',
      body: 'Appelé au sujet du portail.',
      authorName: 'Marie Delorme',
      createdAt: '2026-03-13T09:15:00.000Z',
      updatedAt: null,
    })
  })

  it('ne laisse sortir ni le compte auteur, ni l’association, ni l’imitation', () => {
    const dto = toMemberNoteDto(row) as Record<string, unknown>

    for (const internal of [
      'authorUserId',
      'organizationId',
      'memberProfileId',
      'onBehalfOfUserId',
      'onBehalfOfName',
    ]) {
      expect(dto).not.toHaveProperty(internal)
    }
  })

  it('rend la date de modification en ISO quand l’entrée a été modifiée', () => {
    const dto = toMemberNoteDto({
      ...row,
      updatedAt: new Date('2026-11-04T13:32:00.000Z'),
    })

    expect(dto.updatedAt).toBe('2026-11-04T13:32:00.000Z')
  })
})
