/** Chemins du back-office des campagnes (s25). */
export const CAMPAIGNS_PATH = '/bureau/campagnes'
export const NEW_CAMPAIGN_PATH = `${CAMPAIGNS_PATH}/nouvelle`

export const campaignPathOf = (id: string) => `${CAMPAIGNS_PATH}/${id}`

/** La campagne qui vient de partir : l'alerte de succes s'y affiche. */
export const sentCampaignPathOf = (id: string) =>
  `${campaignPathOf(id)}?envoi=1`

export const campaignsListPathOf = (page?: number): string =>
  page && page > 1 ? `${CAMPAIGNS_PATH}?page=${page}` : CAMPAIGNS_PATH

/** Motif de route a revalider apres un envoi : archive et campagne. */
export const CAMPAIGNS_ROUTE_PATTERN = '/[locale]/(bureau)/bureau/campagnes'

/** La page publique de desinscription d'un jeton. */
export const unsubscribePathOf = (token: string) =>
  `/desinscription/${encodeURIComponent(token)}`
