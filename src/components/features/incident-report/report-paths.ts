/** Chemins du back-office des signalements (s10). */
export const REPORTS_PATH = '/bureau/signalements'
export const REPORT_CATEGORIES_PATH = `${REPORTS_PATH}/categories`

export const reportPathOf = (id: string) => `${REPORTS_PATH}/${id}`

/**
 * Motifs de route (arborescence de fichiers) a revalider apres une ecriture :
 * le segment du back-office — file, detail et categories, en `layout` — et le
 * formulaire public, qui propose les categories actives.
 */
export const REPORTS_ROUTE_PATTERN = '/[locale]/(bureau)/bureau/signalements'
export const REPORT_FORM_ROUTE_PATTERN = '/[locale]/(public)/signaler'
