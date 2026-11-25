import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des documents nominatifs (s32, ADR 073). La base n'est pas joignable en
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
  countMemberDocumentsByCategoryDao,
  countMemberProfilesWithoutReferenceDao,
  createMemberDocumentDao,
  deleteMemberDocumentDao,
  getMemberDocumentByIdDao,
  getMemberProfileIdsByPennylaneReferenceDao,
  listMemberDocumentsByProfileDao,
  listMemberDocumentsByProfilesDao,
  listMemberDocumentsForBureauDao,
} from './member-document-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_A = '33333333-3333-4333-8333-333333333333'
const PROFILE_B = '44444444-4444-4444-8444-444444444444'
const CATEGORY_ID = '55555555-5555-4555-8555-555555555555'
const REFERENCE = '3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('createMemberDocumentDao', () => {
  it('écrit le document avec l’identifiant reçu du service et sa fiche', async () => {
    await createMemberDocumentDao({
      id: DOCUMENT_ID,
      organizationId: ORG_ID,
      memberProfileId: PROFILE_A,
      title: 'Facture 2026',
      categoryId: CATEGORY_ID,
      documentDate: '2026-03-15',
      fileKey: 'k',
      fileBytes: 10,
    })

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "member_document"')
    expect(sql).toContain('"member_profile_id"')
    expect(sql).toContain('"document_date"')
    expect(sql).toContain('returning')
    expect(params).toEqual(
      expect.arrayContaining([DOCUMENT_ID, ORG_ID, PROFILE_A, '2026-03-15'])
    )
  })
})

describe('getMemberDocumentByIdDao', () => {
  it('lit un document par son identifiant', async () => {
    await getMemberDocumentByIdDao(DOCUMENT_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_document"')
    expect(sql).toContain('"member_document"."id" = $1')
    expect(params).toEqual([DOCUMENT_ID])
  })
})

describe('listMemberDocumentsByProfilesDao — « mes fiches »', () => {
  it('lit les documents des fiches demandées avec leur catégorie, date du document décroissante', async () => {
    await listMemberDocumentsByProfilesDao([PROFILE_A, PROFILE_B])

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_document"')
    expect(sql).toContain(
      'inner join "association_category" on "member_document"."category_id" = "association_category"."id"'
    )
    expect(sql).toContain('"member_document"."member_profile_id" in ($1, $2)')
    expect(sql).toContain(
      'order by "member_document"."document_date" desc, "member_document"."created_at" desc'
    )
    expect(params).toEqual([PROFILE_A, PROFILE_B])
  })

  it('aucune fiche : aucune requête, aucun document', async () => {
    expect(await listMemberDocumentsByProfilesDao([])).toEqual([])
    expect(sent).toEqual([])
  })
})

describe('listMemberDocumentsByProfileDao — section de la fiche', () => {
  it('lit les documents d’une seule fiche', async () => {
    await listMemberDocumentsByProfileDao(PROFILE_A)

    const [{sql, params}] = sent
    expect(sql).toContain('"member_document"."member_profile_id" = $1')
    expect(sql).toContain('inner join "association_category"')
    expect(params).toEqual([PROFILE_A])
  })
})

describe('listMemberDocumentsForBureauDao — vue d’ensemble paginée', () => {
  it('joint la fiche et la catégorie, filtre l’association, pagine côté serveur', async () => {
    responses.current = [[], [[0]]]

    await listMemberDocumentsForBureauDao(ORG_ID, {page: 2, pageSize: 25})

    const [{sql, params}, countQuery] = sent
    expect(sql).toContain(
      'inner join "member_profile" on "member_document"."member_profile_id" = "member_profile"."id"'
    )
    expect(sql).toContain('inner join "association_category"')
    expect(sql).toContain('"member_document"."organization_id" = $1')
    expect(sql).toContain('order by "member_document"."created_at" desc')
    expect(sql).toMatch(/limit \$\d+ offset \$\d+/)
    expect(params).toEqual(expect.arrayContaining([ORG_ID, 25, 25]))
    expect(countQuery.sql).toContain('count(')
  })

  it('cherche par nom de fiche, jokers neutralisés, et filtre la catégorie', async () => {
    responses.current = [[], [[0]]]

    await listMemberDocumentsForBureauDao(ORG_ID, {
      search: '50%_x',
      categoryId: CATEGORY_ID,
      page: 1,
      pageSize: 25,
    })

    const [{sql, params}, countQuery] = sent
    expect(sql).toContain('"member_profile"."name" ilike')
    expect(sql).toContain('"member_document"."category_id" =')
    expect(params).toEqual(expect.arrayContaining(['%50\\%\\_x%', CATEGORY_ID]))
    expect(countQuery.sql).toContain('"member_profile"."name" ilike')
    expect(countQuery.params).toEqual(
      expect.arrayContaining(['%50\\%\\_x%', CATEGORY_ID])
    )
  })

  it('rend les lignes et le total', async () => {
    responses.current = [[], [[7]]]

    const result = await listMemberDocumentsForBureauDao(ORG_ID, {
      page: 1,
      pageSize: 25,
    })

    expect(result).toEqual({rows: [], total: 7})
  })
})

describe('countMemberDocumentsByCategoryDao', () => {
  it('compte les documents par catégorie de l’association', async () => {
    responses.current = [[[CATEGORY_ID, 3]]]

    const counts = await countMemberDocumentsByCategoryDao(ORG_ID)

    expect(sent[0].sql).toContain('group by "member_document"."category_id"')
    expect(sent[0].params).toEqual([ORG_ID])
    expect(counts).toEqual({[CATEGORY_ID]: 3})
  })
})

describe('deleteMemberDocumentDao', () => {
  it('supprime la ligne et la rend', async () => {
    await deleteMemberDocumentDao(DOCUMENT_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('delete from "member_document"')
    expect(sql).toContain('returning')
    expect(params).toEqual([DOCUMENT_ID])
  })
})

describe('getMemberProfileIdsByPennylaneReferenceDao — rapprochement du lot', () => {
  it('compare sans casse à la référence, dans l’association', async () => {
    responses.current = [[[PROFILE_A]]]

    const ids = await getMemberProfileIdsByPennylaneReferenceDao(
      ORG_ID,
      REFERENCE
    )

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_profile"')
    expect(sql).toContain('"member_profile"."organization_id" = $1')
    expect(sql).toContain(
      'lower("member_profile"."pennylane_customer_id") = lower('
    )
    expect(params).toEqual(expect.arrayContaining([ORG_ID, REFERENCE]))
    expect(ids).toEqual([PROFILE_A])
  })

  it('ne rend rien sans correspondance', async () => {
    responses.current = [[]]

    expect(
      await getMemberProfileIdsByPennylaneReferenceDao(ORG_ID, REFERENCE)
    ).toEqual([])
  })

  it('rend les deux fiches qui se disputent la référence, au plus deux : le service en fait une ambiguïté', async () => {
    responses.current = [[[PROFILE_A], [PROFILE_B]]]

    expect(
      await getMemberProfileIdsByPennylaneReferenceDao(ORG_ID, REFERENCE)
    ).toEqual([PROFILE_A, PROFILE_B])
    const [{sql}] = sent
    expect(sql).toContain('limit')
  })
})

describe('countMemberProfilesWithoutReferenceDao', () => {
  it('compte les fiches de l’association sans identifiant client Pennylane', async () => {
    responses.current = [[[4]]]

    const total = await countMemberProfilesWithoutReferenceDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('"member_profile"."pennylane_customer_id" is null')
    expect(params).toEqual([ORG_ID])
    expect(total).toBe(4)
  })
})
