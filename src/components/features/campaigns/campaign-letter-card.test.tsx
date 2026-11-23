import {describe, expect, it} from 'vitest'

import {render, screen, within} from '@/__tests__/customRender'
import type {
  CampaignLetterContextDTO,
  CampaignLetterContextResult,
} from '@/services/types/domain/campaign-types'

import {CampaignLetterCard} from './campaign-letter-card'
import {
  CAMPAIGN_LETTERS_ANCHOR,
  campaignLettersCardPathOf,
} from './campaign-paths'

const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'

const contextOf = (
  overrides: Partial<CampaignLetterContextDTO> = {}
): CampaignLetterContextDTO => ({
  sendDate: '2026-11-12',
  withoutEmailCount: 4,
  withoutHomeCount: 2,
  homonymGroups: [
    {
      name: 'Marcel Laurent',
      homeAddress: '4 rue des Lilas, 69003 Lyon',
      profileCount: 2,
      parcelNumbers: ['14', '27'],
    },
  ],
  landAddressed: [{id: 'roy', name: 'Hélène Roy', parcelNumbers: ['3']}],
  nameOnly: [{id: 'nobody', name: 'Sans Adresse', parcelNumbers: ['8']}],
  addressTooWide: [],
  ...overrides,
})

const renderCard = (result: CampaignLetterContextResult) =>
  render(<CampaignLetterCard campaignId={CAMPAIGN_ID} result={result} />)

const card = () =>
  screen
    .getByRole('heading', {level: 2, name: 'Courrier postal'})
    .closest('[data-slot="card"]') as HTMLElement

describe('CampaignLetterCard — la carte « Courrier postal » (s28)', () => {
  it('porte l’ancre que la page des relances vise (s29)', () => {
    renderCard({status: 'ready', context: contextOf()})

    expect(card()).toHaveAttribute('id', CAMPAIGN_LETTERS_ANCHOR)
    expect(campaignLettersCardPathOf(CAMPAIGN_ID)).toBe(
      `/bureau/campagnes/${CAMPAIGN_ID}#${CAMPAIGN_LETTERS_ANCHOR}`
    )
  })

  it('vide (critère 5) : « aucun courrier à produire », sans bouton ni compteur', () => {
    renderCard({status: 'none'})

    expect(card()).toHaveTextContent(
      'Aucun courrier à produire : tous les membres visés par cette campagne ont une adresse email.'
    )
    expect(within(card()).queryByRole('button')).toBeNull()
    expect(within(card()).queryByRole('definition')).toBeNull()
  })

  it('campagne antérieure au courrier : le dit, sans bouton (ADR 065 §4)', () => {
    renderCard({status: 'legacy'})

    expect(card()).toHaveTextContent(
      'Le courrier n’est pas disponible pour cette campagne : elle a été envoyée avant l’ajout du courrier postal. Il le sera pour les suivantes.'
    )
    expect(within(card()).queryByRole('button')).toBeNull()
  })

  it('introuvable : aucune carte', () => {
    renderCard({status: 'not_found'})

    expect(screen.queryByRole('heading', {name: 'Courrier postal'})).toBeNull()
  })

  it('prêt : phrase d’usage et compteur en trois paires', () => {
    renderCard({status: 'ready', context: contextOf()})

    expect(card()).toHaveTextContent(
      'Les membres sans adresse email reçoivent cette campagne par la poste.'
    )
    const terms = within(card())
      .getAllByRole('term')
      .map((term) => term.textContent)
    const values = within(card())
      .getAllByRole('definition')
      .map((value) => value.textContent)
    expect(terms).toEqual([
      'Fiches sans adresse email',
      'Dont sans domicile',
      'Date portée sur les lettres',
    ])
    expect(values).toEqual(['4', '2', '12/11/2026'])
  })

  it('signale les homonymes avant la génération (critère 2), avec leur domicile et leurs parcelles', () => {
    renderCard({status: 'ready', context: contextOf()})

    const warning = within(card())
      .getByText('Une même personne semble posséder plusieurs terrains.')
      .closest('[data-slot="alert"]') as HTMLElement
    expect(warning).toHaveTextContent('Marcel Laurent')
    expect(warning).toHaveTextContent('4 rue des Lilas, 69003 Lyon')
    expect(warning).toHaveTextContent('2 fiches · parcelles 14 et 27')
    expect(
      within(card()).getByRole('radiogroup', {
        name: 'Lettres des propriétaires de plusieurs terrains',
      })
    ).toBeInTheDocument()
  })

  it('sans homonymes : ni signalement ni choix', () => {
    renderCard({status: 'ready', context: contextOf({homonymGroups: []})})

    expect(
      within(card()).queryByText(
        'Une même personne semble posséder plusieurs terrains.'
      )
    ).toBeNull()
    expect(within(card()).queryByRole('radiogroup')).toBeNull()
  })

  it('les lettres au terrain et au nom seul, chaque nom en lien vers sa fiche (ADR 067 §1)', () => {
    renderCard({status: 'ready', context: contextOf()})

    expect(card()).toHaveTextContent(
      'Adressées au terrain, faute de domicile :'
    )
    expect(card()).toHaveTextContent(
      'Sans aucune adresse — nom seul dans la fenêtre :'
    )
    expect(
      within(card()).getByRole('link', {name: 'Hélène Roy'})
    ).toHaveAttribute('href', '/bureau/proprietaires/roy')
    expect(
      within(card()).getByRole('link', {name: 'Sans Adresse'})
    ).toHaveAttribute('href', '/bureau/proprietaires/nobody')
    expect(card()).toHaveTextContent(
      'Complétez le domicile sur la fiche pour que la lettre parte à la bonne adresse.'
    )
  })

  it('une adresse trop large pour la fenêtre : signalée, le nom en lien vers sa fiche (M1)', () => {
    renderCard({
      status: 'ready',
      context: contextOf({
        withoutHomeCount: 0,
        landAddressed: [],
        nameOnly: [],
        addressTooWide: [
          {id: 'sci', name: 'SCI du Domaine', parcelNumbers: ['40']},
        ],
      }),
    })

    expect(card()).toHaveTextContent(
      'Adresse trop longue pour la fenêtre de l’enveloppe, même réduite et coupée :'
    )
    expect(
      within(card()).getByRole('link', {name: 'SCI du Domaine'})
    ).toHaveAttribute('href', '/bureau/proprietaires/sci')
    expect(card()).toHaveTextContent(
      'Raccourcissez l’adresse sur la fiche pour qu’elle apparaisse entière dans la fenêtre.'
    )
    expect(card()).not.toHaveTextContent('Complétez le domicile')
  })

  it('aucune fiche sans domicile : pas de liste', () => {
    renderCard({
      status: 'ready',
      context: contextOf({
        withoutHomeCount: 0,
        landAddressed: [],
        nameOnly: [],
      }),
    })

    expect(card()).not.toHaveTextContent('faute de domicile')
    expect(card()).not.toHaveTextContent('nom seul dans la fenêtre')
  })

  it('la page de calage, toujours disponible, et la note de tri', () => {
    renderCard({status: 'ready', context: contextOf()})

    expect(
      within(card()).getByRole('link', {name: 'Télécharger la page de calage'})
    ).toHaveAttribute('href', '/api/campaigns/calage')
    expect(
      within(card()).getByRole('link', {name: 'Réglages › Courrier'})
    ).toHaveAttribute('href', '/bureau/reglages')
    expect(card()).toHaveTextContent(
      'Les lettres sont triées par nom, dans l’ordre de mise sous pli.'
    )
  })
})
