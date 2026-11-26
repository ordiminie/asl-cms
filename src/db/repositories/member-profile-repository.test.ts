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
  listPennylaneLinkedProfilesDao,
  listProfilesWithoutPennylaneIdDao,
  setMemberProfileImportSnapshotDao,
  unlinkMemberProfileAccountDao,
  updateMemberProfilePennylaneIdDao,
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
    await updateMyMemberProfilesContactDao(ORG_ID, USER_ID, [PROFILE_ID], {
      phone: '06 12 34 56 78',
      homeAddressLine: null,
      homeAddressComplement: null,
      homePostalCode: null,
      homeCity: null,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member_profile" set "phone" = \$1/)
    expect(sql.split(' where ')[0]).not.toContain('"email"')
    expect(sql).toContain(
      '"member_profile"."id" in (select "member_profile_id" from "member_profile_account"'
    )
    expect(params).toEqual(expect.arrayContaining([ORG_ID, USER_ID]))
  })

  it('n’écrit que les fiches données, toujours bornées par le lien au compte (s57)', async () => {
    await updateMyMemberProfilesContactDao(ORG_ID, USER_ID, [PROFILE_ID], {
      phone: null,
      homeAddressLine: null,
      homeAddressComplement: null,
      homePostalCode: null,
      homeCity: null,
    })

    const [{sql, params}] = sent
    expect(sql).toContain('"member_profile"."id" in ($')
    expect(sql).toContain(
      '"member_profile"."id" in (select "member_profile_id" from "member_profile_account"'
    )
    expect(params).toEqual(expect.arrayContaining([PROFILE_ID, USER_ID]))
  })

  it('aucune fiche donnée : rien n’est écrit', async () => {
    expect(
      await updateMyMemberProfilesContactDao(ORG_ID, USER_ID, [], {
        phone: null,
        homeAddressLine: null,
        homeAddressComplement: null,
        homePostalCode: null,
        homeCity: null,
      })
    ).toEqual([])
    expect(sent).toHaveLength(0)
  })

  it('n’écrit que le domicile : jamais le terrain ni le nom de l’entreprise, propres à chaque fiche (s55)', async () => {
    await updateMyMemberProfilesContactDao(ORG_ID, USER_ID, [PROFILE_ID], {
      phone: null,
      homeAddressLine: '4 chemin des Oliviers',
      homeAddressComplement: null,
      homePostalCode: '13100',
      homeCity: 'Aix-en-Provence',
      ...({
        landAddressLine: '3 allée des Mimosas',
        companyName: 'Épicerie fictive',
      } as object),
    })

    const [{sql, params}] = sent
    const setClause = sql.split(' where ')[0]
    expect(setClause).toContain('"home_address_line"')
    expect(setClause).toContain('"home_postal_code"')
    expect(setClause).toContain('"home_city"')
    expect(setClause).not.toMatch(/"land_/)
    expect(setClause).not.toContain('"company_name"')
    expect(params).not.toContain('3 allée des Mimosas')
    expect(params).not.toContain('Épicerie fictive')
  })
})

describe('countMemberProfilesDao — fiches incomplètes (s55, sur le domicile)', () => {
  it('compte les fiches courrier sans domicile, terrain ignoré', async () => {
    responses.current = [[[3, 1]]]

    await countMemberProfilesDao(ORG_ID)

    const [{sql}] = sent
    expect(sql).toContain('"home_address_line" is null')
    expect(sql).toContain('"home_postal_code" is null')
    expect(sql).toContain('"home_city" is null')
    expect(sql).not.toMatch(/"land_/)
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

describe('getMemberProfilePageDao — filtre « Groupe » (s27)', () => {
  const GROUP_ID = '99999999-9999-4999-8999-999999999999'

  it('ne garde que les fiches du groupe, pour la page comme pour le total', async () => {
    responses.current = [[], [[0]]]

    await getMemberProfilePageDao({
      organizationId: ORG_ID,
      groupId: GROUP_ID,
      limit: 25,
      offset: 0,
    })

    const [page, total] = sent
    for (const {sql, params} of [page, total]) {
      expect(sql).toContain('from "recipient_group_member"')
      expect(sql).toContain('"recipient_group_member"."group_id" = $')
      expect(params).toContain(GROUP_ID)
    }
  })

  it('sans groupe, ne lit pas les appartenances', async () => {
    responses.current = [[], [[0]]]

    await getMemberProfilePageDao({
      organizationId: ORG_ID,
      limit: 25,
      offset: 0,
    })

    expect(sent[0].sql).not.toContain('recipient_group_member')
  })
})

describe('listPennylaneLinkedProfilesDao (s20, ADR 062 §2)', () => {
  it('lit les fiches de l’association qui portent un identifiant client Pennylane', async () => {
    await listPennylaneLinkedProfilesDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain(
      'select "id", "name", "pennylane_customer_id" from "member_profile"'
    )
    expect(sql).toContain('"member_profile"."organization_id" = $1')
    expect(sql).toContain(
      '"member_profile"."pennylane_customer_id" is not null'
    )
    expect(params).toEqual([ORG_ID])
  })
})

describe('updateMemberProfilePennylaneIdDao (s20, critère 4)', () => {
  it('écrit l’identifiant client de la fiche, lui seul, et compte les lignes', async () => {
    responses.current = [[[PROFILE_ID]]]

    expect(await updateMemberProfilePennylaneIdDao(PROFILE_ID, 'ref')).toBe(1)

    const [{sql, params}] = sent
    expect(sql).toContain(
      'update "member_profile" set "pennylane_customer_id" = $1'
    )
    expect(sql).toContain('"updated_at" = now()')
    expect(sql).toContain('where "member_profile"."id" = $2')
    expect(params).toEqual(['ref', PROFILE_ID])
  })

  it('retire l’identifiant quand il est nul', async () => {
    await updateMemberProfilePennylaneIdDao(PROFILE_ID, null)

    expect(sent[0].params).toEqual([null, PROFILE_ID])
  })
})

describe('listProfilesWithoutPennylaneIdDao (s20, critère 3)', () => {
  it('lit les fiches de l’association sans identifiant client, par nom', async () => {
    await listProfilesWithoutPennylaneIdDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('select "id", "name" from "member_profile"')
    expect(sql).toContain('"member_profile"."organization_id" = $1')
    expect(sql).toContain('"member_profile"."pennylane_customer_id" is null')
    expect(sql).toContain('order by "member_profile"."name" asc')
    expect(params).toEqual([ORG_ID])
  })
})

describe('setMemberProfileImportSnapshotDao (s56, ADR 077)', () => {
  it('écrit l’instantané et sa date, sans toucher updated_at', async () => {
    const at = new Date('2026-11-26T09:00:00Z')
    const snapshot = {
      home: {
        line: '1 allée des Essais',
        postalCode: '99100',
        city: 'Fictiville',
      },
      land: null,
      phone: null,
      emails: ['lucie@exemple.test'],
    }

    await setMemberProfileImportSnapshotDao(PROFILE_ID, {
      snapshot,
      importedAt: at,
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(
      /^update "member_profile" set "pennylane_import_snapshot" = \$1, "pennylane_imported_at" = \$2 where "member_profile"."id" = \$3/
    )
    expect(sql).not.toContain('updated_at')
    expect(params).toEqual([
      JSON.stringify(snapshot),
      at.toISOString(),
      PROFILE_ID,
    ])
  })
})
