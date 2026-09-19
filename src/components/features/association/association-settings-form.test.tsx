import {NextIntlClientProvider} from 'next-intl'
import {ReactNode} from 'react'
import {describe, expect, it, vi} from 'vitest'

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {AssociationSettingsFormState} from '@/app/[locale]/(bureau)/bureau/reglages/actions'
import {
  ASSOCIATION_SETTINGS_TEST_MESSAGES,
  TEST_SETTINGS_REGISTRY,
} from '@/services/__tests__/association-settings-test-registry'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  CONTACT_EMAIL_SETTING_KEY,
  FORAGE_EMAIL_SETTING_KEY,
  getSettingsForPage,
  resolveSettings,
} from '@/services/types/domain/association-settings-types'

import messages from '../../../../messages/fr.json'
import {
  AssociationSettingsForm,
  AssociationSettingsSaveAction,
} from './association-settings-form'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const CONTACT = 'contact@asl-les-pins.test'

const saved = (): AssociationSettingsSaveAction =>
  vi.fn(async (): Promise<AssociationSettingsFormState> => ({
    success: true,
    message:
      'Réglages enregistrés. Les prochains messages partiront vers ces adresses.',
  }))

const productionForm = (
  saveAction: AssociationSettingsSaveAction = saved(),
  rows = [{key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT}]
) =>
  render(
    <AssociationSettingsForm
      definitions={getSettingsForPage(
        ASSOCIATION_SETTINGS_REGISTRY,
        'settings'
      )}
      settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)}
      saveAction={saveAction}
    />
  )

const withTestMessages = ({children}: {children: ReactNode}) => (
  <NextIntlClientProvider
    locale="fr"
    messages={{
      ...messages,
      AssociationSettings: {
        ...messages.AssociationSettings,
        ...ASSOCIATION_SETTINGS_TEST_MESSAGES,
      },
    }}
  >
    {children}
  </NextIntlClientProvider>
)

const testRegistryForm = (
  saveAction: AssociationSettingsSaveAction = saved()
) =>
  render(
    <AssociationSettingsForm
      definitions={getSettingsForPage(TEST_SETTINGS_REGISTRY, 'settings')}
      settings={resolveSettings(TEST_SETTINGS_REGISTRY, [
        {key: 'test.required_email', value: 'secretariat@asl.test'},
      ])}
      saveAction={saveAction}
    />,
    {wrapper: withTestMessages}
  )

const contactField = () => screen.getByLabelText('Adresse de contact')
const forageField = () => screen.getByLabelText(/Adresse du responsable forage/)
const submit = () =>
  userEvent.click(
    screen.getByRole('button', {name: 'Enregistrer les réglages'})
  )

describe('AssociationSettingsForm — rendu genere par le registre (critere 2)', () => {
  it('rend une cle de chaque type du registre de test, sans modification du composant', () => {
    testRegistryForm()

    expect(screen.getByLabelText('Adresse du secrétariat')).toHaveAttribute(
      'type',
      'email'
    )
    expect(screen.getByLabelText(/Adresse du trésorier/)).toHaveAttribute(
      'type',
      'email'
    )

    const number = screen.getByLabelText(/Délai avant relance/)
    expect(number).toHaveAttribute('inputmode', 'numeric')
    expect(number).toHaveClass('font-mono', 'tabular-nums')
    expect(screen.getByText('jours')).toBeInTheDocument()

    expect(
      screen.getByRole('checkbox', {name: /Relances activées/})
    ).not.toBeChecked()

    const few = screen.getByRole('radiogroup', {name: /Fréquence du bulletin/})
    expect(within(few).getAllByRole('radio')).toHaveLength(3)
    expect(within(few).getByRole('radio', {name: 'Chaque mois'})).toBeChecked()

    expect(
      screen.getByRole('combobox', {name: /Secteur de rattachement/})
    ).toBeInTheDocument()

    expect(
      screen.queryByText('Réglage de la page Identité')
    ).not.toBeInTheDocument()
  })

  it('ecrit « facultatif » en clair sur les seuls reglages facultatifs', () => {
    productionForm()

    expect(contactField().closest('[data-setting]')).not.toHaveTextContent(
      'facultatif'
    )
    expect(forageField().closest('[data-setting]')).toHaveTextContent(
      'Adresse du responsable forage — facultatif'
    )
  })

  it('refuse un nombre non conforme au blur, avec un message explicite', async () => {
    testRegistryForm()

    const number = screen.getByLabelText(/Délai avant relance/)
    await userEvent.type(number, '400')
    await userEvent.tab()

    expect(
      await screen.findByText('La valeur est trop grande : le maximum est 365.')
    ).toBeInTheDocument()
    expect(number).toHaveAttribute('aria-invalid', 'true')
  })

  it('envoie chaque type sous sa cle, booleen et choix compris', async () => {
    const saveAction = saved()
    testRegistryForm(saveAction)

    await userEvent.type(screen.getByLabelText(/Délai avant relance/), '12')
    await userEvent.click(
      screen.getByRole('checkbox', {name: /Relances activées/})
    )
    await userEvent.click(screen.getByRole('radio', {name: 'Chaque semaine'}))
    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get('test.required_email')).toBe('secretariat@asl.test')
    expect(formData.get('test.number')).toBe('12')
    expect(formData.get('test.boolean')).toBe('true')
    expect(formData.get('test.choice_few')).toBe('weekly')
  })
})

