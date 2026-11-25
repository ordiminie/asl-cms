import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {NotFoundError} from '@/services/errors/not-found-error'
import {UnauthenticatedError} from '@/services/errors/unauthenticated-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {readMemberDocumentFileService} from '@/services/facades/member-document-service-facade'
import {memberDocumentDownloadName} from '@/services/types/domain/member-document-types'

import {emptyResponse, pdfAttachment} from '../../campaigns/letter-pdf-response'

/**
 * Un document nominatif (s32, ADR 073 §5), lu **par son identifiant** sous
 * l'association du domaine appele : aucun chemin ne vient de la requete, la
 * cle est relue en base et controlee contre sa fiche. `src/proxy.ts` ne garde
 * pas `/api` : la route fait elle-meme le controle, par le service.
 *
 * Sans session 401 ; **404 pour tout le reste** (identifiant non uuid,
 * inconnu, d'une autre association, d'une fiche non possedee, retire) : un
 * membre n'apprend pas qu'un document existe. Jamais de cache.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>}
): Promise<Response> {
  const {id} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  try {
    const file = await readMemberDocumentFileService(tenant.id, id)
    return pdfAttachment(
      new Uint8Array(await file.content.arrayBuffer()),
      memberDocumentDownloadName(file.title)
    )
  } catch (error) {
    if (error instanceof UnauthenticatedError) return emptyResponse(401)
    if (
      error instanceof NotFoundError ||
      error instanceof AuthorizationError ||
      error instanceof ValidationParsedZodError
    ) {
      return emptyResponse(404)
    }
    throw error
  }
}
