import {describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {AssociationIdentityFormState} from '@/app/[locale]/(bureau)/bureau/identite/actions'

import {
  AssociationIdentityCard,
  AssociationIdentityUploadAction,
} from './association-identity-card'

const VERSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NEW_VERSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const pngFile = (size = 2048, name = 'logo-les-pins.png') =>
  new File([new Uint8Array(size)], name, {type: 'image/png'})

const deferred = () => {
  let settle: (state: AssociationIdentityFormState) => void = () => {}
  const promise = new Promise<AssociationIdentityFormState>((resolve) => {
    settle = resolve
  })
  return {promise, resolve: settle}
}

const chooseFile = async (file: File) => {
  const input = screen.getByTestId('identity-file-input-logo')
  await userEvent.upload(input, file)
}

const logoCard = (
  uploadAction: AssociationIdentityUploadAction = vi.fn(
    async (): Promise<AssociationIdentityFormState> => ({success: true})
  ),
  version?: string
) =>
  render(
    <AssociationIdentityCard
      kind="logo"
      associationName="ASL Les Pins"
      version={version}
      uploadAction={uploadAction}
    />
  )

describe('AssociationIdentityCard — vide', () => {
  it('montre le monogramme, le dit, et annonce les consignes avant tout echec', () => {
    logoCard()

    expect(
      screen.getByRole('heading', {level: 3, name: 'Logo'})
    ).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Monogramme/})).toHaveTextContent(
      'LP'
    )
    expect(
      screen.getByText(
        "Aucun logo pour l'instant : le monogramme de l'association est affiché à sa place."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/PNG ou WebP, fond transparent/)
    ).toBeInTheDocument()
    expect(screen.getByText(/1 Mo maximum/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Choisir un fichier'})
    ).toBeEnabled()
  })

  it('le favicon vide s affiche dans l onglet stylise, servi par la route', () => {
    render(
      <AssociationIdentityCard
        kind="favicon"
        associationName="ASL Les Pins"
        uploadAction={vi.fn()}
      />
    )

    expect(
      screen.getByText(/La petite icône affichée dans l'onglet du navigateur/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Aucun favicon pour l'instant : le monogramme de l'association s'affiche dans l'onglet."
      )
    ).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/api/identity/favicon'
    )
    expect(screen.getByText(/PNG ou ICO/)).toBeInTheDocument()
    expect(screen.getByText(/200 Ko maximum/)).toBeInTheDocument()
  })
})

describe('AssociationIdentityCard — chargement', () => {
  it('annonce l envoi, desactive le bouton et garde l apercu actuel', async () => {
    const pending = deferred()
    logoCard(
      vi.fn(() => pending.promise),
      VERSION
    )

    await chooseFile(pngFile())

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('Envoi de logo-les-pins.png')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Envoi en cours…'})).toBeDisabled()
    expect(screen.getByRole('img', {name: /Logo/})).toHaveAttribute(
      'src',
      `/api/identity/logo?v=${VERSION}`
    )

    pending.resolve({
      success: true,
      kind: 'logo',
      message: 'ok',
      version: NEW_VERSION,
    })
    await waitFor(() =>
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    )
  })

  it('transmet le type et le fichier a l action', async () => {
    const uploadAction = vi.fn<AssociationIdentityUploadAction>(async () => ({
      success: true,
    }))
    logoCard(uploadAction)

    await chooseFile(pngFile())

    await waitFor(() => expect(uploadAction).toHaveBeenCalled())
    const formData = uploadAction.mock.calls[0][1]
    expect(formData.get('kind')).toBe('logo')
    expect((formData.get('file') as File).name).toBe('logo-les-pins.png')
  })
})

describe('AssociationIdentityCard — erreur', () => {
  it('ancre l erreur dans la carte : ce qui s est passe, ce qui est conserve, la suite', async () => {
    logoCard(
      vi.fn(async () => ({
        success: false,
        kind: 'logo' as const,
        title: "Ce fichier n'a pas été enregistré.",
        message: "Le format JPEG n'est pas accepté.",
        kept: 'Le logo actuel est conservé.',
        nextStep: 'Choisissez un fichier PNG ou WebP.',
      })),
      VERSION
    )

    await chooseFile(pngFile())

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText("Ce fichier n'a pas été enregistré.")
    ).toBeInTheDocument()
    expect(
      within(alert).getByText(/Le format JPEG n'est pas accepté/)
    ).toBeInTheDocument()
    expect(
      within(alert).getByText('Le logo actuel est conservé.').tagName
    ).toBe('STRONG')
    expect(
      within(alert).getByText(/Choisissez un fichier PNG ou WebP/)
    ).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Logo/})).toHaveAttribute(
      'src',
      `/api/identity/logo?v=${VERSION}`
    )
  })

  it('refuse un fichier trop lourd sans l envoyer, avec son poids et la limite', async () => {
    const uploadAction = vi.fn()
    logoCard(uploadAction)

    await chooseFile(pngFile(Math.round(3.2 * 1024 * 1024), 'enorme.png'))

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText("Ce fichier n'a pas été enregistré.")
    ).toBeInTheDocument()
    expect(
      within(alert).getByText(/Il pèse 3,2 Mo, la limite est 1 Mo/)
    ).toBeInTheDocument()
    expect(
      within(alert).getByText("Le monogramme de l'association reste affiché.")
    ).toBeInTheDocument()
    expect(uploadAction).not.toHaveBeenCalled()
  })

  it('rend un echec d appel comme une erreur ancree, jamais une exception', async () => {
    logoCard(
      vi.fn(async () => {
        throw new Error('Body exceeded 1mb limit')
      }),
      VERSION
    )

    await chooseFile(pngFile())

    const alert = await screen.findByRole('alert')
    expect(
      within(alert).getByText("L'envoi n'a pas abouti.", {exact: false})
    ).toBeInTheDocument()
    expect(
      within(alert).getByText('Le logo actuel est conservé.')
    ).toBeInTheDocument()
  })
})

describe('AssociationIdentityCard — succes', () => {
  it('confirme dans la carte et montre le nouveau fichier', async () => {
    logoCard(
      vi.fn(async () => ({
        success: true,
        kind: 'logo' as const,
        message: 'Logo remplacé. Visible sur votre site et dans cet espace.',
        version: NEW_VERSION,
      })),
      VERSION
    )

    await chooseFile(pngFile())

    expect(
      await screen.findByText(
        'Logo remplacé. Visible sur votre site et dans cet espace.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('img', {name: /Logo/})).toHaveAttribute(
      'src',
      `/api/identity/logo?v=${NEW_VERSION}`
    )
    expect(
      screen.queryByText(/Aucun logo pour l'instant/)
    ).not.toBeInTheDocument()
  })
})

describe('AssociationIdentityCard — boutons', () => {
  it('n affiche aucun bouton default : choisir un fichier lance l envoi', () => {
    logoCard()

    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveClass('bg-primary')
    }
  })
})
