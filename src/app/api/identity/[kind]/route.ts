import {getCurrentTenantDal, TenantDTO} from '@/app/dal/tenant-dal'
import {renderAssociationMonogramSvg} from '@/lib/helper/association-monogram-svg'
import {readAssociationIdentityFileService} from '@/services/facades/association-identity-service-facade'
import {
  ASSOCIATION_IDENTITY_KINDS,
  AssociationIdentityKind,
  getIdentityVersionFromKey,
} from '@/services/types/domain/association-identity-types'

const LONG_CACHE = 'public, max-age=31536000, immutable'
const NO_LONG_CACHE = 'no-cache'

const isIdentityKind = (value: string): value is AssociationIdentityKind =>
  (ASSOCIATION_IDENTITY_KINDS as readonly string[]).includes(value)

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: {'X-Content-Type-Options': 'nosniff'},
  })

const identityResponse = (
  body: BodyInit,
  contentType: string,
  cacheControl: string
) =>
  new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheControl,
    },
  })

const readStoredFile = async (
  tenant: TenantDTO,
  kind: AssociationIdentityKind,
  key: string
) => {
  try {
    return await readAssociationIdentityFileService(tenant.id, kind, key)
  } catch {
    return undefined
  }
}

/**
 * Logo ou favicon de l'association du domaine appele (ADR 015, s01b).
 *
 * Le type est un enumere, le tenant vient du domaine, la cle vient de la base :
 * aucun chemin n'est lu depuis la requete. Cache long seulement quand `?v=`
 * porte la version courante, pour qu'un remplacement s'affiche aussitot.
 * Sans favicon, le monogramme de l'association est genere.
 */
export async function GET(
  request: Request,
  {params}: {params: Promise<{kind: string}>}
): Promise<Response> {
  const {kind} = await params
  if (!isIdentityKind(kind)) {
    return notFound()
  }

  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    return notFound()
  }

  const key = kind === 'logo' ? tenant.logoKey : tenant.faviconKey
  const stored = key ? await readStoredFile(tenant, kind, key) : undefined

  if (stored) {
    const requestedVersion = new URL(request.url).searchParams.get('v')
    const isCurrentVersion =
      requestedVersion !== null &&
      requestedVersion === getIdentityVersionFromKey(key)
    return identityResponse(
      stored.content,
      stored.contentType,
      isCurrentVersion ? LONG_CACHE : NO_LONG_CACHE
    )
  }

  if (kind === 'favicon') {
    return identityResponse(
      renderAssociationMonogramSvg(tenant.name),
      'image/svg+xml',
      NO_LONG_CACHE
    )
  }

  return notFound()
}
