import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  notInArray,
  sql,
} from 'drizzle-orm'

import {
  AddMemberInvoiceModel,
  invoiceStatusAlert,
  memberInvoice,
  MemberInvoiceModel,
} from '@/db/models/member-invoice-model'
import {parcel} from '@/db/models/parcel-model'
import {getDb} from '@/db/tenant-scope'

/**
 * Factures des membres et alertes de statut (s19, ADR 059). Sous RLS forcee :
 * hors `withTenant(organizationId, ...)`, rien ne sort et rien ne s'ecrit.
 */

/**
 * Une facture lue avec son terrain facture : numero de parcelle et compteur.
 * Nuls pour une facture Pennylane, qui ne nomme pas de parcelle (ADR 062 §4).
 */
export type MemberInvoiceRow = MemberInvoiceModel & {
  parcelNumber: string | null
  meterNumber: string | null
}

/** Ce qu'une correction du bureau peut changer : ni la fiche, ni la source. */
export type SiteInvoiceChanges = Pick<
  MemberInvoiceModel,
  'parcelId' | 'year' | 'issuedOn' | 'dueOn' | 'amountCents' | 'status'
>

/** Emission la plus recente d'abord, puis la saisie : un departage stable. */
const MEMBER_INVOICE_ORDER = [
  desc(memberInvoice.issuedOn),
  desc(memberInvoice.createdAt),
] as const

const selectInvoiceWithParcel = () =>
  getDb()
    .select({
      ...getTableColumns(memberInvoice),
      parcelNumber: parcel.number,
      meterNumber: parcel.meterNumber,
    })
    .from(memberInvoice)
    .leftJoin(parcel, eq(memberInvoice.parcelId, parcel.id))

/** Les factures des fiches donnees ; seule la fiche facturee est lue. */
export const listInvoicesByProfileIdsDao = async (
  profileIds: readonly string[]
): Promise<MemberInvoiceRow[]> => {
  if (profileIds.length === 0) return []
  return selectInvoiceWithParcel()
    .where(inArray(memberInvoice.memberProfileId, [...profileIds]))
    .orderBy(...MEMBER_INVOICE_ORDER)
}

export const listInvoicesByMemberDao = async (
  memberProfileId: string
): Promise<MemberInvoiceRow[]> => listInvoicesByProfileIdsDao([memberProfileId])

export const getInvoiceByIdDao = async (
  invoiceId: string
): Promise<MemberInvoiceRow | undefined> => {
  const [row] = await selectInvoiceWithParcel().where(
    eq(memberInvoice.id, invoiceId)
  )
  return row
}

export const createInvoiceDao = async (
  input: Omit<AddMemberInvoiceModel, 'id' | 'createdAt' | 'updatedAt'>
): Promise<MemberInvoiceModel> => {
  const [row] = await getDb().insert(memberInvoice).values(input).returning()
  return row
}

/**
 * Corrige une facture **saisie sur le site** : la condition `source = 'site'`
 * est dans l'`UPDATE`, une facture Pennylane n'est jamais touchee. Rend le
 * nombre de lignes modifiees.
 */
export const updateSiteInvoiceDao = async (
  invoiceId: string,
  changes: SiteInvoiceChanges
): Promise<number> => {
  const rows = await getDb()
    .update(memberInvoice)
    .set({...changes, updatedAt: sql`now()`})
    .where(
      and(eq(memberInvoice.id, invoiceId), eq(memberInvoice.source, 'site'))
    )
    .returning({id: memberInvoice.id})
  return rows.length
}

/** Combien de factures de l'association portent ce statut. */
export const countInvoicesByStatusDao = async (
  organizationId: string,
  status: string
): Promise<number> => {
  const [row] = await getDb()
    .select({total: count()})
    .from(memberInvoice)
    .where(
      and(
        eq(memberInvoice.organizationId, organizationId),
        eq(memberInvoice.status, status)
      )
    )
  return row?.total ?? 0
}

