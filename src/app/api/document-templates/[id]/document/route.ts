import {
  emptyResponse,
  pdfAttachment,
  refusalResponseOf,
} from '@/app/api/campaigns/letter-pdf-response'
import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {renderTemplateDocumentService} from '@/services/facades/document-template-service-facade'
import type {DocumentTemplateRenderResult} from '@/services/types/domain/document-template-types'

const STATUS_OF: Record<
  Exclude<DocumentTemplateRenderResult['status'], 'ready'>,
  number
> = {
  not_found: 404,
  invalid_date: 422,
  unknown_variables: 422,
  render_failed: 500,
}

const render = async (
  input: Parameters<typeof renderTemplateDocumentService>[0]
): Promise<DocumentTemplateRenderResult | Response> => {
  try {
    return await renderTemplateDocumentService(input)
  } catch (error) {
    return refusalResponseOf(error)
  }
}

/**
 * Le document d'une fiche depuis un modele (s36, critere 2), pour
 * l'association du domaine appele : `?fiche=<id>&date=aaaa-mm-jj`. Produit en
 * memoire, **rien n'est stocke** (ADR 074 §4) ; le depot passe par une Server
 * Action, jamais par ce `GET`.
 */
export async function GET(
  request: Request,
  {params}: {params: Promise<{id: string}>}
): Promise<Response> {
  const {id} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  const query = new URL(request.url).searchParams
  const result = await render({
    organizationId: tenant.id,
    templateId: id,
    memberProfileId: query.get('fiche') ?? '',
    documentDate: query.get('date') ?? '',
  })
  if (result instanceof Response) return result
  if (result.status !== 'ready') return emptyResponse(STATUS_OF[result.status])
  return pdfAttachment(result.pdf, result.fileName)
}
