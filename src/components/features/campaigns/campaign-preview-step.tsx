'use client'

import {AlertTriangle} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useRef, useState} from 'react'

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
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Skeleton} from '@/components/ui/skeleton'
import {addDays} from '@/services/rules/campaign-schedule-rules'
import type {
  CampaignComposerContextDTO,
  CampaignPlanDTO,
  CampaignPreviewDTO,
  CampaignTargetCountsDTO,
  SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'
import type {CampaignFormValues} from '@/services/validation/campaign-validation'

import {ComposerFrame, ProvisionalAlert} from './campaign-composer'
import {dayLabelOf} from './campaign-format'
import {sentCampaignPathOf} from './campaign-paths'

type SendFailure = 'disabled' | 'failed'

type CampaignPreviewStepProps = {
  context: CampaignComposerContextDTO
  /** `null` pendant le chargement de l'apercu (etat c). */
  preview: CampaignPreviewDTO | null
  /** Le plan d'envoi annonce (s26) ; `null` pendant le chargement. */
  plan: CampaignPlanDTO | null
  values: CampaignFormValues
  provisional: boolean
  onChangeMember: (memberProfileId: string) => void
  onEdit: () => void
  onSend: () => Promise<SendCampaignActionResult>
}

const EMAIL_FRAME_HEIGHT = 720

/**
 * L'apercu avant l'envoi (ecran 3 du design s25, ecran 1 de s26) : le rendu
 * final avec un membre joignable reel (critere 5), le decompte et le plan
 * d'envoi, puis la confirmation par `alert-dialog`, qui repete le plan. Un
 * envoi en cours ne se relance pas : un second clic n'appelle pas l'action
 * une seconde fois.
 */
export function CampaignPreviewStep({
  context,
  preview,
  plan,
  values,
  provisional,
  onChangeMember,
  onEdit,
  onSend,
}: CampaignPreviewStepProps) {
  const t = useTranslations('CampaignsBureau.preview')
  const router = useRouter()
  const selectId = useId()
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<SendFailure | null>(null)
  const sendingRef = useRef(false)

  const counts = preview?.counts ?? context.counts

  const send = async () => {
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setFailure(null)

    const result = await onSend()
    if (result.status === 'created') {
      router.push(sentCampaignPathOf(result.campaignId))
      return
    }
    sendingRef.current = false
    setSending(false)
    if (result.status === 'delivery_disabled') setFailure('disabled')
    if (result.status === 'error') setFailure('failed')
  }

  return (
    <ComposerFrame preview>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>

      {failure && <SendFailureAlert failure={failure} />}
      {plan && isPostponed(plan) && <PostponedAlert plan={plan} />}

      {preview ? (
        <div className="flex flex-col gap-3">
          <p className="text-[17px]">
            {t('identity', {name: preview.member.name})}
          </p>
          {context.reachableMembers.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={selectId} className="text-[17px]">
                {t('otherMember')}
              </Label>
              <Select value={preview.member.id} onValueChange={onChangeMember}>
                <SelectTrigger
                  id={selectId}
                  aria-label={t('otherMember')}
                  className="h-14 w-full text-[17px] sm:h-11 sm:max-w-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {context.reachableMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-muted-foreground text-[15px]">
            {t('nothingSent')}
          </p>
        </div>
      ) : (
        <Skeleton className="h-6 w-80" />
      )}

      {provisional && <ProvisionalAlert />}

      <Card className="gap-3 px-0 py-0 shadow-none sm:px-6 sm:py-6">
        {preview ? (
          <>
            <div className="flex flex-col gap-1 px-4 pt-4 sm:px-0 sm:pt-0">
              <p className="text-[17px] font-semibold">
                {t('subjectLine', {subject: preview.subject})}
              </p>
              {preview.preheader && (
                <p className="text-muted-foreground text-[15px]">
                  {preview.preheader}
                </p>
              )}
            </div>
            <iframe
              title={t('frameTitle')}
              srcDoc={preview.html}
              sandbox=""
              height={EMAIL_FRAME_HEIGHT}
              className="border-border mx-auto w-full max-w-[600px] border"
            />
          </>
        ) : (
          <Skeleton className="mx-auto h-[720px] w-full max-w-[600px]" />
        )}
      </Card>

      <PlanSection counts={counts} plan={plan} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="h-14 w-full sm:h-11 sm:w-auto"
          disabled={!preview || sending}
          onClick={() => setConfirming(true)}
        >
          {t('send', {count: counts.recipients})}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
          disabled={sending}
          onClick={onEdit}
        >
          {t('edit')}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-[17px]">
              <ConfirmDescription
                count={counts.recipients}
                subject={preview?.subject ?? values.subject}
                plan={plan}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-14 sm:h-11">
              {t('confirmBack')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 h-14 text-white sm:h-11"
              disabled={sending}
              onClick={() => void send()}
            >
              {t('send', {count: counts.recipients})}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ComposerFrame>
  )
}

function SendFailureAlert({failure}: {failure: SendFailure}) {
  const t = useTranslations('CampaignsBureau.preview')

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle className="text-[17px] whitespace-normal">
        {t(`${failure}Title`)}
      </AlertTitle>
      <AlertDescription className="text-[15px]">
        {t(`${failure}Description`)}
      </AlertDescription>
    </Alert>
  )
}

const data = (chunks: ReactNode) => (
  <span className="font-mono text-[16px] tabular-nums">{chunks}</span>
)
const strong = (chunks: ReactNode) => (
  <strong className="font-semibold">{chunks}</strong>
)

const isSinglePartToday = (plan: CampaignPlanDTO): boolean =>
  plan.parts.length === 1 && plan.parts[0].day === plan.today

/** La premiere part ne part pas aujourd'hui : le plafond du jour est atteint. */
const isPostponed = (plan: CampaignPlanDTO): boolean =>
  plan.parts.length > 0 && plan.parts[0].day !== plan.today

const startOf = (plan: CampaignPlanDTO): 'today' | 'tomorrow' | 'other' => {
  const first = plan.parts[0]?.day
  if (first === plan.today) return 'today'
  return first === addDays(plan.today, 1) ? 'tomorrow' : 'other'
}

/** Le plafond du jour est atteint : la campagne partira, mais pas aujourd'hui (1d). */
function PostponedAlert({plan}: {plan: CampaignPlanDTO}) {
  const t = useTranslations('CampaignsBureau.preview.plan')

  return (
    <Alert className="border-warning-border bg-warning text-warning-foreground border [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-[17px]">
        <p>
          {t.rich('full', {
            strong,
            data,
            tomorrow: String(startOf(plan) === 'tomorrow'),
            date: dayLabelOf(plan.parts[0].day),
          })}
        </p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * « Destinataires et plan d'envoi » (ecran 1 de s26) : le decompte, le
 * deja-parti du jour, puis l'envoi unique ou le plan ecrit, une ligne par
 * part, nombres et dates en `data`.
 */
function PlanSection({
  counts,
  plan,
}: {
  counts: CampaignTargetCountsDTO
  plan: CampaignPlanDTO | null
}) {
  const t = useTranslations('CampaignsBureau.preview.plan')
  const started =
    plan !== null && plan.allottedToday > 0 && plan.parts[0]?.day === plan.today

  return (
    <section
      aria-label={t('label')}
      className="border-border flex flex-col gap-3 border-t pt-6 text-[17px]"
    >
      <p>
        {t.rich('recall', {
          strong,
          recipients: counts.recipients,
          withoutEmail: counts.withoutEmail,
          unsubscribed: counts.unsubscribed,
        })}
      </p>
      {plan === null ? (
        <Skeleton className="h-6 w-72" />
      ) : (
        <>
          {started && (
            <p>
              {t.rich('alreadySent', {
                data,
                allotted: plan.allottedToday,
                left: plan.parts[0].count,
              })}
            </p>
          )}
          {isSinglePartToday(plan) ? (
            <p>{t.rich('single', {strong})}</p>
          ) : (
            <WrittenPlan plan={plan} />
          )}
        </>
      )}
    </section>
  )
}

function WrittenPlan({plan}: {plan: CampaignPlanDTO}) {
  const t = useTranslations('CampaignsBureau.preview.plan')

  return (
    <div className="flex flex-col gap-2">
      <p>
        {t.rich('title', {
          strong,
          days: plan.parts.length,
          start: startOf(plan),
          date: dayLabelOf(plan.parts[0].day),
        })}
      </p>
      <ul className="border-border flex flex-col gap-1 border-l-2 pl-4">
        {plan.parts.map((part) => (
          <li key={part.day} className="flex flex-wrap items-baseline gap-2">
            {t.rich('item', {
              data,
              count: part.count,
              date: dayLabelOf(part.day),
            })}
          </li>
        ))}
      </ul>
      <p>{t('nothingToDo')}</p>
    </div>
  )
}

const RELATIVE_DAY_KEYS = ['today', 'tomorrow', 'afterTomorrow'] as const

/**
 * Les parts dites en mots (« aujourd'hui, demain, apres-demain ») tant que le
 * plan tient en trois jours consecutifs a partir d'aujourd'hui ; en dates
 * `jj/mm/aaaa` au-dela, ou quand la premiere part est reportee.
 */
const relativeKeysOf = (plan: CampaignPlanDTO) =>
  plan.parts.length <= RELATIVE_DAY_KEYS.length &&
  plan.parts.every((part, index) => part.day === addDays(plan.today, index))
    ? RELATIVE_DAY_KEYS
    : null

function ConfirmDescription({
  count,
  subject,
  plan,
}: {
  count: number
  subject: string
  plan: CampaignPlanDTO | null
}) {
  const t = useTranslations('CampaignsBureau.preview')

  if (!plan || isSinglePartToday(plan)) {
    return <>{t('confirmDescription', {count, subject})}</>
  }
  const relative = relativeKeysOf(plan)
  const parts = plan.parts.map((part, index) =>
    relative
      ? t(`confirmPart.${relative[index]}`, {count: part.count})
      : t('confirmPart.day', {count: part.count, date: dayLabelOf(part.day)})
  )
  return (
    <>
      {t('confirmPlanDescription', {
        count,
        subject,
        days: plan.parts.length,
        plan: parts.join(', '),
      })}
    </>
  )
}