/**
 * Reclame le signalement d'un statut : la ligne est posee si elle n'existait
 * pas, et son identifiant rendu ; rien si le statut est deja signale.
 */
export const claimStatusAlertDao = async (
  organizationId: string,
  status: string
): Promise<{id: string} | undefined> => {
  const [row] = await getDb()
    .insert(invoiceStatusAlert)
    .values({organizationId, status})
    .onConflictDoNothing()
    .returning({id: invoiceStatusAlert.id})
  return row
}

/** Libere un signalement dont l'envoi a echoue : il sera retente. */
export const releaseStatusAlertDao = async (
  organizationId: string,
  status: string
): Promise<void> => {
  await getDb()
    .delete(invoiceStatusAlert)
    .where(
      and(
        eq(invoiceStatusAlert.organizationId, organizationId),
        eq(invoiceStatusAlert.status, status)
      )
    )
}

/**
 * Libere le signalement designe par un envoi reporte qui n'a pas abouti
 * (ADR 059 §5) : la prochaine ecriture portant ce statut le retentera.
 */
export const releaseStatusAlertByIdDao = async (
  alertId: string
): Promise<void> => {
  await getDb()
    .delete(invoiceStatusAlert)
    .where(eq(invoiceStatusAlert.id, alertId))
}

/** Une facture ecrite par la synchronisation Pennylane (s20, ADR 062 §1). */
export type PennylaneInvoiceUpsert = Pick<
  MemberInvoiceModel,
  | 'memberProfileId'
  | 'year'
  | 'issuedOn'
  | 'dueOn'
  | 'amountCents'
  | 'status'
  | 'hasPdf'
> & {externalId: string}

const PENNYLANE_SOURCE = 'pennylane' as const

const excludedColumn = (column: string) => sql.raw(`excluded."${column}"`)

/**
 * Ecrit les factures relues chez Pennylane, par `(organization_id,
 * external_id)` : `source = pennylane`, sans parcelle (ADR 062 §4). Une ligne
 * existante n'est reecrite que si elle vient elle-meme de Pennylane.
 */
export const upsertPennylaneInvoicesDao = async (
  organizationId: string,
  invoices: readonly PennylaneInvoiceUpsert[]
): Promise<void> => {
  if (invoices.length === 0) return
  await getDb()
    .insert(memberInvoice)
    .values(
      invoices.map((invoice) => ({
        ...invoice,
        organizationId,
        source: PENNYLANE_SOURCE,
        parcelId: null,
      }))
    )
    .onConflictDoUpdate({
      target: [memberInvoice.organizationId, memberInvoice.externalId],
      targetWhere: sql`${memberInvoice.externalId} is not null`,
      set: {
        memberProfileId: excludedColumn('member_profile_id'),
        year: excludedColumn('year'),
        issuedOn: excludedColumn('issued_on'),
        dueOn: excludedColumn('due_on'),
        amountCents: excludedColumn('amount_cents'),
        status: excludedColumn('status'),
        hasPdf: excludedColumn('has_pdf'),
        updatedAt: sql`now()`,
      },
      setWhere: sql`${memberInvoice.source} = 'pennylane'`,
    })
}

/**
 * Supprime les factures Pennylane de l'association absentes d'une relecture
 * complete (ADR 062 §3) ; une facture saisie sur le site n'est jamais touchee.
 */
export const deletePennylaneInvoicesNotInDao = async (
  organizationId: string,
  keptExternalIds: readonly string[]
): Promise<void> => {
  await getDb()
    .delete(memberInvoice)
    .where(
      and(
        eq(memberInvoice.organizationId, organizationId),
        eq(memberInvoice.source, PENNYLANE_SOURCE),
        ...(keptExternalIds.length > 0
          ? [notInArray(memberInvoice.externalId, [...keptExternalIds])]
          : [])
      )
    )
}
