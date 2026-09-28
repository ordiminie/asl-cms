import {beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, within} from '@/__tests__/customRender'
import {WaterAnalysisDTO} from '@/services/types/domain/water-analysis-types'

import {WaterAnalysisForm} from './water-analysis-form'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ANALYSIS_ID = '33333333-3333-4333-8333-333333333333'
const TODAY = '2026-09-02'

const analysis: WaterAnalysisDTO = {
  id: ANALYSIS_ID,
  organizationId: ORG_ID,
  sampledOn: '2026-09-02',
  posterKey: `${ORG_ID}/water-analysis/${ANALYSIS_ID}/poster-abc.png`,
  reportKey: `${ORG_ID}/water-analysis/${ANALYSIS_ID}/report-abc.pdf`,
  reportBytes: 327_680,
  content: 'Eau conforme.',
  createdAt: new Date('2026-09-02'),
  updatedAt: new Date('2026-09-02'),
}

const saveAction = vi.fn()
const deleteAction = vi.fn()

const poster = () =>
  new File([new Uint8Array([0x89, 0x50])], 'affiche.png', {type: 'image/png'})
const report = () =>
  new File([new Uint8Array([0x25, 0x50])], 'resultat.pdf', {
    type: 'application/pdf',
  })

const renderNew = () =>
  render(<WaterAnalysisForm today={TODAY} saveAction={saveAction} />)

const renderEdit = () =>
  render(
    <WaterAnalysisForm
      analysis={analysis}
      today={TODAY}
      saveAction={saveAction}
      deleteAction={deleteAction}
    />
  )

const formOf = (): HTMLFormElement => {
  const form = document.querySelector('form')
  if (!form) throw new Error('formulaire introuvable')
  return form
}

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({status: 'idle'})
  deleteAction.mockResolvedValue({status: 'idle'})
})

describe('WaterAnalysisForm — quatre champs, une soumission (critère 4)', () => {
  it("ne demande que la date, l'affiche, le texte et le PDF", () => {
    renderNew()

    const named = new Set(
      [...formOf().elements]
        .map((element) => (element as HTMLInputElement).name)
        .filter(Boolean)
    )
    expect([...named].sort()).toEqual(
      ['content', 'poster', 'report', 'sampledOn'].sort()
    )
    expect(screen.getByLabelText('Date du prélèvement')).toBeInTheDocument()
    expect(screen.getByLabelText('Affiche')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Texte/)).toBeInTheDocument()
    expect(screen.getByLabelText('Résultat complet (PDF)')).toBeInTheDocument()
  })

  it('ne propose aucun champ de texte alternatif', () => {
    renderNew()

    expect(screen.queryByLabelText(/texte alternatif/i)).toBeNull()
  })

  it('pré-remplit la date du jour et annonce les consignes avant tout dépôt', () => {
    renderNew()

    expect(screen.getByLabelText('Date du prélèvement')).toHaveValue(
      '02/09/2026'
    )
    expect(
      screen.getByText('PNG, JPEG ou WebP, 5 Mo au plus.')
    ).toBeInTheDocument()
    expect(screen.getByText('PDF, 10 Mo au plus.')).toBeInTheDocument()
  })

  it("dérive la description de l'affiche de la date saisie", async () => {
    const user = userEvent.setup()
    renderNew()

    await user.upload(screen.getByLabelText('Affiche'), poster())

    expect(
      screen.getByText(
        /Description pour les lecteurs d.écran : Affiche de l.analyse d.eau du 2 septembre 2026\./
      )
    ).toBeInTheDocument()
  })

  it('envoie les quatre champs et les deux fichiers en une seule soumission', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.upload(screen.getByLabelText('Affiche'), poster())
    await user.upload(screen.getByLabelText('Résultat complet (PDF)'), report())
    await user.type(screen.getByLabelText(/^Texte/), 'Eau conforme.')
    await user.click(screen.getByRole('button', {name: "Publier l'analyse"}))

    expect(saveAction).toHaveBeenCalledTimes(1)
    const formData = saveAction.mock.calls[0][1] as FormData
    expect(formData.get('sampledOn')).toBe('2026-09-02')
    expect(formData.get('content')).toBe('Eau conforme.')
    expect((formData.get('poster') as File).name).toBe('affiche.png')
    expect((formData.get('report') as File).name).toBe('resultat.pdf')
  })
})

