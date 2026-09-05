'use client'

import {Trash2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'
import {toast} from 'sonner'

import {deleteAdminMemberInvitationAction} from '@/app/[locale]/admin/organizations/actions'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function CancelAdminInvitationButton({
  organizationId,
  invitationId,
  userEmail,
}: {
  organizationId: string
  invitationId: string
  userEmail: string
}) {
  const t = useTranslations('AdminOrganizations')
  const tCommon = useTranslations('Common')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    startTransition(async () => {
      const res = await deleteAdminMemberInvitationAction(
        organizationId,
        invitationId
      )
      if (res.success) {
        toast.success(t('invitationCanceled'))
        setOpen(false)
      } else {
        toast.error(res.message || t('cancelError'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
        </DialogHeader>
        <p>{t('cancelInvitationConfirm', {email: userEmail})}</p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? t('canceling') : t('cancelInvitation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