describe('AssociationSettingsForm — etats de la page « Reglages »', () => {
  it('forage non renseigne : le champ est vide et dit ou partent les signalements', () => {
    productionForm()

    expect(contactField()).toHaveValue(CONTACT)
    expect(forageField()).toHaveValue('')
    expect(
      screen.getByText(
        `Vide : les signalements de fuite partent vers ${CONTACT}.`
      )
    ).toBeInTheDocument()
  })

  it('erreur de saisie : message sous le champ, resume ancre, rien n est envoye', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.type(forageField(), 'forage@asl-les-pins')
    await userEvent.tab()

    expect(
      await screen.findByText(
        "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"
      )
    ).toBeInTheDocument()
    expect(forageField()).toHaveAttribute('aria-invalid', 'true')

    await submit()

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent("1 réglage n'a pas été enregistré")
    expect(
      within(summary).getByRole('link', {
        name: 'Adresse du responsable forage',
      })
    ).toHaveAttribute('href', `#${forageField().id}`)
    expect(saveAction).not.toHaveBeenCalled()
    expect(forageField()).toHaveValue('forage@asl-les-pins')
  })

  it('adresse de contact videe : refusee, l adresse precedente reste en vigueur', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.clear(contactField())
    await submit()

    expect(
      await screen.findByText(
        `L'adresse de contact est obligatoire : c'est vers elle que partent les messages quand aucune autre adresse n'est renseignée. L'adresse ${CONTACT} reste en vigueur.`
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "1 réglage n'a pas été enregistré"
    )
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('chargement : bouton desactive, libelle d attente', async () => {
    let settle: (state: AssociationSettingsFormState) => void = () => {}
    const saveAction = vi.fn(
      () =>
        new Promise<AssociationSettingsFormState>((resolve) => {
          settle = resolve
        })
    )
    productionForm(saveAction)

    await submit()

    expect(
      await screen.findByRole('button', {name: 'Enregistrement…'})
    ).toBeDisabled()
    settle({success: true, message: 'ok'})
  })

  it('succes : alerte neutre, les nouvelles valeurs restent affichees', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.type(forageField(), 'forage@asl-les-pins.test')
    await submit()

    expect(
      await screen.findByText(
        'Réglages enregistrés. Les prochains messages partiront vers ces adresses.'
      )
    ).toBeInTheDocument()
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get(CONTACT_EMAIL_SETTING_KEY)).toBe(CONTACT)
    expect(formData.get(FORAGE_EMAIL_SETTING_KEY)).toBe(
      'forage@asl-les-pins.test'
    )
    expect(forageField()).toHaveValue('forage@asl-les-pins.test')
  })

  it('refus du serveur par champ : message sous le champ et resume', async () => {
    const saveAction = vi.fn(
      async (): Promise<AssociationSettingsFormState> => ({
        success: false,
        fieldErrors: {[FORAGE_EMAIL_SETTING_KEY]: {code: 'invalidEmail'}},
      })
    )
    productionForm(saveAction)

    await userEvent.type(forageField(), 'forage@asl-les-pins.test')
    await submit()

    expect(
      await screen.findByText(
        "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "1 réglage n'a pas été enregistré"
    )
  })

  it('erreur d enregistrement : alerte en tete, anciennes adresses en vigueur', async () => {
    const saveAction = vi.fn(
      async (): Promise<AssociationSettingsFormState> => ({
        success: false,
        message: "Les réglages n'ont pas été enregistrés.",
        kept: 'Les anciennes adresses restent en vigueur.',
      })
    )
    productionForm(saveAction)

    await submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      "Les réglages n'ont pas été enregistrés. Les anciennes adresses restent en vigueur."
    )
    expect(
      within(alert).getByText('Les anciennes adresses restent en vigueur.')
        .tagName
    ).toBe('STRONG')
  })
})

describe('AssociationSettingsForm — l absence de ligne reste le defaut (ADR 016)', () => {
  it('n envoie pas un booleen ni un choix jamais renseignes que l on n a pas touches', async () => {
    const saveAction = saved()
    testRegistryForm(saveAction)

    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get('test.required_email')).toBe('secretariat@asl.test')
    expect(formData.has('test.boolean')).toBe(false)
    expect(formData.has('test.choice_few')).toBe(false)
    expect(formData.has('test.choice_many')).toBe(false)
  })

  it('enregistre le retour a la valeur par defaut d un reglage enregistre entre-temps', async () => {
    const saveAction = saved()
    testRegistryForm(saveAction)
    const checkbox = screen.getByRole('checkbox', {name: /Relances activées/})

    await userEvent.click(checkbox)
    await submit()
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    await userEvent.click(checkbox)
    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(2))
    expect(vi.mocked(saveAction).mock.calls[0][1].get('test.boolean')).toBe(
      'true'
    )
    expect(vi.mocked(saveAction).mock.calls[1][1].get('test.boolean')).toBe(
      'false'
    )
  })

  it('vider une adresse facultative renseignee l envoie vide, pour supprimer sa ligne', async () => {
    const saveAction = saved()
    productionForm(saveAction, [
      {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
      {key: FORAGE_EMAIL_SETTING_KEY, value: 'forage@asl-les-pins.test'},
    ])

    await userEvent.clear(forageField())
    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get(FORAGE_EMAIL_SETTING_KEY)).toBe('')
  })
})
