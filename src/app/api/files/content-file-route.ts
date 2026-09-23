import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {readContentFileService} from '@/services/facades/content-file-service-facade'
import {
  CONTENT_FILE_SCOPES,
  ContentFileScope,
  isContentFileKeyAllowed,
} from '@/services/types/domain/content-file-types'

const LONG_CACHE = 'public, max-age=31536000, immutable'

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: {'X-Content-Type-Options': 'nosniff'},
  })

type ContentFileRoute = (
  request: Request,
  context: {params: Promise<{key: string[]}>}
) => Promise<Response>

/**
 * Gestionnaire unique des fichiers de contenu : bloc de page (s04), image
 * d'actualite (s05) — ADR 004, ADR 023.
 *
 * Le tenant vient du **domaine appele** ; la cle vient de la requete, donc
 * elle est validee contre les portees servies par ce chemin
 * (`{organizationId}/{portee}/`) avant toute lecture — jamais prise telle
 * quelle comme le fait `file-service.ts`. Toute cle hors de ce prefixe est
 * introuvable, pas refusee : rien ne dit au visiteur qu'un fichier existe
 * ailleurs.
 *
 * `scopes` borne les portees servies : `/api/files` les sert toutes, le chemin
 * herite `/api/pages/files` ne sert que `pages` (ADR 023 : il existe pour les
 * adresses deja rendues, il ne s'etend pas).
 *
 * Le nom du fichier porte un identifiant unique genere a l'ecriture : un
 * remplacement change la cle, donc le cache long ne peut pas servir une
 * version perimee.
 */
export const createContentFileGET = (
  scopes: readonly ContentFileScope[] = CONTENT_FILE_SCOPES
): ContentFileRoute =>
  async function GET(_request, {params}) {
    const {key} = await params
    const tenant = await getCurrentTenantDal()
    if (!tenant) {
      return notFound()
    }

    const storageKey = key.join('/')
    if (!isContentFileKeyAllowed(tenant.id, storageKey, scopes)) {
      return notFound()
    }

    try {
      const stored = await readContentFileService(tenant.id, storageKey)
      return new Response(stored.content, {
        status: 200,
        headers: {
          'Content-Type': stored.contentType,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': LONG_CACHE,
        },
      })
    } catch {
      return notFound()
    }
  }
