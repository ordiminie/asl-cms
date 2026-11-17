import {drizzle} from 'drizzle-orm/pg-proxy'
import {beforeEach, describe, expect, it, vi} from 'vitest'

/**
 * DAO des factures des membres (s19, ADR 059). La base n'est pas joignable en
 * unitaire : un client Drizzle `pg-proxy` rend au test chaque requete telle
 * qu'elle partirait vers Postgres. La RLS et le comportement reel se prouvent
 * en e2e.
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
  claimStatusAlertDao,
  countInvoicesByStatusDao,
  createInvoiceDao,
  getInvoiceByIdDao,
  listInvoicesByMemberDao,
  listInvoicesByProfileIdsDao,
  releaseStatusAlertByIdDao,
  releaseStatusAlertDao,
  updateSiteInvoiceDao,
} from './member-invoice-repository'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '22222222-2222-4222-8222-222222222222'
const PROFILE_A = '33333333-3333-4333-8333-333333333333'
const PROFILE_B = '44444444-4444-4444-8444-444444444444'
const PARCEL_ID = '55555555-5555-4555-8555-555555555555'
const ALERT_ID = '66666666-6666-4666-8666-666666666666'

beforeEach(() => {
  sent.length = 0
  responses.current = []
})

describe('listInvoicesByProfileIdsDao', () => {
  it('lit les factures des fiches demandées, avec le terrain facturé, émission décroissante', async () => {
    await listInvoicesByProfileIdsDao([PROFILE_A, PROFILE_B])

    const [{sql, params}] = sent
    expect(sql).toContain('from "member_invoice"')
    expect(sql).toContain(
      'join "parcel" on "member_invoice"."parcel_id" = "parcel"."id"'
    )
    expect(sql).toContain('"parcel"."number"')
    expect(sql).toContain('"parcel"."meter_number"')
    expect(sql).toContain('"member_invoice"."member_profile_id" in ($1, $2)')
    expect(sql).toContain(
      'order by "member_invoice"."issued_on" desc, "member_invoice"."created_at" desc'
    )
    expect(params).toEqual([PROFILE_A, PROFILE_B])
  })

  it('aucune fiche : aucune requête, aucune facture', async () => {
    expect(await listInvoicesByProfileIdsDao([])).toEqual([])
    expect(sent).toEqual([])
  })
})

describe('listInvoicesByMemberDao', () => {
  it('lit les factures d’une seule fiche', async () => {
    await listInvoicesByMemberDao(PROFILE_A)

    const [{sql, params}] = sent
    expect(sql).toContain('"member_invoice"."member_profile_id" in ($1)')
    expect(params).toEqual([PROFILE_A])
  })
})

describe('getInvoiceByIdDao', () => {
  it('lit une facture par son identifiant, avec son terrain', async () => {
    await getInvoiceByIdDao(INVOICE_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('"member_invoice"."id" = $1')
    expect(sql).toContain('join "parcel"')
    expect(params).toEqual([INVOICE_ID])
  })
})

describe('createInvoiceDao', () => {
  it('écrit la facture et la rend', async () => {
    responses.current = [
      [
        [
          INVOICE_ID,
          ORG_ID,
          PROFILE_A,
          PARCEL_ID,
          'site',
          null,
          2026,
          '2026-03-15',
          '2026-04-15',
          41250,
          'En attente',
          '2026-03-15T10:00:00Z',
          '2026-03-15T10:00:00Z',
        ],
      ],
    ]

    const row = await createInvoiceDao({
      organizationId: ORG_ID,
      memberProfileId: PROFILE_A,
      parcelId: PARCEL_ID,
      source: 'site',
      year: 2026,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      amountCents: 41250,
      status: 'En attente',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "member_invoice"')
    expect(params).toEqual(
      expect.arrayContaining([ORG_ID, PROFILE_A, PARCEL_ID, 'site', 41250])
    )
    expect(row.id).toBe(INVOICE_ID)
  })
})

describe('updateSiteInvoiceDao', () => {
  it('ne modifie qu’une facture saisie sur le site, et rend le nombre de lignes', async () => {
    responses.current = [[[INVOICE_ID]]]

    const updated = await updateSiteInvoiceDao(INVOICE_ID, {
      parcelId: PARCEL_ID,
      year: 2026,
      issuedOn: '2026-03-15',
      dueOn: '2026-04-15',
      amountCents: 41250,
      status: 'Payée',
    })

    const [{sql, params}] = sent
    expect(sql).toContain('update "member_invoice"')
    expect(sql).toContain('"updated_at" = now()')
    expect(sql).toMatch(
      /where \("member_invoice"\."id" = \$\d+ and "member_invoice"\."source" = \$\d+\)/
    )
    expect(params).toEqual(expect.arrayContaining([INVOICE_ID, 'site']))
    expect(updated).toBe(1)
  })

  it('une facture Pennylane n’est pas touchée : zéro ligne', async () => {
    responses.current = [[]]

    expect(
      await updateSiteInvoiceDao(INVOICE_ID, {
        parcelId: PARCEL_ID,
        year: 2026,
        issuedOn: '2026-03-15',
        dueOn: '2026-04-15',
        amountCents: 41250,
        status: 'Payée',
      })
    ).toBe(0)
  })
})

describe('countInvoicesByStatusDao', () => {
  it('compte les factures du tenant qui portent ce statut', async () => {
    responses.current = [[[3]]]

    expect(await countInvoicesByStatusDao(ORG_ID, 'Relance 9')).toBe(3)
    const [{sql, params}] = sent
    expect(sql).toContain('count(')
    expect(params).toEqual([ORG_ID, 'Relance 9'])
  })
})

describe('claimStatusAlertDao / releaseStatusAlertDao', () => {
  it('réclame le signalement d’un statut une seule fois : la seconde fois, rien', async () => {
    responses.current = [[[ALERT_ID]], []]

    expect(await claimStatusAlertDao(ORG_ID, 'Relance 9')).toEqual({
      id: ALERT_ID,
    })
    expect(await claimStatusAlertDao(ORG_ID, 'Relance 9')).toBeUndefined()

    const [{sql, params}] = sent
    expect(sql).toContain('insert into "invoice_status_alert"')
    expect(sql).toContain('on conflict do nothing')
    expect(sql).toContain('returning "id"')
    expect(params).toEqual(expect.arrayContaining([ORG_ID, 'Relance 9']))
  })

  it('libère un signalement dont l’envoi a échoué', async () => {
    await releaseStatusAlertDao(ORG_ID, 'Relance 9')

    const [{sql, params}] = sent
    expect(sql).toContain('delete from "invoice_status_alert"')
    expect(params).toEqual([ORG_ID, 'Relance 9'])
  })
})

describe('releaseStatusAlertByIdDao', () => {
  it('libère le signalement désigné par un envoi reporté qui n’a pas abouti', async () => {
    await releaseStatusAlertByIdDao(ALERT_ID)

    const [{sql, params}] = sent
    expect(sql).toContain('delete from "invoice_status_alert"')
    expect(sql).toContain('"invoice_status_alert"."id" = $1')
    expect(params).toEqual([ALERT_ID])
  })
})
