'use client'

import {AlertTriangle, CircleCheck, Info, Send} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {type ReactNode, useRef, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {addDays} from '@/services/rules/campaign-schedule-rules'
import type {CampaignPlanDTO} from '@/services/types/domain/campaign-types'
import type {
  LaunchMemberInvitationsActionResult,
  MemberInvitationLaunchCountsDTO,
  MemberInvitationReminderCountsDTO,
  MemberInvitationSendingDTO,
  RemindNeverSignedInActionResult,
} from '@/services/types/domain/member-invitation-campaign-types'

import {settingsSectionPathOf} from '../association/association-settings-paths'
import {dayLabelOf} from '../campaigns/campaign-format'
import {
  campaignLettersCardPathOf,
  campaignPathOf,
} from '../campaigns/campaign-paths'
import {
  CampaignStateBadge,
  PartStateBadge,
} from '../campaigns/campaign-state-badges'

export type LaunchMemberInvitationsAction =
  () => Promise<LaunchMemberInvitationsActionResult>
export type RemindNeverSignedInAction = (
  submissionId: string
) => Promise<RemindNeverSignedInActionResult>

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

const linkClass = 'text-link inline-flex min-h-11 items-center underline'

function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[20px] leading-snug font-semibold">
      {children}
    </h2>
  )
}

