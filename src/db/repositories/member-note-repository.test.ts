import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des notes internes d'un membre (s24, ADR 050). La base n'est pas
 * joignable en unitaire : un client Drizzle `pg-proxy` rend au test chaque
 * requete telle qu'elle partirait vers Postgres. La RLS se prouve en e2e.
 */
const {sent, nextRows, countRows} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  nextRows: {current: [] as unknown[]},
  countRows: {current: [[0]] as unknown[]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {
        rows: sql.startsWith('select count')
          ? countRows.current
          : nextRows.current,
      }
    }),
}))

import {
  createMemberNoteTxnDao,
  deleteMemberNoteTxnDao,
  getMemberNotesPageDao,
  updateMemberNoteTxnDao,
} from './member-note-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const NOTE_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  sent.length = 0
  nextRows.current = []
  countRows.current = [[0]]
})

describe('getMemberNotesPageDao', () => {
  it('lit le fil de la seule fiche, dans l’ordre de l’ADR, page demandée', async () => {
    await getMemberNotesPageDao(PROFILE_ID, {limit: 10, offset: 20})

    const select = sent.find(
      ({sql}) =>
        sql.includes(`from "member_note" where`) &&
        !sql.startsWith(`select count`)
    )
    expect(select?.sql).toContain('from "member_note"')
    expect(select?.sql).toContain('"member_note"."member_profile_id" = $1')
    expect(select?.sql).toContain(
      'order by "member_note"."entry_date" desc, "member_note"."created_at" desc, "member_note"."id" desc'
    )
    expect(select?.sql).toContain('limit $2 offset $3')
    expect(select?.params).toEqual([PROFILE_ID, 10, 20])
  })

  it('compte les entrées de la fiche', async () => {
    countRows.current = [[12]]

    const {total} = await getMemberNotesPageDao(PROFILE_ID, {
      limit: 10,
      offset: 0,
    })

    const countQuery = sent.find(({sql}) => sql.startsWith('select count'))
    expect(countQuery?.sql).toContain('"member_note"."member_profile_id" = $1')
    expect(countQuery?.params).toEqual([PROFILE_ID])
    expect(total).toBe(12)
  })

  it('ne lit ni le compte auteur ni l’imitation', async () => {
    await getMemberNotesPageDao(PROFILE_ID, {limit: 10, offset: 0})

    const select = sent.find(
      ({sql}) =>
        sql.includes(`from "member_note" where`) &&
        !sql.startsWith(`select count`)
    )
    expect(select?.sql).not.toContain('"author_user_id"')
    expect(select?.sql).not.toContain('"on_behalf_of_')
  })
})

describe('createMemberNoteTxnDao', () => {
  it('insère l’entrée avec l’auteur copié', async () => {
    await createMemberNoteTxnDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      kind: 'note',
      channel: null,
      entryDate: '2026-11-09',
      body: 'Texte',
      authorUserId: 'u1',
      authorName: 'Marie Delorme',
      onBehalfOfUserId: null,
      onBehalfOfName: null,
    })

    expect(sent).toHaveLength(1)
    expect(sent[0].sql).toMatch(/^insert into "member_note"/)
    expect(sent[0].sql).toContain('returning')
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_ID, 'note', 'Marie Delorme'])
    )
  })
})

describe('updateMemberNoteTxnDao', () => {
  it('cible l’entrée par id, fiche et type, et pose updated_at', async () => {
    await updateMemberNoteTxnDao(NOTE_ID, PROFILE_ID, 'exchange', {
      body: 'Nouveau texte',
      channel: 'mail',
      entryDate: '2026-11-01',
    })

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member_note" set/)
    expect(sql).toContain('"updated_at" = now()')
    expect(sql).toContain('"member_note"."id" = $')
    expect(sql).toContain('"member_note"."member_profile_id" = $')
    expect(sql).toContain('"member_note"."kind" = $')
    expect(params).toEqual(
      expect.arrayContaining([NOTE_ID, PROFILE_ID, 'exchange'])
    )
  })

  it('ne touche ni à l’auteur, ni au type, ni à la date de saisie', async () => {
    await updateMemberNoteTxnDao(NOTE_ID, PROFILE_ID, 'note', {
      body: 'Nouveau texte',
    })

    const setClause = sent[0].sql.split(' where ')[0]
    expect(setClause).not.toContain('"author_')
    expect(setClause).not.toContain('"on_behalf_of_')
    expect(setClause).not.toContain('"kind"')
    expect(setClause).not.toContain('"created_at"')
    expect(setClause).not.toContain('"organization_id"')
  })

  it('rend undefined quand aucune ligne ne répond', async () => {
    nextRows.current = []

    await expect(
      updateMemberNoteTxnDao(NOTE_ID, PROFILE_ID, 'note', {body: 'x'})
    ).resolves.toBeUndefined()
  })
})

describe('deleteMemberNoteTxnDao', () => {
  it('supprime l’entrée de la seule fiche, et rend undefined si absente', async () => {
    const deleted = await deleteMemberNoteTxnDao(NOTE_ID, PROFILE_ID)

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member_note"/)
    expect(sql).toContain('"member_note"."id" = $1')
    expect(sql).toContain('"member_note"."member_profile_id" = $2')
    expect(params).toEqual([NOTE_ID, PROFILE_ID])
    expect(deleted).toBeUndefined()
  })
})
