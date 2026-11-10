import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {unsubscribePathOf} from '@/components/features/campaigns/campaign-paths'
import {logger} from '@/lib/logger'
import {confirmUnsubscribeService} from '@/services/facades/unsubscribe-service-facade'

/**
 * Desinscription sans interaction (RFC 8058), s25, ADR 051. L'en-tete
 * `List-Unsubscribe-Post` d'une campagne fait appeler ce `POST` par le client
 * de messagerie ; c'est la seule methode qui ecrit.
 *
 * `GET` ne fait que **rediriger** vers la page publique, qui demande une
 * confirmation : les antivirus et les clients de messagerie prechargent les
 * liens, un `GET` qui ecrirait desinscrirait des membres a leur insu.
 *
 * Hors du `matcher` de `src/proxy.ts` : le tenant vient de l'en-tete `Host`.
 * Toute reponse est sans corps : aucun detail sur le jeton ni sur la fiche.
 */

type RouteContext = {params: Promise<{jeton: string}>}

const NEUTRAL_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

const emptyResponse = (status: number) =>
  new Response(null, {status, headers: NEUTRAL_HEADERS})

export async function GET(_request: Request, {params}: RouteContext) {
  const {jeton} = await params
  return new Response(null, {
    status: 303,
    headers: {...NEUTRAL_HEADERS, Location: unsubscribePathOf(jeton)},
  })
}

export async function POST(_request: Request, {params}: RouteContext) {
  const {jeton} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) return emptyResponse(404)

  try {
    const result = await confirmUnsubscribeService({
      organizationId: tenant.id,
      token: jeton,
    })
    return emptyResponse(result.status === 'invalid' ? 404 : 200)
  } catch (error) {
    logger.error('[UNSUBSCRIBE] Desinscription sans interaction en echec', {
      error: error instanceof Error ? error.name : 'unknown',
    })
    return emptyResponse(500)
  }
}
