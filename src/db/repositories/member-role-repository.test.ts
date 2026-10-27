import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO du changement de role (s14, ADR 039). La base n'est pas joignable en
 * unitaire (`db.ts` refuse toute connexion) : les repositories ecrivent ici
 * dans un client Drizzle `pg-proxy` qui rend au test chaque requete telle
 * qu'elle partirait vers Postgres. Le verrou et la RLS se prouvent en e2e.
 */
const {sent, nextRows} = vi.hoisted(() => ({
  sent: [] as {sql: string; params: unknown[]}[],
  nextRows: {current: [] as unknown[]},
}))

vi.mock('@/db/tenant-scope', () => ({
  getDb: () =>
    drizzle(async (sql, params) => {
      sent.push({sql, params})
      return {rows: nextRows.current}
    }),
}))

import {insertMemberRoleEventDao} from './member-role-event-repository'
import {
  countCapableMembersDao,
  deleteMemberWithRoleDao,
  getOrganizationOwnersDao,
  lockOrganizationRolesDao,
  updateMemberRoleFromDao,
} from './organization-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  sent.length = 0
  nextRows.current = []
})

describe('lockOrganizationRolesDao', () => {
  it('prend un verrou consultatif transactionnel propre à l’association', async () => {
    await lockOrganizationRolesDao(ORG_ID)

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toBe('select pg_advisory_xact_lock(hashtextextended($1, 0))')
    expect(params).toEqual([`member-roles:${ORG_ID}`])
  })
})

describe('countCapableMembersDao', () => {
  it('compte les lignes owner et board de l’association, comptes SuperAdmin exclus', async () => {
    nextRows.current = [[3]]

    const total = await countCapableMembersDao(ORG_ID)

    expect(total).toBe(3)
    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^select count\(\*\) from "member"/)
    expect(sql).toContain(
      'inner join "user" on "user"."id" = "member"."user_id"'
    )
    expect(sql).toContain('"member"."organization_id" = $1')
    expect(sql).toContain('"member"."role" in ($2, $3)')
    expect(sql).toContain('"user"."role" <> $4')
    expect(params).toEqual([ORG_ID, 'owner', 'board', 'super_admin'])
  })
})

describe('getOrganizationOwnersDao', () => {
  it('rend toutes les lignes Président(e) de l’association, hors SuperAdmin, sans limite (revue 1)', async () => {
    const OTHER_ID = '99999999-9999-4999-8999-999999999999'
    nextRows.current = [
      [USER_ID, 'Hélène Roux'],
      [OTHER_ID, 'Marc Lenoir'],
    ]

    const owners = await getOrganizationOwnersDao(ORG_ID)

    expect(owners).toEqual([
      {userId: USER_ID, name: 'Hélène Roux'},
      {userId: OTHER_ID, name: 'Marc Lenoir'},
    ])
    const [{sql, params}] = sent
    expect(sql).toContain('"member"."organization_id" = $1')
    expect(sql).toContain('"member"."role" = $2')
    expect(sql).toContain('"user"."role" <> $3')
    expect(sql).not.toContain('limit')
    expect(params).toEqual([ORG_ID, 'owner', 'super_admin'])
  })

  it('rend une liste vide quand l’association n’a pas de Président(e)', async () => {
    expect(await getOrganizationOwnersDao(ORG_ID)).toEqual([])
  })
})

describe('updateMemberRoleFromDao', () => {
  it('ne change le rôle que s’il vaut encore `from`, et rend le nombre de lignes touchées', async () => {
    nextRows.current = [['row-id']]

    const touched = await updateMemberRoleFromDao(
      USER_ID,
      ORG_ID,
      'member',
      'board'
    )

    expect(touched).toBe(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member" set "role" = \$1/)
    expect(sql).toContain('"member"."user_id" = $2')
    expect(sql).toContain('"member"."organization_id" = $3')
    expect(sql).toContain('"member"."role" = $4')
    expect(sql).toMatch(/returning "id"$/)
    expect(params).toEqual(['board', USER_ID, ORG_ID, 'member'])
  })

  it('rend zéro quand le rôle a changé entre-temps', async () => {
    expect(
      await updateMemberRoleFromDao(USER_ID, ORG_ID, 'member', 'board')
    ).toBe(0)
  })
})

describe('insertMemberRoleEventDao', () => {
  it('écrit une ligne de trace avec son organization_id', async () => {
    await insertMemberRoleEventDao({
      organizationId: ORG_ID,
      memberProfileId: null,
      targetUserId: USER_ID,
      targetName: 'Paul Vidal',
      authorUserId: null,
      authorName: 'Zourite Studio',
      fromRole: 'member',
      toRole: 'board',
      reason: 'assignment',
    })

    expect(sent).toHaveLength(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "member_role_event"/)
    expect(params).toEqual(
      expect.arrayContaining([
        ORG_ID,
        USER_ID,
        'Paul Vidal',
        'Zourite Studio',
        'member',
        'board',
        'assignment',
      ])
    )
  })
})

describe('deleteMemberWithRoleDao', () => {
  it('ne retire la ligne que si son rôle vaut celui attendu, et rend le nombre de lignes retirées', async () => {
    nextRows.current = [['row-id']]

    const removed = await deleteMemberWithRoleDao(USER_ID, ORG_ID, 'board')

    expect(removed).toBe(1)
    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member"/)
    expect(sql).toContain('"member"."role" = $3')
    expect(sql).toMatch(/returning "id"$/)
    expect(params).toEqual([USER_ID, ORG_ID, 'board'])
  })

  it('rend zéro quand le rôle a changé entre-temps', async () => {
    expect(await deleteMemberWithRoleDao(USER_ID, ORG_ID, 'board')).toBe(0)
  })
})
