import {createContentFileGET} from '@/app/api/files/content-file-route'
import {ContentFileScopeConst} from '@/services/types/domain/content-file-types'

/**
 * Chemin historique des fichiers de pages (s04). Servi par **le meme**
 * gestionnaire que `/api/files` (ADR 023) pour ne casser aucune adresse deja
 * rendue, mais borne a la portee `pages` : ce chemin ne s'etend pas, tout
 * nouveau client passe par `/api/files`.
 */
export const GET = createContentFileGET([ContentFileScopeConst.PAGES])
