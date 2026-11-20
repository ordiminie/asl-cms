import 'server-only'

import {cache} from 'react'

import {getCampaignLetterContextService} from '@/services/facades/campaign-letter-service-facade'
import {
  canManageCampaignsService,
  getCampaignComposerContextService,
  getCampaignRecipientsService,
  getCampaignService,
  listCampaignsService,
} from '@/services/facades/campaign-service-facade'
import {
  CampaignComposerContextDTO,
  CampaignLetterContextResult,
  CampaignListPageDTO,
  CampaignReadResult,
  CampaignRecipientFilter,
  CampaignRecipientsReadResult,
} from '@/services/types/domain/campaign-types'

import {requireCurrentTenantDal} from './tenant-dal'

/**
 * Les campagnes email du bureau (s25, ADR 051). **Jamais de cache
 * persistant** : contenu et destinataires sont des donnees personnelles
 * (ADR 038), streames derriere un `<Suspense>`. `cache()` deduplique dans la
 * requete. Le service ouvre le scope du tenant passe, celui du domaine appele.
 *
 * Le composeur s'ouvre sur la cible « tous les membres » et le message libre
 * (s27, s27b) ; un autre choix relit le decompte par une action.
 */
export const getCampaignComposerContextDal = cache(
  async (organizationId: string): Promise<CampaignComposerContextDTO> =>
    getCampaignComposerContextService(
      organizationId,
      {kind: 'all_members'},
      'free'
    )
)

export const getCampaignsPageDal = cache(
  async (organizationId: string, page: number): Promise<CampaignListPageDTO> =>
    listCampaignsService({organizationId, page})
)

export const getCampaignDal = cache(
  async (
    organizationId: string,
    campaignId: string
  ): Promise<CampaignReadResult> =>
    getCampaignService({organizationId, campaignId})
)

/** Une page des destinataires d'une campagne, filtree par etat (s26). */
export const getCampaignRecipientsDal = cache(
  async (
    organizationId: string,
    campaignId: string,
    filter: CampaignRecipientFilter,
    page: number
  ): Promise<CampaignRecipientsReadResult> =>
    getCampaignRecipientsService({organizationId, campaignId, filter, page})
)

/** Le compte connecte peut-il gerer les campagnes de l'association du domaine ? */
export const canManageCurrentCampaignsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageCampaignsService(tenant.id)
  }
)

/**
 * La carte « Courrier postal » d'une campagne (s28) : noms et domiciles des
 * membres, donc par utilisateur, sans cache persistant, derriere le
 * `<Suspense>` de la page.
 */
export const getCampaignLetterContextDal = cache(
  async (
    organizationId: string,
    campaignId: string
  ): Promise<CampaignLetterContextResult> =>
    getCampaignLetterContextService(organizationId, campaignId)
)
