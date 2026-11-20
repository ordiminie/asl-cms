import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent} from '@/__tests__/customRender'
import type {CampaignTemplateId} from '@/services/types/domain/campaign-types'

import {
  UnsubscribePanel,
  type UnsubscribeScreenState,
} from './unsubscribe-panel'

const TOKEN = 'k7Q2xP9m'.padEnd(43, 'A')
const CONTINUES =
  'Vous continuerez de recevoir, parce que votre appartenance à l’association vous y engage :'
const NOTHING_MORE =
  'Vous ne recevrez plus aucune campagne de ASL Les Pins à cette adresse.'

const renderPanel = (
  initialState: UnsubscribeScreenState,
  statutoryTemplateIds: CampaignTemplateId[] | null = [
    'reminder',
    'invoice',
    'general_assembly',
  ]
) =>
  render(
    <UnsubscribePanel
      token={TOKEN}
      associationName="ASL Les Pins"
      contactEmail="contact@lespins.example"
      initialState={initialState}
      statutoryTemplateIds={statutoryTemplateIds}
      confirmAction={vi.fn(async () => ({status: 'unsubscribed' as const}))}
    />
  )

const listedTypes = () =>
  screen
    .getByRole('list', {name: CONTINUES})
    .querySelectorAll('li')
    .values()
    .map((item) => item.textContent)
    .toArray()

describe('UnsubscribePanel — ce que le membre continuera de recevoir (s27b, critère 5)', () => {
  it('confirmation : liste les envois statutaires, sous la phrase de désinscription', () => {
    renderPanel('confirm')

    expect(screen.getByText(CONTINUES)).toBeInTheDocument()
    expect(listedTypes()).toEqual([
      'Relance manuelle',
      'Facture disponible',
      'Convocation à l’AG',
    ])
    expect(screen.getByRole('button', {name: 'Me désinscrire'})).toBeEnabled()
  })

  it('enregistré : la liste reste après la confirmation', async () => {
    renderPanel('confirm')

    await userEvent.click(screen.getByRole('button', {name: 'Me désinscrire'}))

    expect(
      await screen.findByText(
        'C’est enregistré. Cette adresse ne recevra plus les campagnes de ASL Les Pins.'
      )
    ).toBeInTheDocument()
    expect(listedTypes()).toHaveLength(3)
  })

  it('déjà désinscrit : reprend le paragraphe', () => {
    renderPanel('already')

    expect(listedTypes()).toEqual([
      'Relance manuelle',
      'Facture disponible',
      'Convocation à l’AG',
    ])
  })

  it.each(['confirm', 'unsubscribed', 'already'] as const)(
    '« %s » sans envoi statutaire : plus aucune campagne à cette adresse',
    (state) => {
      renderPanel(state, [])

      expect(screen.getByText(NOTHING_MORE)).toBeInTheDocument()
      expect(screen.queryByText(CONTINUES)).toBeNull()
    }
  )

  it('lien invalide : rien sur ce qui continue', () => {
    renderPanel('invalid')

    expect(screen.queryByText(CONTINUES)).toBeNull()
    expect(screen.queryByText(NOTHING_MORE)).toBeNull()
  })

  it('classification illisible : aucune promesse, ni liste ni « plus aucune campagne »', () => {
    renderPanel('confirm', null)

    expect(screen.queryByText(CONTINUES)).toBeNull()
    expect(screen.queryByText(NOTHING_MORE)).toBeNull()
  })
})
