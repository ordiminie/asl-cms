'use client'

import {Trash2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'

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

interface Props {
  projectId: string
  projectName: string
  onDelete: (id: string) => Promise<void>
  isLoading?: boolean
}

export function DeleteProjectDialog({
  projectId,
  projectName,
  onDelete,
  isLoading = false,
}: Props) {
  const t = useTranslations('Projects')
  const tCommon = useTranslations('Common')
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    await onDelete(projectId)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('form.deleteTitle')}</DialogTitle>
          <DialogDescription>
            {t('form.deleteDialogDescription', {name: projectName})}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? t('form.deleting') : tCommon('actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
