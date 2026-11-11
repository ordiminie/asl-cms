import 'server-only'

import {cache} from 'react'

import {
  canManageCampaignsService,
  getCampaignComposerContextService,
  getCampaignService,
  listCampaignsService,
} from '@/services/facades/campaign-service-facade'
import {
  CampaignComposerContextDTO,
  CampaignListPageDTO,
  CampaignReadResult,
} from '@/services/types/domain/campaign-types'

import {requireCurrentTenantDal} from './tenant-dal'

/**
 * Les campagnes email du bureau (s25, ADR 051). **Jamais de cache
 * persistant** : contenu et destinataires sont des donnees personnelles
 * (ADR 038), streames derriere un `<Suspense>`. `cache()` deduplique dans la
 * requete. Le service ouvre le scope du tenant passe, celui du domaine appele.
 */
export const getCampaignComposerContextDal = cache(
  async (organizationId: string): Promise<CampaignComposerContextDTO> =>
    getCampaignComposerContextService(organizationId)
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

/** Le compte connecte peut-il gerer les campagnes de l'association du domaine ? */
export const canManageCurrentCampaignsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageCampaignsService(tenant.id)
  }
)
