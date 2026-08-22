'use client'

import {Trash2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface DeleteUserDialogProps {
  userId: string
  userName: string
  onDelete: (id: string) => Promise<void>
}

export function DeleteUserDialog({
  userId,
  userName,
  onDelete,
}: DeleteUserDialogProps) {
  const t = useTranslations('AdminUsers')
  const tCommon = useTranslations('Common')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await onDelete(userId)
      setIsDialogOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{tCommon('actions.delete')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('deleteConfirm', {name: userName})}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleting') : tCommon('actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
