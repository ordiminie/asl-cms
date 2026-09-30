import {AlertTriangle} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import type {ReportStatus} from '@/services/types/domain/incident-report-types'

/**
 * Badge d'un statut de workflow (gap 1 du design s10) : **le mot porte
 * l'information**, la variante existante du `badge` la souligne. Aucune
 * couleur nouvelle, jamais de rouge pour « Signale ».
 */
export function ReportStatusBadge({status}: {status: ReportStatus}) {
  const t = useTranslations('BureauReportsPage.status')

  if (status === 'in_progress') {
    return <Badge variant="secondary">{t(status)}</Badge>
  }

  return (
    <Badge
      variant="outline"
      className={cn('gap-2', status === 'resolved' && 'text-muted-foreground')}
    >
      {status === 'reported' && (
        <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
      )}
      {t(status)}
    </Badge>
  )
}

/**
 * Le statut et, s'il y a lieu, « Notification non envoyee » : deux badges sur
 * une seule ligne, `gap` 8 px, retour a la ligne permis (§3.9).
 */
export function ReportStatusBadges({
  status,
  notificationFailed,
}: {
  status: ReportStatus
  notificationFailed: boolean
}) {
  const t = useTranslations('BureauReportsPage.status')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReportStatusBadge status={status} />
      {notificationFailed && (
        <Badge variant="destructive">
          <AlertTriangle aria-hidden="true" strokeWidth={1.75} />
          {t('notificationFailed')}
        </Badge>
      )}
    </div>
  )
}
