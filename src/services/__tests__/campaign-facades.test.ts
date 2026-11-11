import {describe, expect, it} from 'vitest'

import * as campaignFacade from '../facades/campaign-service-facade'
import * as unsubscribeFacade from '../facades/unsubscribe-service-facade'

describe('façades des campagnes (s25, ADR 051)', () => {
  it('expose le composeur, l’aperçu, l’envoi et l’archive, jamais la livraison', () => {
    expect(Object.keys(campaignFacade).sort()).toEqual(
      [
        'canManageCampaignsService',
        'getCampaignComposerContextService',
        'getCampaignService',
        'listCampaignsService',
        'previewCampaignService',
        'sendCampaignService',
      ].sort()
    )
    expect(campaignFacade).not.toHaveProperty('deliverCampaignService')
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
})
