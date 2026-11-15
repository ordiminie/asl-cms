import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des questions des membres (s23). La base n'est pas joignable en
 * unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres. La RLS se prouve en e2e.
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
  countMemberQuestionsByCategoryDao,
  createMemberQuestionDao,
  getMemberQuestionByIdDao,
  getMemberQuestionsPageDao,
  markMemberQuestionNotificationFailedDao,
} from './member-question-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const QUESTION_ID = '22222222-2222-4222-8222-222222222222'
const MEMBER_ID = '33333333-3333-4333-8333-333333333333'
const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('createMemberQuestionDao', () => {
  it('écrit la question avec la fiche et le sujet, sans aucune identité copiée', async () => {
    responses.current = [
      [
        [
          QUESTION_ID,
          ORG_ID,
          MEMBER_ID,
          CATEGORY_ID,
          'Ma question',
          false,
          '2026-11-14T10:00:00Z',
        ],
      ],
    ]

    const row = await createMemberQuestionDao({
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
      categoryId: CATEGORY_ID,
      body: 'Ma question',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "member_question"')
    expect(sql).not.toContain('"name"')
    expect(sql).not.toContain('"email"')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, MEMBER_ID, CATEGORY_ID, 'Ma question'])
    )
    expect(row.id).toBe(QUESTION_ID)
  })
})

describe('getMemberQuestionsPageDao', () => {
  it('lit la file du tenant, le plus récent d abord, paginée', async () => {
    responses.current = [[], [[0]]]

    await getMemberQuestionsPageDao(ORG_ID, 3, 25)

    const [list, total] = sent
    expect(list.sql).toContain('from "member_question"')
    expect(list.sql).toContain('"member_question"."organization_id" = $1')
    expect(list.sql).toContain(
      'order by "member_question"."created_at" desc, "member_question"."id" desc'
    )
    expect(list.sql).toContain('limit $2')
    expect(list.sql).toContain('offset $3')
    expect(list.params).toEqual([ORG_ID, 25, 50])
    expect(total.sql).toContain('count(')
    expect(total.params).toEqual([ORG_ID])
  })

  it('joint le sujet SANS filtrer les sujets supprimés (critère 5), et la fiche pour l identité', async () => {
    responses.current = [[], [[0]]]

    await getMemberQuestionsPageDao(ORG_ID, 1, 25)

    const [{sql}] = sent
    expect(sql).toContain(
      'join "association_category" on "member_question"."category_id" = "association_category"."id"'
    )
    expect(sql).toContain('"association_category"."deleted_at"')
    expect(sql).not.toContain('"association_category"."deleted_at" is null')
    expect(sql).toContain(
      'join "member_profile" on "member_question"."member_id" = "member_profile"."id"'
    )
    expect(sql).toContain('"member_profile"."name"')
    expect(sql).toContain('"member_profile"."email"')
  })
})

describe('getMemberQuestionByIdDao', () => {
  it('lit une question par son identifiant, sujet supprimé compris', async () => {
    await getMemberQuestionByIdDao(QUESTION_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('"member_question"."id" = $1')
    expect(sql).toContain('join "association_category"')
    expect(sql).not.toContain('"association_category"."deleted_at" is null')
    expect(sql).toContain('join "member_profile"')
    expect(params).toEqual([QUESTION_ID])
  })
})

describe('countMemberQuestionsByCategoryDao', () => {
  it('compte les questions de chaque sujet du tenant', async () => {
    responses.current = [[[CATEGORY_ID, 4]]]

    const counts = await countMemberQuestionsByCategoryDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('group by "member_question"."category_id"')
    expect(params).toEqual([ORG_ID])
    expect(counts).toEqual({[CATEGORY_ID]: 4})
  })
})

describe('markMemberQuestionNotificationFailedDao', () => {
  it('pose le témoin d échec sur la seule question', async () => {
    await markMemberQuestionNotificationFailedDao(QUESTION_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('update "member_question"')
    expect(sql).toContain('"notification_failed" = $1')
    expect(params).toEqual([true, QUESTION_ID])
  })
})
