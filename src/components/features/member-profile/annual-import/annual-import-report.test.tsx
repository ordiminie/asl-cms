import {describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import type {AnnualImportReportDTO} from '@/services/types/domain/member-annual-import-types'

import {AnnualImportReport} from './annual-import-report'

const ID_A = '33333333-3333-4333-8333-333333333333'
const ID_B = '44444444-4444-4444-8444-444444444444'

const EMPTY: AnnualImportReportDTO = {
  linesRead: 0,
  profilesUpdated: 0,
  profilesUnchanged: 0,
  membersToCreate: 0,
  linesRejected: 0,
  updated: [],
  kept: [],
  replaced: [],
  designated: [],
  disabled: [],
  manual: [],
  toCreate: [],
  rejections: [],
}

const FULL: AnnualImportReportDTO = {
  ...EMPTY,
  linesRead: 5,
  profilesUpdated: 2,
  profilesUnchanged: 1,
  membersToCreate: 1,
  linesRejected: 1,
  updated: [
    {memberProfileId: ID_A, name: 'Lucie Fictive', groups: ['home', 'emails']},
    {memberProfileId: ID_B, name: 'Marc Inventé', groups: ['phone']},
  ],
  kept: [
    {
      memberProfileId: ID_B,
      name: 'Marc Inventé',
      group: 'home',
      current: '3 chemin corrigé, 99100 Fictiville',
      file: '2 rue Neuve, 99100 Fictiville',
    },
  ],
  replaced: [
    {
      memberProfileId: ID_A,
      name: 'Lucie Fictive',
      oldEmail: 'ancienne@exemple.fr',
      newEmail: 'nouvelle@exemple.fr',
    },
  ],
  designated: [
    {
      memberProfileId: ID_B,
      name: 'Marc Inventé',
      oldEmail: 'marc@exemple.fr',
      newEmail: null,
    },
  ],
  disabled: [
    {memberProfileId: ID_A, name: 'Lucie Fictive', email: 'extra@exemple.fr'},
  ],
  manual: [
    {
      memberProfileId: ID_B,
      name: 'Marc Inventé',
      holderEmail: 'marc@exemple.fr',
      file: 'autre@exemple.fr',
    },
  ],
  toCreate: [
    {line: 5, pennylaneCustomerId: 'c-inconnu', client: 'Nouveau Venu'},
  ],
  rejections: [{line: 6, client: 'Sans Nom', reason: 'invalid_postal_code'}],
}

const renderReport = (report: AnnualImportReportDTO) => {
  const onImportAnother = vi.fn()
  render(
    <AnnualImportReport
      report={report}
      fileName="clients-pennylane-2026.csv"
      associationName="Rives Vertes"
      importedAt="2026-11-26T10:00:00.000Z"
      onImportAnother={onImportAnother}
    />
  )
  return {onImportAnother}
}

const section = (name: RegExp) =>
  screen.getByRole('region', {name}) as HTMLElement

describe('AnnualImportReport — écran 2 (s56)', () => {
  it('2a : titre, bandeau, bilan et les huit sections décomptées', () => {
    renderReport(FULL)

    expect(
      screen.getByRole('heading', {level: 1, name: 'Rapport de mise à jour'})
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          (element.textContent ?? '').startsWith(
            'clients-pennylane-2026.csv · Rives Vertes · '
          )
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Mise à jour terminée : 2 fiches mises à jour.'
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '5 points à vérifier et 1 membre à créer à la main, détaillés ci-dessous.'
    )
    const summary = screen.getByRole('region', {name: 'Bilan'})
    expect(
      within(summary).getByText('Fiches mises à jour').nextSibling
    ).toHaveTextContent('2')

    for (const [title, count] of [
      [/^Fiches mises à jour/, 2],
      [/^Valeurs conservées, modifiées sur le site/, 1],
      [/^Adresses titulaires remplacées/, 1],
      [/^Titulaires désignées par le site/, 1],
      [/^Adresses qui ne sont plus actives/, 1],
      [/^Adresses à corriger à la main/, 1],
      [/^Membres à créer à la main/, 1],
      [/^Lignes rejetées/, 1],
    ] as const) {
      expect(
        within(section(title)).getByRole('heading', {level: 3})
      ).toHaveTextContent(`(${count})`)
    }
  })

  it('chaque nom de fiche est un lien vers la fiche', () => {
    renderReport(FULL)

    const updated = section(/^Fiches mises à jour/)
    expect(
      within(updated).getAllByRole('link', {name: 'Lucie Fictive'})[0]
    ).toHaveAttribute('href', `/bureau/proprietaires/${ID_A}`)
    expect(
      within(updated).getAllByText('Domicile, Adresses email')[0]
    ).toBeInTheDocument()
  })

  it('une désignation sans autre adresse active dit « courrier uniquement »', () => {
    renderReport(FULL)

    const designated = section(/^Titulaires désignées par le site/)
    expect(
      within(designated).getAllByText('Aucune adresse active')[0]
    ).toBeInTheDocument()
    expect(
      within(designated).getAllByText('Courrier uniquement')[0]
    ).toBeInTheDocument()
  })

  it('« Membres à créer à la main » porte un seul bouton d’ajout', () => {
    renderReport(FULL)

    const toCreate = section(/^Membres à créer à la main/)
    expect(
      within(toCreate).getByRole('link', {name: 'Ajouter un propriétaire'})
    ).toHaveAttribute('href', '/bureau/proprietaires/nouveau')
    expect(within(toCreate).getAllByText('c-inconnu')[0]).toBeInTheDocument()
  })

  it('les motifs de rejet sont ceux de s13', () => {
    renderReport(FULL)

    expect(
      within(section(/^Lignes rejetées/)).getAllByText(
        'Le code postal n’est pas valide.'
      )[0]
    ).toBeInTheDocument()
  })

  it('2b : réimport, « rien n’a changé », sections 1 à 6 à (0), membres à créer toujours listés', () => {
    renderReport({
      ...EMPTY,
      linesRead: 3,
      profilesUnchanged: 2,
      membersToCreate: 1,
      toCreate: FULL.toCreate,
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Rien n’a changé : les fiches ont déjà les coordonnées de ce fichier.'
    )
    const kept = section(/^Valeurs conservées/)
    expect(within(kept).getByRole('heading', {level: 3})).toHaveTextContent(
      '(0)'
    )
    expect(
      within(kept).getByText('Aucune valeur conservée.')
    ).toBeInTheDocument()
    expect(within(kept).queryByRole('table')).toBeNull()
    expect(
      within(section(/^Membres à créer à la main/)).getAllByText(
        'Nouveau Venu'
      )[0]
    ).toBeInTheDocument()
  })

  it('2c : aucune ligne utile, alerte « aucune fiche n’a été mise à jour »', () => {
    renderReport({
      ...EMPTY,
      linesRead: 2,
      membersToCreate: 1,
      linesRejected: 1,
      toCreate: FULL.toCreate,
      rejections: FULL.rejections,
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Aucune fiche n’a été mise à jour.'
    )
  })

  it('« Importer un autre fichier » revient au formulaire ; retour à la liste', async () => {
    const {onImportAnother} = renderReport(FULL)

    expect(
      screen.getByRole('link', {name: 'Retour aux propriétaires'})
    ).toHaveAttribute('href', '/bureau/proprietaires')
    await userEvent.click(
      screen.getByRole('button', {name: 'Importer un autre fichier'})
    )
    expect(onImportAnother).toHaveBeenCalled()
  })

  it('pagine à 25 lignes en tableau', async () => {
    renderReport({
      ...EMPTY,
      membersToCreate: 30,
      toCreate: Array.from({length: 30}, (_, index) => ({
        line: index + 2,
        pennylaneCustomerId: `c-${index}`,
        client: `Client ${index}`,
      })),
    })

    const table = within(section(/^Membres à créer à la main/)).getByRole(
      'table'
    )
    expect(within(table).getAllByRole('row')).toHaveLength(26)
  })
})
