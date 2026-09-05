'use client'

import {format} from 'date-fns'
import {CheckCircle, Mail, MessageSquare, Phone} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {ReactNode, useEffect, useState} from 'react'

import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {getDateFnsLocale} from '@/lib/helper/date-helper'
import {UserSubmissionWithUser} from '@/services/types/domain/user-submission-types'

interface SubmissionDetailDialogProps {
  submission: UserSubmissionWithUser
  onMarkAsRead?: (id: string) => void
  children: ReactNode
}

const typeIcons = {
  contact: Mail,
  feedback: MessageSquare,
  support: Phone,
}

export function SubmissionDetailDialog({
  submission,
  onMarkAsRead,
  children,
}: SubmissionDetailDialogProps) {
  const t = useTranslations('AdminSubmissions')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const TypeIcon = typeIcons[submission.type]

  useEffect(() => {
    if (open && !submission.read && onMarkAsRead) {
      onMarkAsRead(submission.id)
    }
  }, [open, submission.read, submission.id, onMarkAsRead])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <TypeIcon className="text-muted-foreground h-5 w-5" />
            <Badge variant="outline">{t(`types.${submission.type}`)}</Badge>
            <Badge variant={submission.read ? 'secondary' : 'default'}>
              {submission.read ? t('read') : t('unread')}
            </Badge>
          </div>
          <DialogTitle className="mt-2 text-xl">
            {submission.subject}
          </DialogTitle>
          <DialogDescription>
            Soumis le{' '}
            {format(new Date(submission.createdAt), 'PPP à HH:mm', {
              locale: getDateFnsLocale(locale),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Avatar className="size-10">
              <AvatarImage
                src={submission.user?.image || ''}
                alt={submission.user?.name || t('anonymous')}
              />
              <AvatarFallback>
                {submission.user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('') || 'A'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">
                {submission.user?.name || t('anonymous')}
              </div>
              <div className="text-muted-foreground text-sm">
                {submission.user?.email || submission.email || t('noEmail')}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="mb-2 text-sm font-medium">{t('message')}</h4>
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              {submission.message}
            </p>
          </div>

          {submission.metadata &&
            Object.keys(submission.metadata).length > 0 && (
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 text-sm font-medium">{t('metadata')}</h4>
                <pre className="text-muted-foreground overflow-auto text-xs">
                  {JSON.stringify(submission.metadata, null, 2)}
                </pre>
              </div>
            )}

          <div className="flex justify-end gap-2">
            {!submission.read && onMarkAsRead && (
              <Button
                variant="outline"
                onClick={() => {
                  onMarkAsRead(submission.id)
                  setOpen(false)
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Marquer comme lu
              </Button>
            )}
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
