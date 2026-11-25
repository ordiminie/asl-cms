import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des modeles de documents (s36, ADR 074). La base n'est pas joignable en
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
  createDocumentTemplateDao,
  deleteDocumentTemplateDao,
  getDocumentTemplateByIdDao,
  listDocumentTemplatesDao,
  updateDocumentTemplateDao,
} from './document-template-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('listDocumentTemplatesDao', () => {
  it('lit les modèles de l’association, triés par nom sans casse puis par id', async () => {
    await listDocumentTemplatesDao(ORG_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "document_template"')
    expect(sql).toContain('"document_template"."organization_id" = $1')
    expect(sql).toContain(
      'order by lower("document_template"."name") asc, "document_template"."id" asc'
    )
    expect(params).toEqual([ORG_ID])
  })
})

describe('getDocumentTemplateByIdDao', () => {
  it('lit un modèle par son identifiant', async () => {
    await getDocumentTemplateByIdDao(TEMPLATE_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('from "document_template"')
    expect(sql).toContain('"document_template"."id" = $1')
    expect(params).toEqual([TEMPLATE_ID])
  })
})

describe('createDocumentTemplateDao', () => {
  it('écrit le modèle de l’association et le rend', async () => {
    await createDocumentTemplateDao({
      organizationId: ORG_ID,
      name: 'Convocation AG',
      subject: 'Convocation',
      bodyMarkdown: 'Bonjour {nom}',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "document_template"')
    expect(sql).toContain('"body_markdown"')
    expect(sql).toContain('returning')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, 'Convocation AG', 'Bonjour {nom}'])
    )
  })
})

describe('updateDocumentTemplateDao', () => {
  it('met à jour les champs et la date de modification, et rend la ligne', async () => {
    await updateDocumentTemplateDao(TEMPLATE_ID, {
      name: 'Courrier',
      subject: 'Objet',
      bodyMarkdown: 'Texte',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('update "document_template"')
    expect(sql).toContain('"updated_at" = now()')
    expect(sql).toContain('where "document_template"."id" = $')
    expect(sql).toContain('returning')
    expect(params).toEqual(
      expect.arrayContaining(['Courrier', 'Objet', 'Texte', TEMPLATE_ID])
    )
  })
})

describe('deleteDocumentTemplateDao', () => {
  it('supprime le modèle et rend la ligne supprimée', async () => {
    await deleteDocumentTemplateDao(TEMPLATE_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('delete from "document_template"')
    expect(sql).toContain('"document_template"."id" = $1')
    expect(sql).toContain('returning')
    expect(params).toEqual([TEMPLATE_ID])
  })
})
