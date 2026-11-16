import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Lien fiche ↔ compte (s53, ADR 054), sur le patron de
 * `member-note-repository.test.ts` : un client `pg-proxy` rend chaque requete
 * telle qu'elle partirait vers Postgres. La RLS se prouve en e2e.
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
  countLinkedProfilesDao,
  getMemberProfilesByUserIdDao,
  linkMemberProfileAccountDao,
  unlinkMemberProfileAccountDao,
  updateMyMemberProfilesContactDao,
} from './member-profile-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const USER_ID = '55555555-5555-4555-8555-555555555555'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('linkMemberProfileAccountDao', () => {
  it('relie la fiche au compte ; un nouveau lien remplace l’ancien (une fiche, un compte)', async () => {
    await linkMemberProfileAccountDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: USER_ID,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "member_profile_account"/)
    expect(sql).toContain('on conflict ("member_profile_id") do update set')
    expect(sql).toContain('"user_id" = $')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_ID, USER_ID])
    )
  })
})

describe('unlinkMemberProfileAccountDao', () => {
  it('ne retire que le lien de cette fiche', async () => {
    await unlinkMemberProfileAccountDao(PROFILE_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member_profile_account"/)
    expect(sql).toContain('"member_profile_account"."member_profile_id" = $1')
    expect(params).toEqual([PROFILE_ID])
  })
})

describe('countLinkedProfilesDao', () => {
  it('compte les fiches de l’association reliées au compte', async () => {
    responses.current = [[[2]]]

    expect(await countLinkedProfilesDao(ORG_ID, USER_ID)).toBe(2)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_account"')
    expect(sql).toContain('"member_profile_account"."organization_id" = $1')
    expect(sql).toContain('"member_profile_account"."user_id" = $2')
    expect(params).toEqual([ORG_ID, USER_ID])
  })
})

describe('getMemberProfilesByUserIdDao — « mes fiches »', () => {
  it('lit les fiches de l’association reliées au compte, par la table de liaison', async () => {
    await getMemberProfilesByUserIdDao(ORG_ID, USER_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile"')
    expect(sql).toContain('"member_profile"."organization_id" = $1')
    expect(sql).toContain(
      '"member_profile"."id" in (select "member_profile_id" from "member_profile_account"'
    )
    expect(sql).toContain('"member_profile_account"."user_id" = $3')
    expect(params).toEqual([ORG_ID, ORG_ID, USER_ID])
  })
})

describe('updateMyMemberProfilesContactDao', () => {
  it('écrit téléphone et adresse de toutes les fiches du compte, jamais l’email', async () => {
    await updateMyMemberProfilesContactDao(ORG_ID, USER_ID, {
      phone: '06 12 34 56 78',
      addressLine: null,
      addressComplement: null,
      postalCode: null,
      city: null,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member_profile" set "phone" = \$1/)
    expect(sql.split(' where ')[0]).not.toContain('"email"')
    expect(sql).toContain(
      '"member_profile"."id" in (select "member_profile_id" from "member_profile_account"'
    )
    expect(params).toEqual(expect.arrayContaining([ORG_ID, USER_ID]))
  })
})
