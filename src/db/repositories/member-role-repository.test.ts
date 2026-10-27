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
  getOrganizationOwnerDao,
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

describe('getOrganizationOwnerDao', () => {
  it('rend le compte Président(e) de l’association, hors SuperAdmin', async () => {
    nextRows.current = [[USER_ID, 'Hélène Roux']]

    const owner = await getOrganizationOwnerDao(ORG_ID)

    expect(owner).toEqual({userId: USER_ID, name: 'Hélène Roux'})
    const [{sql, params}] = sent
    expect(sql).toContain('"member"."organization_id" = $1')
    expect(sql).toContain('"member"."role" = $2')
    expect(sql).toContain('"user"."role" <> $3')
    expect(params).toEqual([ORG_ID, 'owner', 'super_admin', 1])
  })

  it('rend undefined quand l’association n’a pas de Président(e)', async () => {
    expect(await getOrganizationOwnerDao(ORG_ID)).toBeUndefined()
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
