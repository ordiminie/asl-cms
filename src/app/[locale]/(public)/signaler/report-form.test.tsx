import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'

vi.mock('./actions', () => ({submitReportAction: vi.fn()}))

import {submitReportAction} from './actions'
import {ReportForm} from './report-form'

const CATEGORY_ID = '44444444-4444-4444-8444-444444444444'
const CATEGORIES = [
  {id: CATEGORY_ID, name: "Fuite d'eau"},
  {id: '66666666-6666-4666-8666-666666666666', name: 'Voirie et chemins'},
]

const categoryField = () =>
  screen.getByRole('combobox', {name: 'De quoi s’agit-il ?'})
const locationField = () => screen.getByRole('textbox', {name: 'Où ?'})
const descriptionField = () =>
  screen.getByRole('textbox', {name: 'Que se passe-t-il ?'})
const nameField = () => screen.getByRole('textbox', {name: /Votre nom/})
const emailField = () =>
  screen.getByRole('textbox', {name: /Votre adresse email/})
const phoneField = () => screen.getByRole('textbox', {name: /Votre téléphone/})
const submitButton = () =>
  screen.getByRole('button', {name: 'Envoyer le signalement'})

beforeAll(() => {
  // Radix Select s'appuie sur des API de pointeur absentes de jsdom.
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(submitReportAction).mockResolvedValue({
    status: 'sent',
    recontact: {},
  })
})

describe('ReportForm — écran 1 du design s10', () => {
  it('présente le bandeau 112 et les champs dans l’ordre du design, coordonnées facultatives', () => {
    render(<ReportForm categories={CATEGORIES} />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Signaler une fuite ou un incident',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/En cas de danger immédiat, appelez les secours \(112\)/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {level: 3, name: 'Vos coordonnées'})
    ).toBeInTheDocument()

    const order = [
      categoryField(),
      locationField(),
      descriptionField(),
      nameField(),
      emailField(),
      phoneField(),
    ]
    for (let index = 1; index < order.length; index++) {
      expect(
        order[index - 1].compareDocumentPosition(order[index]) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    }

    expect(descriptionField().tagName).toBe('TEXTAREA')
    expect(nameField()).toHaveAttribute('autocomplete', 'name')
    expect(emailField()).toHaveAttribute('type', 'email')
    expect(emailField()).toHaveAttribute('inputmode', 'email')
    expect(emailField()).toHaveAttribute('autocomplete', 'email')
    expect(phoneField()).toHaveAttribute('type', 'tel')
    expect(phoneField()).toHaveAttribute('inputmode', 'tel')
    expect(phoneField()).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getAllByText('Facultatif')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('propose les catégories de l’association dans le select', async () => {
    const user = userEvent.setup()
    render(<ReportForm categories={CATEGORIES} />)

    await user.click(categoryField())

    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(["Fuite d'eau", 'Voirie et chemins'])
  })

  it('refuse un envoi invalide : résumé focalisé à trois liens, message sous chaque champ', async () => {
    const user = userEvent.setup()
    render(<ReportForm categories={CATEGORIES} />)

    await user.type(locationField(), 'Chemin des Pins, parcelle 47')
    await user.type(emailField(), 'p.ferrand@example')
    await user.click(submitButton())

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Le signalement n’a pas été envoyé.')
    await waitFor(() => expect(summary).toHaveFocus())
    expect(summary).toHaveAttribute('tabindex', '-1')
    const links = within(summary).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'De quoi s’agit-il ?',
      'Que se passe-t-il ?',
      'Votre adresse email',
    ])
    expect(links[2].getAttribute('href')).toBe(
      `#${emailField().closest('[data-slot="form-item"]')?.id}`
    )

    expect(categoryField()).toHaveAttribute('aria-invalid', 'true')
    expect(descriptionField()).toHaveAttribute('aria-invalid', 'true')
    expect(emailField()).toHaveAttribute('aria-invalid', 'true')
    expect(locationField()).toHaveAttribute('aria-invalid', 'false')
    expect(
      screen.getByText('Choisissez ce que vous signalez.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Décrivez ce que vous voyez avant d’envoyer.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Cette adresse semble incomplète. Corrigez-la, ou laissez le champ vide.'
      )
    ).toBeInTheDocument()
    expect(submitReportAction).not.toHaveBeenCalled()
  })

  it('envoie la catégorie choisie et les champs saisis', async () => {
    const user = userEvent.setup()
    render(<ReportForm categories={CATEGORIES} />)

    await user.click(categoryField())
    await user.click(screen.getByRole('option', {name: "Fuite d'eau"}))
    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    await waitFor(() => expect(submitReportAction).toHaveBeenCalled())
    const [, formData] = vi.mocked(submitReportAction).mock.calls[0]
    expect(formData.get('categoryId')).toBe(CATEGORY_ID)
    expect(formData.get('location')).toBe('Chemin des Pins')
    expect(formData.get('description')).toBe('Ça coule fort.')
    expect(formData.get('locale')).toBe('fr')
  })

  it('confirme en alert neutre et rappelle le numéro laissé (1.C)', async () => {
    vi.mocked(submitReportAction).mockResolvedValue({
      status: 'sent',
      recontact: {phone: '06 12 34 56 78'},
    })
    const user = userEvent.setup()
    render(<ReportForm categories={[]} />)

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.type(phoneField(), '06 12 34 56 78')
    await user.click(submitButton())

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(
      'Signalement envoyé. Le bureau de l’association l’a reçu.'
    )
    expect(status).toHaveTextContent(
      'Il pourra vous recontacter au 06 12 34 56 78.'
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByRole('button', {name: 'Signaler autre chose'})
    ).toBeInTheDocument()
  })

  it('dit que le bureau ne pourra pas recontacter sans coordonnées (1.F)', async () => {
    const user = userEvent.setup()
    render(<ReportForm categories={[]} />)

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Vous n’avez pas laissé de coordonnées : le bureau ne pourra pas vous tenir informé.'
    )
  })

  it('refuse au-delà du seuil en gardant le texte saisi (1.G)', async () => {
    vi.mocked(submitReportAction).mockResolvedValue({
      status: 'rate_limited',
      limit: 3,
    })
    const user = userEvent.setup()
    render(<ReportForm categories={[]} />)

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort depuis ce matin.')
    await user.click(submitButton())

    const refusal = await screen.findByRole('alert')
    expect(refusal).toHaveTextContent('Ce formulaire en accepte 3 par heure.')
    expect(refusal).toHaveTextContent('Votre texte est conservé.')
    await waitFor(() => expect(refusal).toHaveFocus())
    expect(descriptionField()).toHaveValue('Ça coule fort depuis ce matin.')
    expect(locationField()).toHaveValue('Chemin des Pins')
  })

  it('rend sous leur champ les erreurs renvoyées par le serveur', async () => {
    vi.mocked(submitReportAction).mockResolvedValue({
      status: 'invalid',
      errors: [{field: 'phone', message: 'Numéro refusé par le serveur.'}],
    })
    const user = userEvent.setup()
    render(<ReportForm categories={[]} />)

    await user.type(locationField(), 'Chemin des Pins')
    await user.type(descriptionField(), 'Ça coule fort.')
    await user.click(submitButton())

    expect(
      await screen.findByText('Numéro refusé par le serveur.')
    ).toBeInTheDocument()
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('sans catégorie, le champ disparaît et le formulaire commence par « Où ? » (1.H)', () => {
    render(<ReportForm categories={[]} />)

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('De quoi s’agit-il ?')).toBeNull()
    expect(locationField()).toBeInTheDocument()
  })
})
