import 'server-only'

import {z} from 'zod'

import {
  getBillingSyncStateDao,
  recordBillingSyncFailureDao,
  recordBillingSyncSuccessDao,
} from '@/db/repositories/billing-sync-state-repository'
import {
  deletePennylaneInvoicesNotInDao,
  upsertPennylaneInvoicesDao,
} from '@/db/repositories/member-invoice-repository'
import {
  listPennylaneLinkedProfilesDao,
  listProfilesWithoutPennylaneIdDao,
} from '@/db/repositories/member-profile-repository'
import {listOwnershipPeriodsByProfilesDao} from '@/db/repositories/parcel-ownership-repository'
import {enqueueScheduledJobTxnDao} from '@/db/repositories/scheduled-job-repository'
import {withTenant} from '@/db/tenant-scope'
import {logger} from '@/lib/logger'
import {PennylaneError} from '@/lib/pennylane/pennylane-client'
import {getPennylaneClient} from '@/lib/pennylane/pennylane-client.server'
import type {
  PennylaneCustomer,
  PennylaneInvoice,
} from '@/lib/pennylane/pennylane-schemas'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {signalUnknownInvoiceStatuses} from './member-invoice-service'
import {
  compareTerrain,
  mapPennylaneInvoices,
  parcelsOwnedOn,
  type PennylaneInvoiceWrite,
  type PennylaneProfileRef,
} from './rules/pennylane-invoice-mapping'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  BILLING_PROVIDER_PENNYLANE,
  BILLING_PROVIDER_SETTING_KEY,
} from './types/domain/association-settings-types'
import {
  BILLING_SYNC_ERROR_CODES,
  type BillingSyncCounts,
  type BillingSyncErrorCode,
  type BillingSyncOverviewDTO,
  type BillingSyncTerrainMismatch,
  type PennylaneSyncResult,
} from './types/domain/billing-sync-types'
import {
  BILLING_SYNC_PENNYLANE_JOB_KIND,
  ScheduledJob,
  ScheduledJobHandlers,
  ScheduledJobOutcome,
} from './types/domain/scheduled-job-types'

/**
 * Synchronisation des factures Pennylane d'une association (s20, ADR 062),
 * **sans session** : lancee par le planificateur, ou par l'action du bureau
 * apres son propre controle. Dans l'ordre : fournisseur `pennylane` (sinon
 * rien) ; relecture **complete** des clients puis des factures ; une
 * relecture interrompue n'ecrit aucune facture et note l'echec ; sinon
 * ecriture, suppression des absentes et etat, dans une seule transaction du
 * tenant ; puis signalement des statuts inconnus. Jamais `withRlsBypass`.
 */

const organizationIdSchema = z.string().uuid()

type PennylaneReading = {
  customers: PennylaneCustomer[]
  invoices: PennylaneInvoice[]
}

/** Relit tout ; un echec type de Pennylane est rendu, jamais leve. */
const readPennylane = async (): Promise<
  PennylaneReading | {error: PennylaneError}
> => {
  const client = getPennylaneClient()
  try {
    const customers = await client.listCustomers()
    const invoices = await client.listCustomerInvoices()
    return {customers, invoices}
  } catch (error) {
    if (error instanceof PennylaneError) return {error}
    throw error
  }
}

const isPennylaneProvider = async (organizationId: string) => {
  const settings = await getAssociationSettingsService(organizationId)
  return (
    settings[BILLING_PROVIDER_SETTING_KEY]?.value === BILLING_PROVIDER_PENNYLANE
  )
}

const profilesByExternalRefOf = async (
  organizationId: string
): Promise<Map<string, PennylaneProfileRef>> => {
  const rows = await withTenant(organizationId, () =>
    listPennylaneLinkedProfilesDao(organizationId)
  )
  return new Map(
    rows.map((row) => [row.pennylaneCustomerId, {id: row.id, name: row.name}])
  )
}

/** Les factures dont la ligne de terrain contredit la fiche a l'emission. */
const terrainMismatchesOf = async (
  organizationId: string,
  writes: readonly PennylaneInvoiceWrite[],
  profileNames: ReadonlyMap<string, string>
): Promise<BillingSyncTerrainMismatch[]> => {
  const checked = writes.filter((write) => write.terrain !== null)
  if (checked.length === 0) return []
  const periods = await withTenant(organizationId, () =>
    listOwnershipPeriodsByProfilesDao([
      ...new Set(checked.map((write) => write.memberProfileId)),
    ])
  )
  return checked.flatMap((write) => {
    const terrain = write.terrain
    if (
      !terrain ||
      !compareTerrain(
        terrain,
        parcelsOwnedOn(periods, write.memberProfileId, write.issuedOn)
      )
    ) {
      return []
    }
    return [
      {
        invoiceNumber: write.invoiceNumber ?? write.externalId,
        memberProfileId: write.memberProfileId,
        memberProfileName: profileNames.get(write.memberProfileId) ?? '',
        parcels: terrain.parcels,
        meter: terrain.meter,
      },
    ]
  })
}

