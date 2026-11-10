import campaignServiceInterceptor from './interceptors/campaign-service-logger-interceptor'

/**
 * `deliverCampaignService` n'est **pas** expose : la livraison n'est lancee
 * que par la fonction que rend `sendCampaignService` (ADR 051).
 */
export const getCampaignComposerContextService =
  campaignServiceInterceptor.getCampaignComposerContextService
export const previewCampaignService =
  campaignServiceInterceptor.previewCampaignService
export const sendCampaignService =
  campaignServiceInterceptor.sendCampaignService
export const listCampaignsService =
  campaignServiceInterceptor.listCampaignsService
export const getCampaignService = campaignServiceInterceptor.getCampaignService
export const canManageCampaignsService =
  campaignServiceInterceptor.canManageCampaignsService
