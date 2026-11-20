import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {
  LETTER_COUNT_HEADER,
  PAGE_COUNT_HEADER,
} from '@/components/features/campaigns/campaign-paths'
import {generateCampaignLettersService} from '@/services/facades/campaign-letter-service-facade'
import type {
  CampaignLetterGrouping,
  CampaignLettersPdfResult,
} from '@/services/types/domain/campaign-types'

import {
  emptyResponse,
  pdfAttachment,
  refusalResponseOf,
} from '../../letter-pdf-response'

/** La valeur du parametre `lettres`, en francais dans l'adresse. */
const GROUPING_OF_PARAM: Record<string, CampaignLetterGrouping> = {
  'par-personne': 'per_person',
  'par-terrain': 'per_land',
}

const STATUS_OF: Record<
  Exclude<CampaignLettersPdfResult['status'], 'ready'>,
  number
> = {
  not_found: 404,
  grouping_required: 409,
  none: 422,
  legacy: 422,
}

/** `courrier-jj-mm-aaaa.pdf` : la date d'envoi, aucun nom de membre. */
const fileNameOf = (sendDate: string): string => {
  const [year, month, day] = sendDate.split('-')
  return `courrier-${day}-${month}-${year}.pdf`
}

const generate = async (
  organizationId: string,
  campaignId: string,
  grouping: CampaignLetterGrouping | null
): Promise<CampaignLettersPdfResult | Response> => {
  try {
    return await generateCampaignLettersService(
      organizationId,
      campaignId,
      grouping
    )
  } catch (error) {
    return refusalResponseOf(error)
  }
}

/**
 * Le PDF du courrier postal d'une campagne (s28, criteres 1 a 5), pour
 * l'association du domaine appele. `?lettres=par-personne|par-terrain` porte
 * le choix du bureau pour les homonymes, jamais enregistre (ADR 067 §5).
 */
export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
): Promise<Response> {
  const {id} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  const param = new URL(request.url).searchParams.get('lettres') ?? ''
  const result = await generate(tenant.id, id, GROUPING_OF_PARAM[param] ?? null)
  if (result instanceof Response) return result
  if (result.status !== 'ready') return emptyResponse(STATUS_OF[result.status])
  return pdfAttachment(result.pdf, fileNameOf(result.sendDate), {
    [LETTER_COUNT_HEADER]: String(result.letterCount),
    [PAGE_COUNT_HEADER]: String(result.pageCount),
  })
}