/** Ce que la table recoit d'une facture : ni numero, ni ligne de terrain. */
const toUpsert = (write: PennylaneInvoiceWrite) => ({
  externalId: write.externalId,
  memberProfileId: write.memberProfileId,
  year: write.year,
  issuedOn: write.issuedOn,
  dueOn: write.dueOn,
  amountCents: write.amountCents,
  status: write.status,
  hasPdf: write.hasPdf,
})

/**
 * Une facture par identifiant, la derniere lue : une pagination instable peut
 * rendre deux fois la meme, et Postgres refuse d'ecrire deux fois une ligne
 * dans un meme `ON CONFLICT DO UPDATE`.
 */
const uniqueInvoicesOf = (
  invoices: readonly PennylaneInvoice[]
): PennylaneInvoice[] => [
  ...new Map(invoices.map((invoice) => [invoice.id, invoice])).values(),
]

/**
 * Note l'echec d'une synchronisation hors erreur de Pennylane (base comprise),
 * pour que le bureau ne lise pas une ancienne date sans alerte. Ne leve
 * jamais : l'erreur d'origine reste celle qui remonte.
 */
const recordUnexpectedFailure = async (
  organizationId: string,
  now: Date
): Promise<void> => {
  try {
    await withTenant(organizationId, () =>
      recordBillingSyncFailureDao(organizationId, now, 'unavailable')
    )
  } catch {
    logger.error('[PENNYLANE-SYNC] Echec de synchronisation non note', {
      organizationId,
    })
  }
}

/** Relit Pennylane puis ecrit, dans une transaction du tenant. */
const readAndWrite = async (
  orgId: string,
  now: Date
): Promise<{result: PennylaneSyncResult; statuses: string[]}> => {
  const reading = await readPennylane()
  if ('error' in reading) {
    await withTenant(orgId, () =>
      recordBillingSyncFailureDao(orgId, now, reading.error.code)
    )
    return {result: {status: 'failed', error: reading.error.code}, statuses: []}
  }

  const profiles = await profilesByExternalRefOf(orgId)
  const mapping = mapPennylaneInvoices({
    customers: reading.customers,
    invoices: uniqueInvoicesOf(reading.invoices),
    profilesByExternalRef: profiles,
  })
  const terrainMismatches = await terrainMismatchesOf(
    orgId,
    mapping.writes,
    new Map([...profiles.values()].map(({id, name}) => [id, name]))
  )
  const counts = {written: mapping.writes.length, ...mapping.skipped}

  await withTenant(orgId, async () => {
    await upsertPennylaneInvoicesDao(orgId, mapping.writes.map(toUpsert))
    await deletePennylaneInvoicesNotInDao(
      orgId,
      mapping.writes.map((write) => write.externalId)
    )
    await recordBillingSyncSuccessDao(orgId, {
      now,
      counts,
      unmatchedCustomers: mapping.unmatchedCustomers,
      terrainMismatches,
    })
  })
  return {
    result: {status: 'synced', counts},
    statuses: [...new Set(mapping.writes.map((write) => write.status))],
  }
}

export const syncPennylaneInvoicesService = async (
  organizationId: string,
  now: Date
): Promise<PennylaneSyncResult> => {
  const parsed = organizationIdSchema.safeParse(organizationId)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  const orgId = parsed.data

  if (!(await isPennylaneProvider(orgId))) return {status: 'skipped'}

  const synced = await readAndWrite(orgId, now).catch(
    async (error: unknown) => {
      await recordUnexpectedFailure(orgId, now)
      throw error
    }
  )
  if (synced.result.status === 'synced') {
    await signalUnknownInvoiceStatuses(orgId, synced.statuses)
  }
  return synced.result
}

const HOUR_MS = 60 * 60 * 1000
const SYNC_DENIED =
  "Seul le bureau de l'association peut mettre a jour les factures"

/** Le debut de l'heure qui suit cet instant. */
const nextHourOf = (now: Date): Date =>
  new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS)

/**
 * Programme la synchronisation de l'heure qui suit (ADR 062 §8). La cle est
 * l'heure visee : un appel repete, ou une chaine deja vivante, ne cree rien.
 */
