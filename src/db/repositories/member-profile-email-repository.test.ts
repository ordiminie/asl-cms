import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * Adresses d'une fiche (s54, ADR 056), sur le patron de
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
  deleteMemberProfileEmailDao,
  deletePendingEmailsAddedByDao,
  getActiveEmailCarriersDao,
  getInvitationAddressesDao,
  getMemberProfileEmailsByTokenHashDao,
  getMemberProfileEmailsDao,
  insertMemberProfileEmailDao,
  purgeExpiredPendingEmailsDao,
  setMemberProfileEmailRoleDao,
  updateMemberProfileEmailDao,
} from './member-profile-email-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '33333333-3333-4333-8333-333333333333'
const EMAIL_ID = '44444444-4444-4444-8444-444444444444'
const NOW = new Date('2026-11-16T10:00:00Z')

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('getMemberProfileEmailsDao', () => {
  it('lit les adresses des fiches avec le nom de leur auteur, titulaire d’abord', async () => {
    await getMemberProfileEmailsDao([PROFILE_ID])

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile_email"')
    expect(sql).toContain('left join "user"')
    expect(sql).toContain('"member_profile_email"."added_by_user_id"')
    expect(sql).toContain('"member_profile_email"."member_profile_id" in ($1)')
    expect(sql).toMatch(/order by .*"role"/)
    expect(params).toEqual([PROFILE_ID])
  })

  it('ne lance aucune requête sans fiche', async () => {
    expect(await getMemberProfileEmailsDao([])).toEqual([])
    expect(sent).toEqual([])
  })
})

describe('getActiveEmailCarriersDao', () => {
  it('lit les adresses actives de l’association égales sans casse', async () => {
    await getActiveEmailCarriersDao(ORG_ID, 'Claire@Exemple.fr')

    const [{sql, params}] = sent
    expect(sql).toContain('"member_profile_email"."organization_id" = $1')
    expect(sql).toContain('lower("member_profile_email"."email") = lower($2)')
    expect(sql).toContain('"member_profile_email"."status" = $3')
    expect(params).toEqual([ORG_ID, 'Claire@Exemple.fr', 'active'])
  })
})

describe('écritures', () => {
  it('insère une adresse et la rend', async () => {
    await insertMemberProfileEmailDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_ID,
      email: 'claire@exemple.fr',
      role: 'additional',
      status: 'active',
      origin: 'site',
    })

    const [{sql, params}] = sent
    expect(sql).toMatch(/^insert into "member_profile_email"/)
    expect(sql).toContain('returning')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_ID, 'claire@exemple.fr'])
    )
  })

  it('modifie une adresse et horodate la modification', async () => {
    await updateMemberProfileEmailDao(EMAIL_ID, {email: 'neuve@exemple.fr'})

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member_profile_email" set "email" = \$1/)
    expect(sql).toContain('"updated_at" = now()')
    expect(sql).toContain('"member_profile_email"."id" = $2')
    expect(params).toEqual(['neuve@exemple.fr', EMAIL_ID])
  })

  it('change le rôle d’une adresse (désignation)', async () => {
    await setMemberProfileEmailRoleDao(EMAIL_ID, 'holder')

    const [{sql, params}] = sent
    expect(sql).toMatch(/^update "member_profile_email" set "role" = \$1/)
    expect(params).toEqual(['holder', EMAIL_ID])
  })

  it('retire une adresse par son identifiant', async () => {
    await deleteMemberProfileEmailDao(EMAIL_ID)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member_profile_email"/)
    expect(params).toEqual([EMAIL_ID])
  })

  it('purge les attentes échues de l’association, jamais une adresse active', async () => {
    await purgeExpiredPendingEmailsDao(ORG_ID, NOW)

    const [{sql, params}] = sent
    expect(sql).toMatch(/^delete from "member_profile_email"/)
    expect(sql).toContain('"member_profile_email"."organization_id" = $1')
    expect(sql).toContain('"member_profile_email"."status" = $2')
    expect(sql).toContain('"member_profile_email"."expires_at" <= $3')
    expect(params).toEqual([ORG_ID, 'pending', NOW.toISOString()])
  })
})

describe('getMemberProfileEmailsByTokenHashDao', () => {
  it('lit les adresses en attente d’un même lien par le hash de son jeton, jamais par le jeton', async () => {
    await getMemberProfileEmailsByTokenHashDao('hash-sha256')

    const [{sql, params}] = sent
    expect(sql).toContain(
      '"member_profile_email"."confirmation_token_hash" = $1'
    )
    expect(params).toEqual(['hash-sha256'])
  })
})

describe('deletePendingEmailsAddedByDao (revue s54, C1)', () => {
  it('supprime les seules attentes ajoutées par ce compte sur cette fiche', async () => {
    const USER_ID = '55555555-5555-4555-8555-555555555555'
    await deletePendingEmailsAddedByDao(PROFILE_ID, USER_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('delete from "member_profile_email"')
    expect(sql).toContain('"member_profile_email"."member_profile_id" = $1')
    expect(sql).toContain('"member_profile_email"."added_by_user_id" = $2')
    expect(sql).toContain('"member_profile_email"."status" = $3')
    expect(params).toEqual([PROFILE_ID, USER_ID, 'pending'])
  })
})

describe('getInvitationAddressesDao (s42b, suivi des invitations)', () => {
  const OTHER_PROFILE = '55555555-5555-4555-8555-555555555555'
  const CREATED = new Date('2026-11-20T08:00:00Z')

  it('lit toutes les adresses de l’association, actives et en attente, avec leur fiche et ses parcelles actuelles', async () => {
    responses.current = [
      [
        [
          'anne@example.fr',
          'active',
          CREATED.toISOString(),
          null,
          PROFILE_ID,
          'Anne Aubry',
        ],
        [
          'paul@example.fr',
          'pending',
          CREATED.toISOString(),
          NOW.toISOString(),
          OTHER_PROFILE,
          'Paul Renaud',
        ],
      ],
      [
        [PROFILE_ID, '12'],
        [PROFILE_ID, '14'],
      ],
    ]

    const rows = await getInvitationAddressesDao(ORG_ID)

    expect(sent[0].sql).toMatch(/from "member_profile_email"/)
    expect(sent[0].sql).toMatch(/inner join "member_profile"/)
    expect(sent[0].sql).not.toMatch(/"status" = /)
    expect(sent[0].params).toEqual([ORG_ID])
    expect(sent[1].sql).toMatch(/from "parcel_ownership"/)
    expect(rows).toEqual([
      {
        email: 'anne@example.fr',
        status: 'active',
        createdAt: CREATED,
        expiresAt: null,
        memberProfileId: PROFILE_ID,
        name: 'Anne Aubry',
        parcelNumbers: ['12', '14'],
      },
      {
        email: 'paul@example.fr',
        status: 'pending',
        createdAt: CREATED,
        expiresAt: NOW,
        memberProfileId: OTHER_PROFILE,
        name: 'Paul Renaud',
        parcelNumbers: [],
      },
    ])
  })
})
