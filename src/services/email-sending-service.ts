import 'server-only'

import {z} from 'zod'

import {getOpenCampaignPartsDao} from '@/db/repositories/campaign-repository'
import {listPendingDeferredEmailsDao} from '@/db/repositories/deferred-email-repository'
import {getSendBudgetDao} from '@/db/repositories/email-send-budget-repository'
import {withTenant} from '@/db/tenant-scope'

import {getAssociationSettingsService} from './association-settings-service'
import {getAuthUser} from './authentication/auth-service'
import {canPerformAction} from './authorization/action-registry-authorization'
import {AuthorizationError} from './errors/authorization-error'
import {ValidationParsedZodError} from './errors/validation-error'
import {deferredDayOf} from './rules/campaign-rules'
import {
  budgetDayOf,
  groupPendingSends,
  remainingReportable,
} from './rules/email-budget-rules'
import {ActionIdConst} from './types/domain/action-registry-types'
import {
  getEmailDailySendLimit,
  getEmailLoginReserve,
} from './types/domain/association-settings-types'
import type {
  DeferredCampaignPart,
  EmailSendingOverviewDTO,
} from './types/domain/email-send-types'

const organizationIdSchema = z.string().uuid()

type OpenCampaignPart = Awaited<
  ReturnType<typeof getOpenCampaignPartsDao>
>[number]

/** Les parts entamees dont le reste attend un jour suivant (ADR 053 §5). */
const deferredCampaignPartsOf = (
  parts: readonly OpenCampaignPart[]
): DeferredCampaignPart[] =>
  parts.flatMap((part) => {
    const sendOn = deferredDayOf(part)
    if (!sendOn || part.pendingCount === 0) return []
    return [
      {
        campaignId: part.campaignId,
        campaignSubject: part.campaignSubject,
        partNumber: part.number,
        partCount: part.partCount,
        recipientCount: part.pendingCount,
        sendOn,
      },
    ]
  })

/**
 * Les envois d'emails de l'association (s52, ecran 1) : compteurs du jour de
 * Paris, limite et reserve en vigueur, envois en attente regroupes. Reserve
 * au bureau (`campaign.manage`). Donnee vivante : aucun cache. Liste blanche,
 * sans adresse ni contenu de message.
 */
export const getEmailSendingOverviewService = async (
  organizationId: string,
  now: Date
): Promise<EmailSendingOverviewDTO> => {
  const parsed = organizationIdSchema.safeParse(organizationId)
  if (!parsed.success) throw new ValidationParsedZodError(parsed.error)

  const authUser = await getAuthUser()
  if (!canPerformAction(authUser, parsed.data, ActionIdConst.CAMPAIGN_MANAGE)) {
    throw new AuthorizationError(
      "Seul le bureau de l'association peut lire ses envois d'emails"
    )
  }

  const day = budgetDayOf(now)
  const settings = await getAssociationSettingsService(parsed.data)
  const limit = getEmailDailySendLimit(settings)
  const reserve = getEmailLoginReserve(settings)
  const {counts, deferredEmails, openParts} = await withTenant(
    parsed.data,
    async () => ({
      counts: await getSendBudgetDao({organizationId: parsed.data, day}),
      deferredEmails: await listPendingDeferredEmailsDao(parsed.data),
      openParts: await getOpenCampaignPartsDao(parsed.data),
    })
  )

  const pending = groupPendingSends(
    deferredEmails,
    deferredCampaignPartsOf(openParts)
  )
  const sentToday = counts.reportableCount + counts.loginCount
  const remaining = remainingReportable(limit, reserve, counts.reportableCount)
  const sendDays = pending.map((group) => group.sendOn).sort()
  return {
    day,
    limit,
    reserve,
    sentToday,
    loginSentToday: counts.loginCount,
    remainingReportable: remaining,
    limitReached: remaining === 0,
    reserveExhausted: sentToday >= limit,
    pending,
    pendingRecipientTotal: pending.reduce(
      (total, group) => total + group.recipientCount,
      0
    ),
    nextSendOn: sendDays[0] ?? null,
  }
}