const enqueueNextSync = async (
  organizationId: string,
  now: Date
): Promise<void> => {
  const hour = nextHourOf(now)
  await withTenant(organizationId, () =>
    enqueueScheduledJobTxnDao({
      organizationId,
      kind: BILLING_SYNC_PENNYLANE_JOB_KIND,
      idempotencyKey: hour.toISOString(),
      runAfter: hour,
      payload: {hour: hour.toISOString()},
    })
  )
}

/**
 * Gestionnaire de `billing.sync_pennylane`, sans session : synchronise, puis
 * programme l'heure suivante — un echec de Pennylane compris, il sera
 * retente. Sous `manual`, la tache se termine sans rien faire.
 */
export const runPennylaneSyncJobService = async (
  job: ScheduledJob,
  now: Date
): Promise<ScheduledJobOutcome> => {
  const result = await syncPennylaneInvoicesService(job.organizationId, now)
  if (result.status !== 'skipped') {
    await enqueueNextSync(job.organizationId, now)
  }
  return {status: 'completed'}
}

/** Les gestionnaires du planificateur que porte la synchronisation (s20). */
export const pennylaneSyncScheduledJobHandlers: ScheduledJobHandlers = {
  [BILLING_SYNC_PENNYLANE_JOB_KIND]: runPennylaneSyncJobService,
}

const requireInvoiceManager = async (organizationId: string): Promise<void> => {
  const authUser = await getAuthUser()
  if (
    !canPerformAction(authUser, organizationId, ActionIdConst.INVOICE_MANAGE)
  ) {
    throw new AuthorizationError(SYNC_DENIED)
  }
}

const parseOrganizationId = (organizationId: string): string => {
  const parsed = organizationIdSchema.safeParse(organizationId)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)
  return parsed.data
}

/**
 * Garantit la tache horaire quand l'association est sous Pennylane : appele
 * apres le passage du reglage `billing.provider` a `pennylane`. Exige
 * `member.invoice.manage` (bureau, presidence, SuperAdmin).
 */
export const schedulePennylaneSyncService = async (
  organizationId: string,
  now: Date
): Promise<void> => {
  const orgId = parseOrganizationId(organizationId)
  await requireInvoiceManager(orgId)
  if (!(await isPennylaneProvider(orgId))) return
  await enqueueNextSync(orgId, now)
}

/**
 * « Mettre a jour maintenant » (ADR 062 §8) : le bureau lance la
 * synchronisation tout de suite et garantit la tache horaire.
 */
export const requestPennylaneSyncService = async (
  organizationId: string,
  now: Date
): Promise<PennylaneSyncResult> => {
  const orgId = parseOrganizationId(organizationId)
  await requireInvoiceManager(orgId)
  const result = await syncPennylaneInvoicesService(orgId, now)
  if (result.status !== 'skipped') await enqueueNextSync(orgId, now)
  return result
}

const COUNT_KEYS = [
  'written',
  'draft',
  'creditNote',
  'noCustomer',
  'noDate',
  'notEur',
  'nonPositive',
  'unmatched',
] as const satisfies readonly (keyof BillingSyncCounts)[]

const countsOf = (stored: Record<string, number>): BillingSyncCounts =>
  Object.fromEntries(
    COUNT_KEYS.map((key) => [key, stored[key] ?? 0])
  ) as BillingSyncCounts

const errorCodeOf = (value: string | null): BillingSyncErrorCode | null =>
  BILLING_SYNC_ERROR_CODES.find((code) => code === value) ?? null

/**
 * La carte « Synchronisation Pennylane » des reglages (s20, ecran 3, critere
 * 3) : derniere mise a jour ou echec, comptes, clients sans fiche, ecarts de
 * terrain et fiches sans identifiant. Rien hors Pennylane. Exige
 * `member.invoice.manage`.
 */
export const getBillingSyncOverviewService = async (
  organizationId: string
): Promise<BillingSyncOverviewDTO | undefined> => {
  const orgId = parseOrganizationId(organizationId)
  await requireInvoiceManager(orgId)
  if (!(await isPennylaneProvider(orgId))) return undefined

  const [state, profilesWithoutId] = await withTenant(orgId, async () => [
    await getBillingSyncStateDao(orgId),
    await listProfilesWithoutPennylaneIdDao(orgId),
  ])
  return {
    lastAttemptAt: state?.lastAttemptAt?.toISOString() ?? null,
    syncedAt: state?.lastSuccessAt?.toISOString() ?? null,
    lastError: errorCodeOf(state?.lastError ?? null),
    counts: state?.lastSuccessAt ? countsOf(state.counts) : null,
    unmatchedCustomers: state?.unmatchedCustomers ?? [],
    terrainMismatches: state?.terrainMismatches ?? [],
    profilesWithoutId,
  }
}
