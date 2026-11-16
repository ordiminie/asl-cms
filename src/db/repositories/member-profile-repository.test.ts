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
  countMemberProfilesDao,
  getCurrentParcelNumbersByProfileDao,
  getLinkedAccountsDao,
  getMemberProfileByIdDao,
  getMemberProfilePageDao,
  getMemberProfilesByEmailDao,
  getMemberProfilesByUserIdDao,
  getUnlinkedMemberProfilesWithEmailDao,
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
  it('relie la fiche au compte, sans toucher les autres comptes de la fiche (s54, ADR 056 §3)', async () => {
    await linkMemberProfileAccountDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      userId: USER_ID,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "member_profile_account"/)
    expect(sql).toContain(
      'on conflict ("member_profile_id","user_id") do nothing'
    )
    expect(sql).not.toContain('do update')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_ID, USER_ID])
    )
  })
})

describe('unlinkMemberProfileAccountDao', () => {
  it('ne retire que le lien de ce compte à cette fiche (s54, critère 10)', async () => {
    await unlinkMemberProfileAccountDao(PROFILE_ID, USER_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member_profile_account"/)
    expect(sql).toContain('"member_profile_account"."member_profile_id" = $1')
    expect(sql).toContain('"member_profile_account"."user_id" = $2')
    expect(params).toEqual([PROFILE_ID, USER_ID])
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

describe('lecteurs des adresses (s54, ADR 056)', () => {
  it('lit une fiche avec sa titulaire active et « courrier uniquement » calculé, sans jointure de compte', async () => {
    await getMemberProfileByIdDao(PROFILE_ID)

    const [{sql}] = sent
    expect(sql).toContain('from "member_profile"')
    expect(sql).toContain(
      'mpe_holder."member_profile_id" = "member_profile"."id"'
    )
    expect(sql).toContain(
      'mpe_active."member_profile_id" = "member_profile"."id" and mpe_active."status" = \'active\''
    )
    expect(sql).not.toContain('join "member_profile_account"')
  })

  it('lit les comptes reliés à une fiche, un par adresse', async () => {
    await getLinkedAccountsDao(PROFILE_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_account"')
    expect(sql).toContain('inner join "user"')
    expect(sql).toContain('"member_profile_account"."member_profile_id" = $1')
    expect(params).toEqual([PROFILE_ID])
  })

  it('lit les fiches qui portent une adresse active, sans casse, par la table des adresses', async () => {
    await getMemberProfilesByEmailDao(ORG_ID, 'Claire@Exemple.fr')

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_email"')
    expect(sql).toContain('inner join "member_profile"')
    expect(sql).toContain('lower("member_profile_email"."email") = lower($')
    expect(sql).toContain('"member_profile_email"."status" = $')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'Claire@Exemple.fr', 'active'])
    )
  })

  it('compte une page sans qu’un second compte ne multiplie la fiche', async () => {
    responses.current = [[], [[0]]]

    await getMemberProfilePageDao({
      organizationId: ORG_ID,
      limit: 25,
      offset: 0,
    })

    const [{sql}] = sent
    expect(sql.split(' from "member_profile" ')[1]).not.toContain(
      'join "member_profile_account"'
    )
    expect(sql).toContain('not exists (select 1 from "member_profile_email"')
    expect(sql).toContain(
      'mpe_other."member_profile_id" = "member_profile"."id" and mpe_other."status" = \'active\' and mpe_other."role" = \'additional\''
    )
  })

  it('compte les fiches incomplètes sur l’absence d’adresse active', async () => {
    responses.current = [[[3, 1]]]

    await countMemberProfilesDao(ORG_ID)

    const [{sql}] = sent
    expect(sql).toContain('not exists (select 1 from "member_profile_email"')
    expect(sql).not.toContain('mail_only')
  })

  it('lit les adresses actives qui n’ont pas encore leur compte relié à la fiche', async () => {
    await getUnlinkedMemberProfilesWithEmailDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_email"')
    expect(sql).toContain('"member_profile_email"."status" = $')
    expect(sql).toContain('not exists (select 1 from "member_profile_account"')
    expect(sql).toContain(
      'lower(u_unlinked."email") = lower("member_profile_email"."email")'
    )
    expect(params).toEqual(expect.arrayContaining([ORG_ID, 'active']))
  })
})

describe('getCurrentParcelNumbersByProfileDao', () => {
  it('lit les parcelles actuelles de chaque fiche, période ouverte', async () => {
    responses.current = [[[PROFILE_ID, '21']]]

    expect(await getCurrentParcelNumbersByProfileDao([PROFILE_ID])).toEqual({
      [PROFILE_ID]: ['21'],
    })
    const [{sql}] = sent
    expect(sql).toContain('"parcel_ownership"."ends_on" is null')
  })
})
