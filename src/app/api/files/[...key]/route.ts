import {createContentFileGET} from '@/app/api/files/content-file-route'

/**
 * Route publique de lecture des fichiers de contenu (ADR 023) : toutes les
 * portees enregistrees, pages comme actualites.
 */
export const GET = createContentFileGET()
