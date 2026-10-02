import {
  frenchDateToIso,
  isoToFrenchDate,
} from '@/components/ui/date-field-format'

/** Chemins du back-office des proprietaires (s12). */
export const MEMBER_PROFILES_PATH = '/bureau/proprietaires'
export const NEW_MEMBER_PROFILE_PATH = `${MEMBER_PROFILES_PATH}/nouveau`

export const memberProfilePathOf = (id: string) =>
  `${MEMBER_PROFILES_PATH}/${id}`

export const salePathOf = (memberProfileId: string, parcelId: string) =>
  `${memberProfilePathOf(memberProfileId)}/vente/${parcelId}`

/**
 * L'adresse de la liste pour une page et une recherche : la recherche voyage
 * en parametre d'URL (`q`) et la pagination la conserve.
 */
export const memberProfilesListPathOf = (input: {
  page?: number
  search?: string
}): string => {
  const params = new URLSearchParams()
  if (input.search) params.set('q', input.search)
  if (input.page) params.set('page', String(input.page))

  const query = params.toString()
  return query ? `${MEMBER_PROFILES_PATH}?${query}` : MEMBER_PROFILES_PATH
}

/**
 * Motif de route (arborescence de fichiers) a revalider apres une ecriture :
 * le segment du back-office — liste, fiche et vente, en `layout`.
 */
export const MEMBER_PROFILES_ROUTE_PATTERN =
  '/[locale]/(bureau)/bureau/proprietaires'

/**
 * L'ecran d'ajout, ouvert depuis une vente dont l'acquereur n'a pas encore de
 * fiche : la vente et sa date voyagent dans l'URL, pour y revenir ensuite.
 */
export const newBuyerPathOf = (input: {
  sellerId: string
  parcelId: string
  date?: string
}): string => {
  const params = new URLSearchParams({
    vendeur: input.sellerId,
    parcelle: input.parcelId,
  })
  if (input.date) params.set('date', input.date)

  return `${NEW_MEMBER_PROFILE_PATH}?${params.toString()}`
}

/** Le retour sur la vente, l'acquereur preselectionne et la date conservee. */
export const saleReturnPathOf = (input: {
  sellerId: string
  parcelId: string
  buyerId?: string
  date?: string
}): string => {
  const params = new URLSearchParams()
  if (input.buyerId) params.set('acquereur', input.buyerId)
  if (input.date) params.set('date', input.date)

  const query = params.toString()
  const path = salePathOf(input.sellerId, input.parcelId)
  return query ? `${path}?${query}` : path
}

/** La fiche du vendeur, avec le temoin de la vente qui vient d'etre faite. */
export const soldParcelPathOf = (sellerId: string, parcelId: string): string =>
  `${memberProfilePathOf(sellerId)}?vente=${parcelId}`

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Une date ISO `YYYY-MM-DD` d'un jour qui existe, lue dans une URL. */
export const validIsoDateOf = (value?: string): string | undefined =>
  value && frenchDateToIso(isoToFrenchDate(value)) === value ? value : undefined

export type SaleReturn = {sellerId: string; parcelId: string; date?: string}

/**
 * La vente d'ou vient l'ecran d'ajout, lue dans l'URL. Les identifiants sont
 * verifies : un parametre malforme est ignore, il n'entre dans aucun chemin.
 */
export const saleReturnOf = (params: {
  vendeur?: string
  parcelle?: string
  date?: string
}): SaleReturn | undefined => {
  const {vendeur, parcelle} = params
  if (!vendeur || !parcelle) return undefined
  if (!UUID_PATTERN.test(vendeur) || !UUID_PATTERN.test(parcelle)) {
    return undefined
  }

  return {
    sellerId: vendeur,
    parcelId: parcelle,
    date: validIsoDateOf(params.date),
  }
}
