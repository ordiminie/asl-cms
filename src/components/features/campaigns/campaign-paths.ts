import type {CampaignRecipientFilter} from '@/services/types/domain/campaign-types'

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

/** Le filtre de la liste des destinataires, tel qu'il s'ecrit dans l'URL. */
export const RECIPIENT_FILTER_SLUGS: Record<CampaignRecipientFilter, string> = {
  all: 'tous',
  received: 'recue',
  scheduled: 'programmee',
  to_verify: 'a-verifier',
  failed: 'en-echec',
}

/** Le filtre d'un `?statut=` ; inconnu ou absent : « Tous ». */
export const recipientFilterOfSlug = (
  slug: string | undefined
): CampaignRecipientFilter =>
  (Object.entries(RECIPIENT_FILTER_SLUGS).find(
    ([, candidate]) => candidate === slug
  )?.[0] as CampaignRecipientFilter | undefined) ?? 'all'

/** Un numero de page d'un `?page=` ; hors forme : 1. */
export const pageOfParam = (param: string | undefined): number => {
  const requested = Number.parseInt(param ?? '1', 10)
  return Number.isNaN(requested) || requested < 1 ? 1 : requested
}

/** La page d'une campagne, liste des destinataires filtree et paginee. */
export const campaignRecipientsPathOf = (
  id: string,
  filter: CampaignRecipientFilter,
  page = 1
): string => {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('statut', RECIPIENT_FILTER_SLUGS[filter])
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `${campaignPathOf(id)}?${query}` : campaignPathOf(id)
}
