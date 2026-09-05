'use client'

import {Trash2} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {Button} from '@/components/ui/button'
import {Checkbox} from '@/components/ui/checkbox'

interface Props {
  planId: string
  planName: string
  onDelete: (id: string, permanent: boolean) => Promise<void>
}

export function DeletePlanDialog({planId, planName, onDelete}: Props) {
  const t = useTranslations('AdminPlans')
  const tCommon = useTranslations('Common')
  const [isLoading, setIsLoading] = useState(false)
  const [permanent, setPermanent] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await onDelete(planId, permanent)
    } catch (error) {
      console.error('Error deleting plan:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {permanent ? t('delete.deleteTitle') : t('delete.archiveTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {permanent
              ? t('delete.deleteConfirm', {name: planName})
              : t('delete.archiveConfirm', {name: planName})}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="permanent"
              checked={permanent}
              onCheckedChange={(checked) => setPermanent(checked === true)}
            />
            <label
              htmlFor="permanent"
              className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t('delete.permanentLabel')}
            </label>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {t('delete.permanentHint')}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className={
              permanent
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {isLoading
              ? permanent
                ? t('delete.deleting')
                : t('delete.archiving')
              : permanent
                ? t('delete.deletePermanently')
                : t('delete.archive')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
