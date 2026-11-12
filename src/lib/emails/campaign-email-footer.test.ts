import {describe, expect, it, vi} from 'vitest'

/**
 * Le pied des campagnes se compose aussi hors de Next : le planificateur
 * (script lance par la minuterie, ADR 052) n'a ni requete ni configuration
 * next-intl, et `getTranslations` de `next-intl/server` y leve.
 */
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    throw new Error('`getTranslations` is not supported in Client Components.')
  }),
}))

import {getCampaignFooterTexts} from './campaign-email'

describe('getCampaignFooterTexts — hors d’une requête Next (s26)', () => {
  it('rend les phrases françaises du pied sans next-intl/server', async () => {
    await expect(
      getCampaignFooterTexts('fr', {
        name: 'ASL Les Pins',
        legalName: ' ',
        legalMentions: 'Siège : 1 allée des Pins',
      })
    ).resolves.toEqual({
      associationName: 'ASL Les Pins',
      legalName: null,
      legalMentions: 'Siège : 1 allée des Pins',
      reason:
        'Vous recevez cet email parce que vous êtes membre de ASL Les Pins.',
      unsubscribeLabel: 'Ne plus recevoir ces campagnes',
      notice: 'Se désinscrire ne vous prive d’aucune information obligatoire.',
    })
  })
})
