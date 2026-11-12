import campaignServiceInterceptor from './interceptors/campaign-service-logger-interceptor'

/**
 * `deliverCampaignPartService` n'est **pas** expose : la livraison d'une part
 * n'est lancee que par le planificateur (ADR 052), dont la facade compose les
 * gestionnaires.
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
export const getCampaignRecipientsService =
  campaignServiceInterceptor.getCampaignRecipientsService
export const previewCampaignPlanService =
  campaignServiceInterceptor.previewCampaignPlanService
export const canManageCampaignsService =
  campaignServiceInterceptor.canManageCampaignsService
