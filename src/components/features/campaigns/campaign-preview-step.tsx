'use client'

import {AlertTriangle} from 'lucide-react'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useId, useRef, useState} from 'react'

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
import type {
  CampaignComposerContextDTO,
  CampaignPreviewDTO,
  SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'
import type {CampaignFormValues} from '@/services/validation/campaign-validation'

import {ComposerFrame, ProvisionalAlert} from './campaign-composer'
import {sentCampaignPathOf} from './campaign-paths'

type SendFailure = 'disabled' | 'failed'

type CampaignPreviewStepProps = {
  context: CampaignComposerContextDTO
  /** `null` pendant le chargement de l'apercu (etat c). */
  preview: CampaignPreviewDTO | null
  values: CampaignFormValues
  provisional: boolean
  onChangeMember: (memberProfileId: string) => void
  onEdit: () => void
  onSend: () => Promise<SendCampaignActionResult>
}

const EMAIL_FRAME_HEIGHT = 720

/**
 * L'apercu avant l'envoi (ecran 3 du design s25) : le rendu final avec un
 * membre joignable reel (critere 5), le rappel du decompte, puis la
 * confirmation par `alert-dialog`. Un envoi en cours ne se relance pas : un
 * second clic n'appelle pas l'action une seconde fois.
 */
export function CampaignPreviewStep({
  context,
  preview,
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

      <p className="text-[17px]">
        {t('recall', {
          recipients: counts.recipients,
          withoutEmail: counts.withoutEmail,
          unsubscribed: counts.unsubscribed,
        })}
      </p>

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
              {t('confirmDescription', {
                count: counts.recipients,
                subject: preview?.subject ?? values.subject,
              })}
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
