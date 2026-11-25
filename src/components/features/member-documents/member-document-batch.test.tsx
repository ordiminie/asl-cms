import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'

import {MemberDocumentBatch} from './member-document-batch'

const REF_A = '3f2a9c10-1b2c-4d3e-8f40-5a6b7c8d9e0f'
const REF_B = '7c1d2e3f-4a5b-4c6d-8e7f-901a2b3c4d5e'
const PROFILE_A = 'a1200000-0000-4000-8000-000000000008'
const PROFILE_B = 'a1200000-0000-4000-8000-000000000009'
const CATEGORIES: PublicCategoryDTO[] = [
  {id: '44444444-4444-4444-8444-444444444444', name: 'Facture'},
]

const batchAction = vi.fn()

const pdf = (name: string) =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: 'application/pdf',
  })

const renderBatch = (
  props: Partial<Parameters<typeof MemberDocumentBatch>[0]> = {}
) =>
  render(
    <MemberDocumentBatch
      categories={CATEGORIES}
      today="2026-11-25"
      reach={{profilesWithReference: 2, profilesWithoutReference: 3}}
      batchAction={batchAction}
      {...props}
    />
  )

const fillCommonFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(
    screen.getByRole('textbox', {name: 'Titre des documents'}),
    'Facture 2026'
  )
  await user.click(screen.getByRole('combobox', {name: 'Catégorie'}))
  await user.click(screen.getByRole('option', {name: 'Facture'}))
}

const files = () => [
  pdf(`${REF_A}_facture.pdf`),
  pdf('c9999_facture.pdf'),
  pdf(`${REF_B}_facture.pdf`),
]

const deposited = (fileName: string, profileId: string, name: string) => ({
  status: 'deposited',
  fileName,
  memberProfileId: profileId,
  memberProfileName: name,
  parcelNumbers: ['61'],
  meterNumber: null,
})

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  batchAction.mockImplementation(async (formData: FormData) => {
    const file = formData.get('file') as File
    if (file.name.startsWith(REF_A)) {
      return deposited(file.name, PROFILE_A, 'Bernard Lefèvre')
    }
    if (file.name.startsWith(REF_B)) {
      return deposited(file.name, PROFILE_B, 'SCI Les Pins')
    }
    return {
      status: 'rejected',
      fileName: file.name,
      reason: 'unknown_reference',
      reference: 'c9999',
    }
  })
})

