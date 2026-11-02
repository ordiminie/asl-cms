'use client'

import {CircleAlert, UserRoundCog} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useId, useState, useTransition} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {reloadPageAt} from '@/lib/helper/page-navigation.client'
import {
  IMPERSONATION_REASON_MAX_LENGTH,
  OpenImpersonationInput,
} from '@/services/types/domain/impersonation-types'

type ImpersonationActionResult =
  {success: true; url: string} | {success: false; message: string}

type ImpersonationDialogProps = {
  organizationId: string
  userId: string
  name: string
  roleLabel: string
  organizationName: string
  durationMinutes: number
  /** L'hote courant n'est pas celui de l'association : on y renvoie (D9). */
  otherDomain?: {domain: string; url: string}
  action: (input: OpenImpersonationInput) => Promise<ImpersonationActionResult>
}

const MOBILE_SHEET =
  'max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none'
const FOOTER_BUTTON = 'h-14 text-base sm:h-12'

/**
 * Confirmer l'ouverture d'une session a la place d'un compte (s48, ecran 2).
 * Un seul champ, le motif facultatif. « Annuler » ecrit, pas de croix ; sous
 * 640 px la boite est ancree en bas, boutons de 56 px empiles, le principal en
 * premier (§3.11). L'ouverture recharge la page entiere (D10).
 */
export function ImpersonationDialog({
  organizationId,
  userId,
  name,
  roleLabel,
  organizationName,
  durationMinutes,
  otherDomain,
  action,
}: ImpersonationDialogProps) {
  const t = useTranslations('Impersonation')
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await action({organizationId, userId, reason})
      if (result.success) {
        reloadPageAt(result.url)
        return
      }
      setError(result.message)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="max-sm:h-14 max-sm:w-full">
          <UserRoundCog className="size-5" aria-hidden="true" />
          {t('table.act')}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={MOBILE_SHEET}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {t('dialog.title', {name})}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive" className="[&>svg]:size-5">
              <CircleAlert aria-hidden="true" />
              <AlertDescription className="text-foreground text-base">
                {error}
              </AlertDescription>
            </Alert>
          )}
          <p className="text-base">
            {t('dialog.intro', {
              name,
              role: roleLabel,
              association: organizationName,
            })}
          </p>
          {otherDomain && (
            <p className="bg-muted rounded-md px-4 py-3 text-base">
              {t.rich('dialog.otherDomain', {
                association: organizationName,
                domain: otherDomain.domain,
                mono: (chunks) => (
                  <span className="font-mono text-[15px]">{chunks}</span>
                ),
              })}
            </p>
          )}
          <p className="text-base">
            {t('dialog.duration', {minutes: durationMinutes})}
          </p>
          {!otherDomain && (
            <div className="flex flex-col gap-2">
              <Label htmlFor={reasonId} className="text-base font-medium">
                {t('dialog.reason')}
                <span className="text-muted-foreground font-normal">
                  {t('dialog.optional')}
                </span>
              </Label>
              <Input
                id={reasonId}
                value={reason}
                maxLength={IMPERSONATION_REASON_MAX_LENGTH}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className={FOOTER_BUTTON}
              onClick={() => setOpen(false)}
            >
              {t('dialog.cancel')}
            </Button>
            {otherDomain ? (
              <Button asChild className={FOOTER_BUTTON}>
                <a href={otherDomain.url}>
                  {t('dialog.openSite', {association: organizationName})}
                </a>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isPending}
                className={`${FOOTER_BUTTON} disabled:opacity-60`}
              >
                {isPending ? t('dialog.sending') : t('dialog.submit', {name})}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
