import {describe, expect, it} from 'vitest'

import * as campaignLetterFacade from '../facades/campaign-letter-service-facade'
import * as campaignFacade from '../facades/campaign-service-facade'
import * as unsubscribeFacade from '../facades/unsubscribe-service-facade'

describe('façades des campagnes (s25, ADR 051)', () => {
  it('expose le composeur, l’aperçu, l’envoi et l’archive, jamais la livraison', () => {
    expect(Object.keys(campaignFacade).sort()).toEqual(
      [
        'canManageCampaignsService',
        'getCampaignComposerContextService',
        'getCampaignRecipientsService',
        'getCampaignService',
        'getCampaignStatisticsService',
        'listCampaignsService',
        'previewCampaignPlanService',
        'previewCampaignService',
        'sendCampaignService',
      ].sort()
    )
    expect(campaignFacade).not.toHaveProperty('deliverCampaignPartService')
    expect(campaignFacade).not.toHaveProperty('campaignScheduledJobHandlers')
  })

  it('expose la lecture et la confirmation de la désinscription', () => {
    expect(Object.keys(unsubscribeFacade).sort()).toEqual(
      [
        'confirmUnsubscribeService',
        'getMemberUnsubscribeService',
        'getUnsubscribePageStateService',
      ].sort()
    )
  })

  it('expose le contexte du courrier, son PDF et la page de calage (s28)', () => {
    expect(Object.keys(campaignLetterFacade).sort()).toEqual(
      [
        'generateCampaignLettersService',
        'getCampaignLetterContextService',
        'getLetterCalibrationPdfService',
      ].sort()
    )
  })
})
