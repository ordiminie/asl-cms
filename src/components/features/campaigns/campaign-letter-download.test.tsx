import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {render, screen, userEvent, waitFor} from '@/__tests__/customRender'

import {CampaignLetterDownload} from './campaign-letter-download'

const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'

const fetchMock = vi.fn()
const createObjectURL = vi.fn(() => 'blob:courrier')
const revokeObjectURL = vi.fn()

const pdfResponse = () =>
  new Response('%PDF', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="courrier-12-11-2026.pdf"',
    },
  })

beforeEach(() => {
  fetchMock.mockReset()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  fetchMock.mockResolvedValue(pdfResponse())
  vi.stubGlobal('fetch', fetchMock)
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderDownload = (hasHomonyms = true) =>
  render(
    <CampaignLetterDownload
      campaignId={CAMPAIGN_ID}
      homonymGroups={
        hasHomonyms
          ? [
              {
                name: 'Marcel Laurent',
                profileCount: 2,
                parcelNumbers: ['14', '27'],
              },
            ]
          : []
      }
      profileCount={4}
    />
  )

const download = () =>
  screen.getByRole('button', {name: 'Télécharger le PDF du courrier'})

describe('CampaignLetterDownload — le choix et le téléchargement (s28)', () => {
  it('aucune option présélectionnée : rien n’est regroupé d’office (critère 2)', () => {
    renderDownload()

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(
      screen.getByText('Elle cite toutes ses parcelles : « 14 et 27 ».')
    ).toBeInTheDocument()
  })

  it('choix manquant : rien n’est demandé, résumé ancré qui prend le focus, erreur de champ', async () => {
    renderDownload()

    await userEvent.click(download())

    expect(fetchMock).not.toHaveBeenCalled()
    const summary = screen.getByRole('alert')
    expect(summary).toHaveTextContent('Le PDF n’a pas été préparé.')
    expect(summary).toHaveTextContent('Rien n’a été regroupé.')
    await waitFor(() => expect(summary).toHaveFocus())
    const anchor = screen.getByRole('link', {
      name: 'Choisissez une lettre par personne ou une lettre par terrain.',
    })
    const group = screen.getByRole('radiogroup')
    expect(anchor).toHaveAttribute('href', `#${group.id}`)
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('Choisissez une des deux options.')
    ).toBeInTheDocument()
    expect(download()).toBeEnabled()
  })

  it('une seule lettre par personne : demande le PDF regroupé, puis le télécharge', async () => {
    renderDownload()

    await userEvent.click(
      screen.getByLabelText('Une seule lettre par personne')
    )
    await userEvent.click(download())

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaigns/${CAMPAIGN_ID}/courrier?lettres=par-personne`
    )
    const success = await screen.findByRole('status')
    expect(success).toHaveTextContent(
      'PDF prêt : 3 lettres, une par page (une seule pour Marcel Laurent). Le téléchargement a commencé dans votre navigateur.'
    )
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:courrier')
  })

  it('une lettre par terrain : une lettre par fiche', async () => {
    renderDownload()

    await userEvent.click(screen.getByLabelText('Une lettre par terrain'))
    await userEvent.click(download())

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaigns/${CAMPAIGN_ID}/courrier?lettres=par-terrain`
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'PDF prêt : 4 lettres, une par page. Le téléchargement a commencé dans votre navigateur.'
    )
  })

  it('sans homonymes : ni choix ni paramètre, téléchargement direct', async () => {
    renderDownload(false)

    expect(screen.queryByRole('radiogroup')).toBeNull()
    await userEvent.click(download())

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaigns/${CAMPAIGN_ID}/courrier`
    )
  })

  it('chargement : bouton désactivé, « Préparation du PDF… »', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    renderDownload(false)

    await userEvent.click(download())

    const busy = screen.getByRole('button', {name: 'Préparation du PDF…'})
    expect(busy).toBeDisabled()
  })

  it('erreur : alerte sous le bouton, rien n’a été envoyé ni modifié', async () => {
    fetchMock.mockResolvedValue(new Response(null, {status: 500}))
    renderDownload(false)

    await userEvent.click(download())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le PDF n’a pas pu être préparé. Rien n’a été envoyé ni modifié.'
    )
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