/** Un decompte d'une cible (§3.14) : paires terme / valeur. */
export function CountList({
  rows,
  testId,
}: {
  rows: [string, number][]
  testId?: string
}) {
  return (
    <dl data-testid={testId} className="flex flex-col gap-2 text-[17px]">
      {rows.map(([term, value]) => (
        <div key={term} className="flex flex-row justify-between gap-4">
          <dt>{term}</dt>
          <dd className="font-mono font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Une annonce neutre (`muted`, §3.13) : jamais une erreur. */
function MutedAlert({
  children,
  icon = false,
}: {
  children: ReactNode
  icon?: boolean
}) {
  return (
    <Alert role="note" className="bg-muted [&>svg]:size-5">
      {icon && <Info aria-hidden="true" />}
      <AlertDescription className="text-foreground text-[17px]">
        {children}
      </AlertDescription>
    </Alert>
  )
}

function WarningAlert({title, children}: {title: string; children: string}) {
  return (
    <Alert
      role="note"
      className="border-warning-border bg-warning text-warning-foreground [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">{title}</AlertTitle>
      <AlertDescription className="text-warning-foreground text-[17px]">
        <p>{children}</p>
      </AlertDescription>
    </Alert>
  )
}

function FailureAlert({title, children}: {title: string; children: string}) {
  return (
    <Alert
      variant="destructive"
      role="alert"
      className="border-2 [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">{title}</AlertTitle>
      <AlertDescription className="text-[15px]">
        <p>{children}</p>
      </AlertDescription>
    </Alert>
  )
}

function SentAlert({title, children}: {title: string; children: string}) {
  return (
    <Alert role="status" className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">{title}</AlertTitle>
      <AlertDescription className="text-foreground text-[17px]">
        <p>{children}</p>
      </AlertDescription>
    </Alert>
  )
}

/** Le plan ecrit (§3.13) : une ligne par jour, ou une seule fois aujourd'hui. */
function PlanList({plan}: {plan: CampaignPlanDTO}) {
  const t = useTranslations('MemberInvitationsBureau.plan')
  const dayOf = (day: string) => {
    if (day === plan.today) return t('today')
    if (day === addDays(plan.today, 1)) return t('tomorrow')
    return t('on', {date: dayLabelOf(day)})
  }
  return (
    <ul className="list-disc pl-6">
      {plan.parts.map((part) => (
        <li key={part.day}>
          {t('part', {count: part.count, day: dayOf(part.day)})}
        </li>
      ))}
    </ul>
  )
}

function SendButton({
  label,
  pendingLabel,
  pending,
  onClick,
}: {
  label: string
  pendingLabel: string
  pending: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      className="h-14 w-full sm:h-12 sm:w-auto"
      disabled={pending}
      onClick={onClick}
    >
      <Send aria-hidden="true" className="size-5" />
      {pending ? pendingLabel : label}
    </Button>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  submit,
  back,
  pending,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submit: string
  back: string
  pending: boolean
  onConfirm: () => void
  children: ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-foreground flex flex-col gap-3 text-[17px]">
              {children}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-14 sm:h-11">{back}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 h-14 text-white sm:h-11"
            disabled={pending}
            onClick={onConfirm}
          >
            {submit}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Un envoi en un seul geste, protege d'un double clic : la confirmation, puis
 * l'action, une fois ; la page se relit apres une creation.
 */
function useSending<Result extends {status: string}>(
  send: () => Promise<Result>
) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const sendingRef = useRef(false)

  const confirm = async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    setPending(true)
    setConfirming(false)
    const outcome = await send()
    setResult(outcome)
    setPending(false)
    sendingRef.current = false
    if (outcome.status === 'created') router.refresh()
  }
  return {confirming, setConfirming, pending, result, confirm}
}

/** La ligne d'un envoi du systeme (plan ecrit, s29) : titre, etat, liens. */
function SendingLine({
  sending,
  title,
  meta,
}: {
  sending: MemberInvitationSendingDTO
  title: string
  meta: string
}) {
  const t = useTranslations('MemberInvitationsBureau.launch')
  const {campaign} = sending
  const deferred = campaign.parts.find((part) => part.deferredUntil)

  return (
    <li className="border-border flex flex-col gap-1 border-l-2 pl-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[17px] font-semibold">{title}</span>
        {deferred?.deferredUntil ? (
          <PartStateBadge state="scheduled" day={deferred.deferredUntil} />
        ) : (
          <CampaignStateBadge state={campaign.displayState} />
        )}
      </div>
      <p className="text-muted-foreground font-mono text-[15px] tabular-nums">
        {meta}
      </p>
      <div className="flex flex-wrap gap-x-4">
        <Link href={campaignPathOf(campaign.id)} className={linkClass}>
          {t('viewSend')}
        </Link>
        {campaign.withoutEmailCount > 0 && (
          <Link
            href={campaignLettersCardPathOf(campaign.id)}
            className={linkClass}
          >
            {t('letters', {count: campaign.withoutEmailCount})}
          </Link>
        )}
      </div>
    </li>
  )
}

function LaunchLine({launch}: {launch: MemberInvitationSendingDTO}) {
  const t = useTranslations('MemberInvitationsBureau.launch')
  const {campaign} = launch
  const deferred = campaign.parts.find((part) => part.deferredUntil)
  const author = campaign.authorName ?? t('unknownAuthor')
  const meta = launch.inProgress
    ? t('lineMeta', {
        received: campaign.recipientCounts.received,
        recipients: campaign.recipientCount,
        letters: campaign.withoutEmailCount,
        author,
      })
    : t('lineMetaDone', {
        recipients: campaign.recipientCount,
        letters: campaign.withoutEmailCount,
        author,
      })

  return (
    <>
      {deferred?.deferredUntil && (
        <MutedAlert>
          <p>
            {t.rich('deferred', {
              strong,
              count: deferred.deferredCount,
              date: dayLabelOf(deferred.deferredUntil),
            })}
          </p>
        </MutedAlert>
      )}
      <ul className="flex flex-col gap-4">
        <SendingLine
          sending={launch}
          title={t('line', {date: dayLabelOf(campaign.sendDate)})}
          meta={meta}
        />
      </ul>
    </>
  )
}

function LaunchOutcome({
  result,
}: {
  result: LaunchMemberInvitationsActionResult | null
}) {
  const t = useTranslations('MemberInvitationsBureau')
  if (!result) return null

  switch (result.status) {
    case 'created':
      return (
        <SentAlert title={t('launch.sent.title')}>
          {t('launch.sent.description')}
        </SentAlert>
      )
    case 'already_launched':
      return (
        <MutedAlert icon>
          <p>
            {t.rich('refusals.alreadyLaunched', {
              strong,
              date: dayLabelOf(result.sendDate),
              author: result.authorName ?? t('launch.unknownAuthor'),
            })}
          </p>
          <Link href={campaignPathOf(result.campaignId)} className={linkClass}>
            {t('launch.viewSend')}
          </Link>
        </MutedAlert>
      )
    case 'no_site_address':
      return (
        <WarningAlert title={t('refusals.noSiteAddressTitle')}>
          {t('refusals.noSiteAddress')}
        </WarningAlert>
      )
    case 'delivery_disabled':
      return (
        <WarningAlert title={t('refusals.deliveryDisabledTitle')}>
          {t('refusals.deliveryDisabled')}
        </WarningAlert>
      )
    case 'nobody':
      return <MutedAlert>{t('refusals.nobody')}</MutedAlert>
    case 'error':
      return (
        <FailureAlert title={t('failure.launchTitle')}>
          {t('failure.launch')}
        </FailureAlert>
      )
  }
}

/**
 * La carte « Lancement » (ecran 1) : avant, le decompte et le seul bouton de
 * la page ; apres, la ligne du lancement, pour toujours (Q7).
 */
export function LaunchCard({
  launch,
  counts,
  plan,
  linkDays,
  launchAction,
}: {
  launch: MemberInvitationSendingDTO | null
  counts: MemberInvitationLaunchCountsDTO
  plan: CampaignPlanDTO
  linkDays: number
  launchAction: LaunchMemberInvitationsAction
}) {
  const t = useTranslations('MemberInvitationsBureau.launch')
  const sending = useSending(launchAction)
  const statutory = counts.nature === 'statutaire'

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <LaunchOutcome result={sending.result} />
      {launch ? (
        <LaunchLine launch={launch} />
      ) : (
        <>
          <p className="text-[17px]">{t('usage')}</p>
          <h3 className="text-[17px] font-semibold">{t('profilesTitle')}</h3>
          <CountList
            rows={[
              [t('counts.profilesWithEmail'), counts.profilesWithEmail],
              [t('counts.profilesByLetter'), counts.profilesByLetter],
              ...(statutory
                ? []
                : [
                    [t('counts.profilesRefused'), counts.profilesRefused] as [
                      string,
                      number,
                    ],
                  ]),
              [t('counts.profiles'), counts.profiles],
            ]}
          />
          <h3 className="text-[17px] font-semibold">{t('addressesTitle')}</h3>
          <CountList
            rows={[
              [t('counts.recipients'), counts.recipients],
              [
                t(statutory ? 'counts.reinstated' : 'counts.unsubscribed'),
                counts.unsubscribed,
              ],
              [t('counts.pending'), counts.pendingAddresses],
            ]}
          />
          <p className="text-muted-foreground text-[15px]">{t('countsNote')}</p>
          <div>
            <SendButton
              label={t('action')}
              pendingLabel={t('pending')}
              pending={sending.pending}
              onClick={() => sending.setConfirming(true)}
            />
          </div>
          <p className="text-muted-foreground text-[15px]">
            {t('settingsNote')}{' '}
            <Link
              href={settingsSectionPathOf('invitation')}
              className="text-link underline"
            >
              {t('settingsLink')}
            </Link>
          </p>
          <ConfirmDialog
            open={sending.confirming}
            onOpenChange={sending.setConfirming}
            title={t('confirm.title')}
            submit={t('confirm.submit')}
            back={t('confirm.back')}
            pending={sending.pending}
            onConfirm={() => void sending.confirm()}
          >
            <p>
              {t.rich('confirm.counts', {
                strong,
                email: counts.profilesWithEmail,
                recipients: counts.recipients,
                letters: counts.profilesByLetter,
              })}
            </p>
            {plan.parts.length > 1 ? (
              <div>
                <p>{t('confirm.planMany', {days: plan.parts.length})}</p>
                <PlanList plan={plan} />
              </div>
            ) : (
              <p>{t('confirm.planOne')}</p>
            )}
            {counts.profilesByLetter > 0 && (
              <p>{t('confirm.letters', {count: counts.profilesByLetter})}</p>
            )}
            <p>{t('confirm.linkDays', {days: linkDays})}</p>
            <p className="text-muted-foreground text-[15px]">
              {t('confirm.irreversible')}
            </p>
          </ConfirmDialog>
        </>
      )}
    </Card>
  )
}

function ReminderOutcome({
  result,
}: {
  result: RemindNeverSignedInActionResult | null
}) {
  const t = useTranslations('MemberInvitationsBureau')
  if (!result) return null

  switch (result.status) {
    case 'created':
      return (
        <SentAlert title={t('reminder.sent.title')}>
          {t('reminder.sent.description')}
        </SentAlert>
      )
    case 'in_progress':
      return <MutedAlert icon>{t('refusals.inProgress')}</MutedAlert>
    case 'not_launched':
      return <MutedAlert icon>{t('refusals.notLaunched')}</MutedAlert>
    case 'nobody':
      return <MutedAlert>{t('refusals.nobody')}</MutedAlert>
    case 'no_site_address':
      return (
        <WarningAlert title={t('refusals.noSiteAddressTitle')}>
          {t('refusals.noSiteAddress')}
        </WarningAlert>
      )
    case 'delivery_disabled':
      return (
        <WarningAlert title={t('refusals.deliveryDisabledTitle')}>
          {t('refusals.deliveryDisabled')}
        </WarningAlert>
      )
    case 'error':
      return (
        <FailureAlert title={t('failure.reminderTitle')}>
          {t('failure.reminder')}
        </FailureAlert>
      )
  }
}

/**
 * L'action de la relance : le bouton, ou a sa place une phrase tant qu'un
 * envoi reste a partir (1g, deux liens ne concourent jamais), ou l'annonce
 * qu'il n'y a personne a relancer (1h).
 */
function ReminderAction({
  launchInProgress,
  reminderInProgress,
  nobody,
  pending,
  onSend,
}: {
  launchInProgress: boolean
  reminderInProgress: boolean
  nobody: boolean
  pending: boolean
  onSend: () => void
}) {
  const t = useTranslations('MemberInvitationsBureau')

  if (launchInProgress || reminderInProgress) {
    return (
      <p className="text-muted-foreground text-[17px]">
        {launchInProgress ? t('launch.inProgress') : t('reminder.inProgress')}
      </p>
    )
  }
  if (nobody) {
    return (
      <MutedAlert>
        <p>{t('reminder.nobody')}</p>
      </MutedAlert>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div>
        <SendButton
          label={t('reminder.action')}
          pendingLabel={t('reminder.pending')}
          pending={pending}
          onClick={onSend}
        />
      </div>
      <p className="text-muted-foreground text-[15px]">{t('reminder.note')}</p>
    </div>
  )
}

/**
 * La carte « Relancer les jamais connectes » (ecran 1, apres le lancement) :
 * le decompte, les relances deja faites, puis le bouton ; tant qu'un envoi
 * reste a partir, une phrase a sa place (1g).
 */
export function ReminderCard({
  launch,
  reminders,
  counts,
  plan,
  remindAction,
}: {
  launch: MemberInvitationSendingDTO
  reminders: MemberInvitationSendingDTO[]
  counts: MemberInvitationReminderCountsDTO
  plan: CampaignPlanDTO
  remindAction: RemindNeverSignedInAction
}) {
  const t = useTranslations('MemberInvitationsBureau.reminder')
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const sending = useSending(async () => {
    const result = await remindAction(submissionId)
    if (result.status === 'created') setSubmissionId(crypto.randomUUID())
    return result
  })
  const statutory = counts.nature === 'statutaire'
  const reminderInProgress = reminders.some((reminder) => reminder.inProgress)

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <ReminderOutcome result={sending.result} />
      <p className="text-[17px]">{t('usage')}</p>
      <CountList
        rows={[
          [t('counts.recipients'), counts.recipients],
          [t('counts.neverInvited'), counts.neverInvited],
          [
            t(statutory ? 'counts.reinstated' : 'counts.unsubscribed'),
            counts.unsubscribed,
          ],
          [t('counts.pending'), counts.pendingAddresses],
        ]}
      />
      {reminders.length > 0 && (
        <ul className="flex flex-col gap-4">
          {reminders.map((reminder) => (
            <SendingLine
              key={reminder.campaign.id}
              sending={reminder}
              title={t('line', {date: dayLabelOf(reminder.campaign.sendDate)})}
              meta={t('lineMeta', {
                recipients: reminder.campaign.recipientCount,
              })}
            />
          ))}
        </ul>
      )}
      <ReminderAction
        launchInProgress={launch.inProgress}
        reminderInProgress={reminderInProgress}
        nobody={counts.recipients === 0}
        pending={sending.pending}
        onSend={() => sending.setConfirming(true)}
      />
      <ConfirmDialog
        open={sending.confirming}
        onOpenChange={sending.setConfirming}
        title={t('confirm.title', {count: counts.recipients})}
        submit={t('confirm.submit')}
        back={t('confirm.back')}
        pending={sending.pending}
        onConfirm={() => void sending.confirm()}
      >
        {plan.parts.length > 1 ? (
          <div>
            <p>{t('confirm.planMany', {days: plan.parts.length})}</p>
            <PlanList plan={plan} />
          </div>
        ) : (
          <p>{t('confirm.planOne')}</p>
        )}
        <p className="text-muted-foreground text-[15px]">
          {t('confirm.superseded')}
        </p>
      </ConfirmDialog>
    </Card>
  )
}
