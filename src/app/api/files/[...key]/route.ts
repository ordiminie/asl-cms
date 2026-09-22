import {getCurrentTenantDal} from '@/app/dal/tenant-dal'
import {readContentFileService} from '@/services/facades/content-file-service-facade'

const LONG_CACHE = 'public, max-age=31536000, immutable'

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: {'X-Content-Type-Options': 'nosniff'},
  })

/**
 * Fichier de contenu : bloc de page (s04), image d'actualite (s05) — ADR 004,
 * ADR 023.
 *
 * Le tenant vient du **domaine appele** ; la cle vient de la requete, donc
 * elle est validee contre les portees enregistrees de ce tenant
 * (`{organizationId}/{portee}/`) avant toute lecture — jamais prise telle quelle comme le fait
 * `file-service.ts`. Toute cle hors de ce prefixe est introuvable, pas
 * refusee : rien ne dit au visiteur qu'un fichier existe ailleurs.
 *
 * Le nom du fichier porte un identifiant unique genere a l'ecriture : un
 * remplacement change la cle, donc le cache long ne peut pas servir une
 * version perimee.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{key: string[]}>}
): Promise<Response> {
  const {key} = await params
  const tenant = await getCurrentTenantDal()
  if (!tenant) {
    return notFound()
  }

  try {
    const stored = await readContentFileService(tenant.id, key.join('/'))
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
