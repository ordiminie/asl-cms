import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Groupes de destinataires (s27, ADR 060 §4), sur le patron de
 * `member-profile-repository.test.ts` : un client `pg-proxy` rend chaque
 * requete telle qu'elle partirait vers Postgres. La RLS se prouve en e2e.
 */
const {sent, responses} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  responses: {current: [] as unknown[][]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: responses.current.shift() ?? []}
    }),
}))

import {
  addRecipientGroupMembersTxnDao,
  getReadableMemberProfileIdsDao,
  listRecipientGroupsDao,
  removeRecipientGroupMembersTxnDao,
} from './recipient-group-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const GROUP_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = '44444444-4444-4444-8444-444444444444'
const PROFILE_B = '55555555-5555-4555-8555-555555555555'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('recipient-group-repository (s27)', () => {
  it('liste les groupes de l’association avec leur nombre de fiches, par nom', async () => {
    await listRecipientGroupsDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "recipient_group"')
    expect(sql).toContain('count(*)')
    expect(sql).toContain('order by lower("recipient_group"."name")')
    expect(params).toContain(ORG_ID)
  })

  it('l’ajout est idempotent : une fiche déjà dans le groupe n’est pas doublée', async () => {
    responses.current = [[[PROFILE_A]]]

    const added = await addRecipientGroupMembersTxnDao(ORG_ID, GROUP_ID, [
      PROFILE_A,
      PROFILE_B,
    ])

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "recipient_group_member"/)
    expect(sql).toContain('on conflict do nothing')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, GROUP_ID, PROFILE_A, PROFILE_B])
    )
    expect(added).toBe(1)
  })

  it('le retrait ne touche que ce groupe', async () => {
    await removeRecipientGroupMembersTxnDao(GROUP_ID, [PROFILE_A])

    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "recipient_group_member"/)
    expect(sql).toContain('"recipient_group_member"."group_id" = $1')
    expect(params).toEqual([GROUP_ID, PROFILE_A])
  })

  it('n’écrit ni ne lit rien pour une sélection vide', async () => {
    expect(await addRecipientGroupMembersTxnDao(ORG_ID, GROUP_ID, [])).toBe(0)
    expect(await getReadableMemberProfileIdsDao([])).toEqual([])
    expect(sent).toEqual([])
  })
})
