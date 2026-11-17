import {Badge} from '@/components/ui/badge'
import {cn} from '@/lib/utils'
import type {InvoiceStatusClass} from '@/services/types/domain/member-invoice-types'

/**
 * Le statut d'une facture (s19, design system §3.10) : **le texte est le
 * statut tel que fourni** par la source, jamais traduit ni reduit ; la
 * variante suit sa classe. Impaye : `outline` et point plein `primary` ; non
 * impaye : `outline` attenue ; a classer : `secondary`. Jamais de rouge.
 */
export function InvoiceStatusBadge({
  status,
  statusClass,
}: {
  status: string
  statusClass: InvoiceStatusClass
}) {
  if (statusClass === 'unclassified') {
    return <Badge variant="secondary">{status}</Badge>
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-2',
        statusClass === 'settled' && 'text-muted-foreground'
      )}
    >
      {statusClass === 'unpaid' && (
        <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
      )}
      {status}
    </Badge>
  )
}