describe('MemberDocumentBatch — écran 5 du design s32 (critère 7)', () => {
  it('5a : la règle de nommage est écrite avant tout, avec la vraie forme de l’identifiant', () => {
    renderBatch()

    expect(
      screen.getByText(/Chaque fichier trouve sa fiche par son nom\./)
    ).toHaveTextContent('3f2a…_facture-2026.pdf')
    expect(
      screen.getByText(/il n’est jamais déposé sur une autre fiche/)
    ).toBeInTheDocument()
  })

  it('5b : sans fichier, rien ne part', async () => {
    const user = userEvent.setup()
    renderBatch()

    await fillCommonFields(user)
    await user.click(screen.getByRole('button', {name: /Déposer/}))

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(
      'Le lot n’est pas parti. Rien n’est perdu.'
    )
    expect(summary).toHaveTextContent('Choisissez au moins un fichier.')
    expect(batchAction).not.toHaveBeenCalled()
  })

  it('envoie un fichier par appel, l’un après l’autre, avec les champs communs', async () => {
    const user = userEvent.setup()
    const resolvers: Array<() => void> = []
    batchAction.mockImplementation(
      (formData: FormData) =>
        new Promise((resolve) => {
          const file = formData.get('file') as File
          resolvers.push(() =>
            resolve(deposited(file.name, PROFILE_A, 'Bernard Lefèvre'))
          )
        })
    )
    renderBatch()

    await fillCommonFields(user)
    await user.upload(screen.getByLabelText('Fichiers'), files())
    await user.click(
      screen.getByRole('button', {name: 'Déposer les 3 documents'})
    )

    await waitFor(() => expect(batchAction).toHaveBeenCalledTimes(1))
    const first = batchAction.mock.calls[0][0] as FormData
    expect((first.get('file') as File).name).toBe(`${REF_A}_facture.pdf`)
    expect(first.getAll('file')).toHaveLength(1)
    expect(first.get('title')).toBe('Facture 2026')
    expect(first.get('categoryId')).toBe(CATEGORIES[0].id)
    expect(first.get('documentDate')).toBe('2026-11-25')
    expect(screen.getByText('0 fichiers traités sur 3')).toBeInTheDocument()

    await act(async () => resolvers[0]())
    await waitFor(() => expect(batchAction).toHaveBeenCalledTimes(2))
    expect(
      ((batchAction.mock.calls[1][0] as FormData).get('file') as File).name
    ).toBe('c9999_facture.pdf')

    await act(async () => resolvers[1]())
    await waitFor(() => expect(batchAction).toHaveBeenCalledTimes(3))
    await act(async () => resolvers[2]())

    expect(await screen.findByText(/Lot terminé/)).toBeInTheDocument()
  })

  it('pendant l’envoi, quitter la page est retenu', async () => {
    const user = userEvent.setup()
    batchAction.mockImplementation(() => new Promise(() => {}))
    renderBatch()

    await fillCommonFields(user)
    await user.upload(screen.getByLabelText('Fichiers'), files())
    await user.click(screen.getByRole('button', {name: /Déposer les 3/}))
    await waitFor(() => expect(batchAction).toHaveBeenCalled())

    expect(
      screen.getByText(/Restez sur cette page jusqu’à la fin/)
    ).toBeInTheDocument()
    const leaving = new Event('beforeunload', {cancelable: true})
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(true)
  })

  it('5d : rapport fidèle au serveur, écartés en tête, raison écrite, fiche des déposés', async () => {
    const user = userEvent.setup()
    renderBatch()

    await fillCommonFields(user)
    await user.upload(screen.getByLabelText('Fichiers'), files())
    await user.click(screen.getByRole('button', {name: /Déposer les 3/}))

    expect(
      await screen.findByText(/Lot terminé : 2 documents déposés, 1 écarté\./)
    ).toBeInTheDocument()
    const table = screen.getByRole('table', {
      name: 'Rapport du lot, fichiers écartés en tête',
    })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('c9999_facture.pdf')
    expect(rows[0]).toHaveTextContent('Écarté')
    expect(rows[0]).toHaveTextContent(
      'Aucune fiche ne porte l’identifiant c9999.'
    )
    expect(rows[1]).toHaveTextContent('Déposé')
    expect(
      within(rows[1]).getByRole('link', {name: 'Bernard Lefèvre'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_A}`)
    expect(
      within(rows[2]).getByRole('link', {name: 'SCI Les Pins'})
    ).toHaveAttribute('href', `/bureau/proprietaires/${PROFILE_B}`)
    expect(
      screen.getByText(
        'Ce rapport n’est pas conservé : notez les fichiers écartés avant de quitter la page.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/3 fiches n’ont pas d’identifiant client Pennylane/)
    ).toBeInTheDocument()
  })

  it('référence portée par plusieurs fiches : la ligne est écartée avec sa raison, sans fiche', async () => {
    const user = userEvent.setup()
    batchAction.mockImplementation(async (formData: FormData) => ({
      status: 'rejected',
      fileName: (formData.get('file') as File).name,
      reason: 'ambiguous_reference',
      reference: REF_A,
    }))
    renderBatch()

    await fillCommonFields(user)
    await user.upload(screen.getByLabelText('Fichiers'), [
      pdf(`${REF_A}_facture.pdf`),
    ])
    await user.click(screen.getByRole('button', {name: /Déposer/}))

    const table = await screen.findByRole('table', {
      name: 'Rapport du lot, fichiers écartés en tête',
    })
    const [row] = within(table).getAllByRole('row').slice(1)
    expect(row).toHaveTextContent('Écarté')
    expect(row).toHaveTextContent(
      `Plusieurs fiches portent l’identifiant ${REF_A} : le fichier n’a été rattaché à aucune.`
    )
    expect(within(row).queryByRole('link')).not.toBeInTheDocument()
  })

  it('un envoi en échec n’arrête pas le lot : la ligne est dite, les suivantes partent', async () => {
    const user = userEvent.setup()
    batchAction
      .mockRejectedValueOnce(new Error('réseau'))
      .mockImplementation(async (formData: FormData) => {
        const file = formData.get('file') as File
        return deposited(file.name, PROFILE_B, 'SCI Les Pins')
      })
    renderBatch()

    await fillCommonFields(user)
    await user.upload(screen.getByLabelText('Fichiers'), files())
    await user.click(screen.getByRole('button', {name: /Déposer les 3/}))

    expect(await screen.findByText(/Lot terminé/)).toBeInTheDocument()
    expect(batchAction).toHaveBeenCalledTimes(3)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent(`${REF_A}_facture.pdf`)
    expect(rows[0]).toHaveTextContent('Ce fichier n’a pas pu être envoyé.')
  })

  it('5e : aucune fiche atteignable, le formulaire n’est pas proposé', () => {
    renderBatch({
      reach: {profilesWithReference: 0, profilesWithoutReference: 4},
    })

    expect(
      screen.getByText('Aucune fiche ne porte d’identifiant client Pennylane.')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Fichiers')).toBeNull()
  })

  it('sans catégorie active, le formulaire n’est pas proposé', () => {
    renderBatch({categories: []})

    expect(
      screen.getByText('Aucune catégorie de document nominatif.')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Fichiers')).toBeNull()
  })
})
