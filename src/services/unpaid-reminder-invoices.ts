import 'server-only'

import {createTranslator} from 'next-intl'

import {listUnpaidRemindersDao} from '@/db/repositories/unpaid-reminder-repository'
import {withTenant} from '@/db/tenant-scope'
import {PRODUCT_LOCALE, type SupportedLocale} from '@/lib/helper/locale-helper'

import fr from '../../messages/fr.json'
import {resolveMemberBillingProvider} from './billing/resolve-member-billing-provider'
import {
  composeInvoiceSubject,
  getInvoiceStatusClassification,
  getInvoiceSubjectTemplate,
  isUnpaidInvoice,
} from './rules/member-invoice-rules'
import {
  formatUnpaidInvoicesList,
  type UnpaidInvoiceLineValues,
} from './rules/unpaid-reminder-rules'
import type {ResolvedAssociationSettings} from './types/domain/association-settings-types'
import {UNPAID_REMINDER_SEND_KIND} from './types/domain/campaign-types'

/**
 * Les factures d'une relance d'impaye relues au moment ou elle part (s29,
 * ADR 070 §3, §9) : a l'envoi d'une part comme a la generation de son
 * courrier. Fonctions internes des services de campagne, sans facade ni
 * controle d'acces : l'appelant a deja tranche.
 */

const LIST_NAMESPACE = 'UnpaidReminders.invoiceList'

/** Les messages de chaque locale du produit (ADR 008 : `fr` seule). */
const MESSAGES: Record<SupportedLocale, typeof fr> = {fr}

/**
 * La valeur de `{factures}` pour des fiches donnees : la liste Markdown de
 * leurs factures impayees de l'echeance, ou `null` si elles n'en ont plus
 * (la relance ne doit pas leur partir).
 */
export type ReminderInvoicesOf = (
  memberProfileIds: readonly string[]
) => string | null

/** L'echeance du rang que porte cette campagne, ou rien. A appeler sous `withTenant`. */
const reminderDueOnOf = async (
  organizationId: string,
  campaignId: string
): Promise<string | null> =>
  (await listUnpaidRemindersDao(organizationId)).find(
    (row) => row.campaignId === campaignId
  )?.dueOn ?? null

/**
 * Relit les factures des fiches d'une campagne de relance, par le
 * fournisseur actif. Rend `null` pour une campagne qui n'est pas une
 * relance. Une erreur de lecture remonte : rien ne part sur des factures
 * illisibles. Les lignes sont traduites par `createTranslator`, sans
 * requete : le planificateur (script de la minuterie, ADR 052) livre les
 * relances hors de Next, ou `next-intl/server` leve.
 */
export const readReminderInvoices = async (
  organizationId: string,
  campaign: {id: string; templateId: string | null},
  settings: ResolvedAssociationSettings,
  memberProfileIds: readonly string[]
): Promise<ReminderInvoicesOf | null> => {
  if (campaign.templateId !== UNPAID_REMINDER_SEND_KIND) return null
  const dueOn = await withTenant(organizationId, () =>
    reminderDueOnOf(organizationId, campaign.id)
  )
  const classification = getInvoiceStatusClassification(settings)
  const invoices = dueOn
    ? (
        await resolveMemberBillingProvider(settings).listInvoicesOf(
          organizationId,
          [...new Set(memberProfileIds)]
        )
      ).filter(
        (invoice) =>
          invoice.dueOn === dueOn &&
          isUnpaidInvoice(invoice.status, classification)
      )
    : []
  const subjectTemplate = getInvoiceSubjectTemplate(settings)
  const t = createTranslator({
    locale: PRODUCT_LOCALE,
    messages: MESSAGES[PRODUCT_LOCALE],
    namespace: LIST_NAMESPACE,
  })
  const lineOf = ({parcelNumber, ...values}: UnpaidInvoiceLineValues) =>
    parcelNumber
      ? t('line', {...values, parcelNumber})
      : t('lineWithoutParcel', values)

  return (profileIds) => {
    const own = invoices.filter((invoice) =>
      profileIds.includes(invoice.memberProfileId)
    )
    if (own.length === 0) return null
    return formatUnpaidInvoicesList(
      own.map((invoice) => ({
        subject: composeInvoiceSubject(subjectTemplate, invoice.year),
        parcelNumber: invoice.parcelNumber,
        amountCents: invoice.amountCents,
        dueOn: invoice.dueOn,
      })),
      lineOf
    )
  }
}
