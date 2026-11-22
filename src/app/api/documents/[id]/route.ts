import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {UnauthenticatedError} from '@/services/errors/unauthenticated-error'
import {readSharedDocumentFileService} from '@/services/facades/shared-document-service-facade'
import {sharedDocumentDownloadName} from '@/services/types/domain/shared-document-types'

import {
  emptyResponse,
  pdfAttachment,
  refusalResponseOf,
} from '../../campaigns/letter-pdf-response'

/**
 * Un document partage (s31, ADR 069 §4), lu **par son identifiant** sous
 * l'association du domaine appele : aucun chemin ne vient de la requete, la
 * cle est relue en base. `src/proxy.ts` ne garde pas `/api` : la route fait
 * elle-meme le controle, par le service.
 *
 * Sans session 401, sans droit 403 ; identifiant invalide, inconnu, d'une
 * autre association ou retire 404. Jamais de cache : un document retire cesse
 * aussitot d'etre servi.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>}
): Promise<Response> {
  const {id} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  try {
    const file = await readSharedDocumentFileService(tenant.id, id)
    return pdfAttachment(
      new Uint8Array(await file.content.arrayBuffer()),
      sharedDocumentDownloadName(file.title)
    )
  } catch (error) {
    if (error instanceof UnauthenticatedError) return emptyResponse(401)
    if (error instanceof NotFoundError) return emptyResponse(404)
    return refusalResponseOf(error)
  }
}