describe('WaterAnalysisForm — compteur du texte (§3.9)', () => {
  it("reste neutre jusqu'à 500 caractères inclus", async () => {
    const user = userEvent.setup()
    renderNew()

    const textarea = screen.getByLabelText(/^Texte/)
    await user.click(textarea)
    await user.paste('a'.repeat(500))

    const counter = screen.getByText('500 / 500')
    expect(counter).not.toHaveClass('text-destructive-text')
    expect(screen.queryByText(/Caractères en trop/)).toBeNull()
  })

  it('vire au rouge au-delà, avec un message écrit', async () => {
    const user = userEvent.setup()
    renderNew()

    const textarea = screen.getByLabelText(/^Texte/)
    await user.click(textarea)
    await user.paste('a'.repeat(501))

    expect(screen.getByText('501 / 500')).toHaveClass('text-destructive-text')
    expect(screen.getByText('Caractères en trop : 1.')).toBeInTheDocument()
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('WaterAnalysisForm — erreurs', () => {
  it('refuse une date future sous le champ et dans le résumé ancré', async () => {
    const user = userEvent.setup()
    renderNew()

    const date = screen.getByLabelText('Date du prélèvement')
    await user.clear(date)
    await user.type(date, '12092026')
    await user.upload(screen.getByLabelText('Affiche'), poster())
    await user.upload(screen.getByLabelText('Résultat complet (PDF)'), report())
    await user.click(screen.getByRole('button', {name: "Publier l'analyse"}))

    expect(saveAction).not.toHaveBeenCalled()

    const message = 'La date du prélèvement ne peut pas être dans le futur.'
    expect(date).toHaveAccessibleDescription(expect.stringContaining(message))

    const summary = screen.getByRole('alert')
    const link = within(summary).getByRole('link', {name: new RegExp(message)})
    expect(link).toHaveAttribute('href', `#${date.id}`)
  })

  it('une ancre par champ fautif', async () => {
    const user = userEvent.setup()
    renderNew()

    await user.click(screen.getByRole('button', {name: "Publier l'analyse"}))

    const links = within(screen.getByRole('alert')).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `#${screen.getByLabelText('Affiche').id}`,
      `#${screen.getByLabelText('Résultat complet (PDF)').id}`,
    ])
  })

  it('affiche sous le bon champ un refus rendu par le serveur', async () => {
    saveAction.mockResolvedValue({
      status: 'rejected',
      issues: ['report_format'],
    })
    const user = userEvent.setup()
    renderNew()

    await user.upload(screen.getByLabelText('Affiche'), poster())
    await user.upload(screen.getByLabelText('Résultat complet (PDF)'), report())
    await user.click(screen.getByRole('button', {name: "Publier l'analyse"}))

    expect(
      await screen.findAllByText('Le résultat doit être un fichier PDF.')
    ).toHaveLength(2)
  })
})

describe("WaterAnalysisForm — correction d'une analyse en ligne", () => {
  it('annonce que la correction est immédiatement visible', () => {
    renderEdit()

    expect(
      screen.getByText(/Cette analyse est en ligne/).closest('[role="status"]')
    ).not.toBeNull()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Analyse du 2 septembre 2026',
      })
    ).toBeInTheDocument()
  })

  it('propose de remplacer les fichiers, jamais de les retirer', () => {
    renderEdit()

    expect(
      screen.getByRole('button', {name: "Remplacer l'affiche"})
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Remplacer le PDF'})
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /Retirer/})).toBeNull()
  })

  it('le dialogue de suppression nomme la date et le caractère définitif', async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(screen.getByRole('button', {name: "Supprimer l'analyse"}))

    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText("Supprimer l'analyse du 2 septembre 2026 ?")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Cette action est définitive.')
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', {name: "Supprimer l'analyse"})
    )
    expect(deleteAction).toHaveBeenCalledWith(ANALYSIS_ID)
  })
})
