import type {
  CampaignLetterGrouping,
  CampaignRecipientFilter,
} from '@/services/types/domain/campaign-types'

/** Chemins du back-office des campagnes (s25). */
export const CAMPAIGNS_PATH = '/bureau/campagnes'
export const NEW_CAMPAIGN_PATH = `${CAMPAIGNS_PATH}/nouvelle`

export const campaignPathOf = (id: string) => `${CAMPAIGNS_PATH}/${id}`

/** L'ancre de la carte « Courrier postal » dans le detail (s28 ; visee par s29). */
export const CAMPAIGN_LETTERS_ANCHOR = 'courrier'

/** La carte « Courrier postal » d'une campagne : la page des relances y mene. */
export const campaignLettersCardPathOf = (id: string) =>
  `${campaignPathOf(id)}#${CAMPAIGN_LETTERS_ANCHOR}`

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

/** La page de calage du courrier postal (s28, ADR 067 §4). */
export const CAMPAIGN_LETTER_CALIBRATION_PATH = '/api/campaigns/calage'

/** Le parametre `lettres` de la route du courrier, en francais. */
const LETTER_GROUPING_SLUGS: Record<CampaignLetterGrouping, string> = {
  per_person: 'par-personne',
  per_land: 'par-terrain',
}

/** Le PDF du courrier d'une campagne, avec le choix du bureau s'il y en a un. */
export const campaignLettersPathOf = (
  id: string,
  grouping: CampaignLetterGrouping | null
): string => {
  const path = `/api/campaigns/${encodeURIComponent(id)}/courrier`
  return grouping ? `${path}?lettres=${LETTER_GROUPING_SLUGS[grouping]}` : path
}

/**
 * Les decomptes du lot du courrier, en en-tetes de la reponse (s28, §6.1) :
 * la carte annonce ce que le PDF contient, sans le recalculer.
 */
export const LETTER_COUNT_HEADER = 'X-Letter-Count'
export const PAGE_COUNT_HEADER = 'X-Page-Count'
