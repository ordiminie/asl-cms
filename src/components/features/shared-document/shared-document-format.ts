import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

/** Le jour de depot `jj/mm/aaaa`, a Paris (bureau et espace membre). */
export const sharedDocumentDateOf = (createdAt: Date): string =>
  isoToFrenchDate(calendarDayOf(createdAt))
