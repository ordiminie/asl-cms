import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des traces d'invitation et de premiere connexion (s42a). La base n'est
 * pas joignable en unitaire : un client Drizzle `pg-proxy` rend au test chaque
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
  getInvitationStatesByEmailsDao,
  getInvitationStatesByUserIdsDao,
  markFirstSignInTxnDao,
  markInvitedTxnDao,
} from './member-invitation-state-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const USER_A = '22222222-2222-4222-8222-222222222222'
const USER_B = '33333333-3333-4333-8333-333333333333'
const AT = new Date('2026-11-24T09:15:00.000Z')

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('markInvitedTxnDao', () => {
  it('écrit la date du dernier envoi, en remplaçant la précédente', async () => {
    await markInvitedTxnDao({organizationId: ORG_ID, userId: USER_A, at: AT})

    expect(sent[0].sql).toMatch(/^insert into "member_invitation_state"/)
    expect(sent[0].sql).toMatch(
      /on conflict \("organization_id","user_id"\) do update set "last_invited_at" = excluded\."last_invited_at"/
    )
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, USER_A, AT.toISOString()])
    )
  })
})

describe('markFirstSignInTxnDao', () => {
  it('n’écrit la première connexion que si elle est encore nulle', async () => {
    await markFirstSignInTxnDao({
      organizationId: ORG_ID,
      userId: USER_A,
      at: AT,
    })

    expect(sent[0].sql).toMatch(/^insert into "member_invitation_state"/)
    expect(sent[0].sql).toMatch(
      /do update set "first_signed_in_at" = coalesce\("member_invitation_state"\."first_signed_in_at", excluded\."first_signed_in_at"\)/
    )
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, USER_A, AT.toISOString()])
    )
  })
})

describe('getInvitationStatesByUserIdsDao', () => {
  it('lit les traces des comptes demandés, sous l’association', async () => {
    responses.current = [[[USER_A, AT.toISOString(), null]]]

    const rows = await getInvitationStatesByUserIdsDao(ORG_ID, [USER_A, USER_B])

    expect(sent[0].sql).toMatch(/from "member_invitation_state"/)
    expect(sent[0].sql).toMatch(/"organization_id" = \$1/)
    expect(sent[0].params).toEqual([ORG_ID, USER_A, USER_B])
    expect(rows).toEqual([
      {userId: USER_A, lastInvitedAt: AT, firstSignedInAt: null},
    ])
  })

  it('sans compte demandé : aucune requête', async () => {
    expect(await getInvitationStatesByUserIdsDao(ORG_ID, [])).toEqual([])
    expect(sent).toHaveLength(0)
  })
})

describe('getInvitationStatesByEmailsDao (s42b, ADR 072)', () => {
  it('relie chaque adresse, sans casse, à son compte puis aux traces de ce compte sur l’association', async () => {
    responses.current = [
      [
        ['anne@example.fr', USER_A, AT.toISOString(), null],
        ['paul@example.fr', USER_B, null, null],
      ],
    ]

    const rows = await getInvitationStatesByEmailsDao(ORG_ID, [
      'Anne@Example.fr ',
      'paul@example.fr',
    ])

    expect(sent).toHaveLength(1)
    expect(sent[0].sql).toMatch(/from "user"/)
    expect(sent[0].sql).toMatch(/left join "member_invitation_state"/)
    expect(sent[0].sql).toMatch(/lower\("user"\."email"\)/)
    expect(sent[0].params).toEqual(
      expect.arrayContaining([ORG_ID, 'anne@example.fr', 'paul@example.fr'])
    )
    expect(rows).toEqual([
      {
        email: 'anne@example.fr',
        userId: USER_A,
        lastInvitedAt: AT,
        firstSignedInAt: null,
      },
      {
        email: 'paul@example.fr',
        userId: USER_B,
        lastInvitedAt: null,
        firstSignedInAt: null,
      },
    ])
  })

  it('sans adresse demandée : aucune requête', async () => {
    expect(await getInvitationStatesByEmailsDao(ORG_ID, [])).toEqual([])
    expect(sent).toHaveLength(0)
  })
})
