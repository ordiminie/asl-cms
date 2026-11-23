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
  ASSOCIATION_DESCRIPTION_SETTING_KEY,
  ASSOCIATION_SETTINGS_REGISTRY,
  CONTACT_EMAIL_SETTING_KEY,
  EMAIL_DAILY_SEND_LIMIT_SETTING_KEY,
  EMAIL_LOGIN_RESERVE_SETTING_KEY,
  FORAGE_EMAIL_SETTING_KEY,
  getSettingsForPage,
  GOOGLE_VERIFICATION_SETTING_KEY,
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

  it('affiche le seuil des formulaires publics, genere depuis le registre (s08b)', () => {
    productionForm()

    const threshold = screen.getByLabelText(
      /Nombre de messages par heure et par visiteur/
    )
    expect(threshold).toHaveAttribute('inputmode', 'numeric')
    expect(threshold).toHaveClass('font-mono', 'tabular-nums')
    expect(threshold.closest('[data-setting]')).toHaveTextContent(
      'messages par heure'
    )
  })

  it('affiche la carte « Envois » et ses deux champs numériques, générés depuis le registre (s26)', async () => {
    productionForm()

    const card = screen
      .getByRole('heading', {level: 3, name: 'Envois'})
      .closest('[data-slot="card"]') as HTMLElement
    const cap = within(card).getByLabelText(/Plafond quotidien des campagnes/)
    expect(cap).toHaveAttribute('inputmode', 'numeric')
    expect(cap.closest('[data-setting]')).toHaveTextContent('envois par jour')
    expect(cap.closest('[data-setting]')).toHaveTextContent(
      'toutes campagnes confondues'
    )
    const attempts = within(card).getByLabelText(
      /Nombre de tentatives d’envoi d’une part/
    )
    expect(attempts.closest('[data-setting]')).toHaveTextContent('tentatives')

    await userEvent.type(cap, '0')
    await userEvent.tab()
    expect(
      await within(card).findByText('Saisissez un nombre entier supérieur à 0.')
    ).toBeInTheDocument()
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
  it('forage non renseigne : le champ est vide et ne promet aucun envoi (s10, ADR 028)', () => {
    productionForm()

    expect(contactField()).toHaveValue(CONTACT)
    expect(forageField()).toHaveValue('')
    expect(
      screen.getByText('Vide : aucune adresse n’est enregistrée ici.')
    ).toBeInTheDocument()
    expect(
      screen.getByText("Adresse non utilisée dans l'application.")
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

  it('adresse invalide envoyee sans quitter le champ : rien ne bouge sous le clic, puis resume ancre', async () => {
    const saveAction = saved()
    productionForm(saveAction)
    const button = screen.getByRole('button', {
      name: 'Enregistrer les réglages',
    })

    const user = userEvent.setup()
    await user.type(forageField(), 'forage@asl-les-pins')
    // Presser le bouton ne doit rien afficher au-dessus de lui : un message
    // apparu entre l'appui et le relachement deplace le bouton, et le clic
    // se perd (CI e2e, critere 2).
    await user.pointer({keys: '[MouseLeft>]', target: button})
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(
      screen.queryByText(
        "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"
      )
    ).not.toBeInTheDocument()
    await user.pointer({keys: '[/MouseLeft]', target: button})

    expect(
      await screen.findByText(
        "Cette adresse n'est pas valide. Exemple : nom@domaine.fr"
      )
    ).toBeInTheDocument()
    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent("1 réglage n'a pas été enregistré")
    expect(
      within(summary).getByRole('link', {
        name: 'Adresse du responsable forage',
      })
    ).toHaveAttribute('href', `#${forageField().id}`)
    expect(saveAction).not.toHaveBeenCalled()
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

describe('AssociationSettingsForm — carte « Referencement » (s11)', () => {
  const CODE = 'k3Jd8-QwX_9mLp2vRtY7aBcDeFgHiJ0kLmNoPq'
  const descriptionField = () =>
    screen.getByLabelText(/Description de l’association/)
  const codeField = () => screen.getByLabelText(/Code de vérification Google/)

  it('rend les deux champs dans la carte « Referencement », hors de la carte des adresses', () => {
    productionForm()

    const card = screen
      .getByRole('heading', {name: 'Référencement'})
      .closest('[data-slot="card"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(
      within(card).getByText(
        'Ce que Google affiche de votre site, et ce qu’on voit quand un lien est partagé.'
      )
    ).toBeInTheDocument()
    expect(within(card).getByLabelText(/Description de l’association/)).toBe(
      descriptionField()
    )
    expect(within(card).getByLabelText(/Code de vérification Google/)).toBe(
      codeField()
    )
    expect(within(card).queryByLabelText('Adresse de contact')).toBeNull()
  })

  it('texte long en zone de 3 lignes avec compteur, code en champ monospace', () => {
    productionForm()

    expect(descriptionField().tagName).toBe('TEXTAREA')
    expect(descriptionField()).toHaveAttribute('rows', '3')
    expect(screen.getByText('0 / 160')).toBeInTheDocument()
    expect(codeField().tagName).toBe('INPUT')
    expect(codeField()).toHaveClass('font-mono')
  })

  it('vides : chaque champ dit ce qui s applique', () => {
    productionForm()

    expect(
      screen.getByText(
        'Vide : les résultats de recherche afficheront le texte que Google choisira dans la page.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Vide : le site n’est pas déclaré auprès de Google. Il peut tout de même apparaître dans ses résultats.'
      )
    ).toBeInTheDocument()
  })

  it('compteur depasse : erreur au blur avec le nombre de caracteres de trop', async () => {
    productionForm()

    await userEvent.click(descriptionField())
    await userEvent.paste('a'.repeat(178))
    await userEvent.tab()

    expect(
      await screen.findByText('18 caractères de trop.')
    ).toBeInTheDocument()
    expect(screen.getByText('178 / 160')).toBeInTheDocument()
    expect(descriptionField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('le compteur mesure ce que mesure l erreur : espaces de fin exclus (revue s11, m2)', async () => {
    productionForm()

    await userEvent.click(descriptionField())
    await userEvent.paste(`${'a'.repeat(160)}  `)
    await userEvent.tab()

    expect(screen.getByText('160 / 160')).not.toHaveClass(
      'text-destructive-text'
    )
    expect(descriptionField()).not.toHaveAttribute('aria-invalid')
  })

  it('balise collee entiere : le code seul est garde au blur, et la phrase le dit', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.click(codeField())
    await userEvent.paste(
      `<meta name="google-site-verification" content="${CODE}" />`
    )
    await userEvent.tab()

    expect(codeField()).toHaveValue(CODE)
    expect(
      screen.getByText('Nous avons gardé le code seul : k3Jd…NoPq.')
    ).toBeInTheDocument()

    await submit()
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    expect(
      vi
        .mocked(saveAction)
        .mock.calls[0][1].get(GOOGLE_VERIFICATION_SETTING_KEY)
    ).toBe(CODE)
  })

  it('code a caractere interdit : refuse au blur, rien n est envoye', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.type(codeField(), 'k3Jd8 QwX/9')
    await userEvent.tab()

    expect(
      await screen.findByText(
        'Ce code ne ressemble pas à celui de Google : il ne contient que des lettres, des chiffres, des tirets et des soulignés.'
      )
    ).toBeInTheDocument()
    await submit()
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('envoie la description saisie sous sa cle', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.type(descriptionField(), 'Réseau d’eau privé.')
    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    expect(
      vi
        .mocked(saveAction)
        .mock.calls[0][1].get(ASSOCIATION_DESCRIPTION_SETTING_KEY)
    ).toBe('Réseau d’eau privé.')
  })
})

describe('AssociationSettingsForm — carte « Mentions des emails » (s25)', () => {
  it('rend la raison sociale et les mentions dans leur propre carte, avec ce qui s’applique à vide', () => {
    productionForm()

    const card = screen
      .getByRole('heading', {name: 'Mentions des emails'})
      .closest('[data-slot="card"]') as HTMLElement
    expect(card).not.toBeNull()
    const legalName = within(card).getByLabelText(/Raison sociale/)
    const mentions = within(card).getByLabelText(/Mentions du pied de page/)
    expect(legalName.tagName).toBe('INPUT')
    expect(mentions.tagName).toBe('TEXTAREA')
    expect(
      within(card).getByText(
        'Vide : le pied de page des campagnes porte le nom de l’association.'
      )
    ).toBeInTheDocument()
    expect(within(card).queryByLabelText('Adresse de contact')).toBeNull()
  })
})

describe('AssociationSettingsForm — limite et réserve réservées au SuperAdmin (s52)', () => {
  const sendingForm = (
    canEditSuperAdminOnly: boolean,
    saveAction: AssociationSettingsSaveAction = saved(),
    rows = [
      {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
      {key: EMAIL_DAILY_SEND_LIMIT_SETTING_KEY, value: '280'},
    ]
  ) =>
    render(
      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, rows)}
        saveAction={saveAction}
        canEditSuperAdminOnly={canEditSuperAdminOnly}
      />
    )
  const sendingCard = () =>
    screen
      .getByRole('heading', {level: 3, name: 'Envois'})
      .closest('[data-slot="card"]') as HTMLElement
  const limitField = () =>
    within(sendingCard()).getByLabelText(
      /Limite d’envoi quotidienne de la messagerie/
    )
  const reserveField = () =>
    within(sendingCard()).getByLabelText(/Envois gardés pour la connexion/)

  it('le bureau lit la limite et la réserve en vigueur, sans pouvoir les modifier', () => {
    sendingForm(false)

    expect(limitField()).toHaveAttribute('readonly')
    expect(limitField()).toHaveValue('280')
    expect(reserveField()).toHaveAttribute('readonly')
    expect(reserveField()).toHaveValue('100')
    expect(limitField().closest('[data-setting]')).toHaveTextContent(
      'Réglé par l’équipe technique de la plateforme'
    )
    expect(
      within(sendingCard()).getByLabelText(/Plafond quotidien des campagnes/)
    ).not.toHaveAttribute('readonly')
  })

  it('le bureau n’envoie jamais la limite ni la réserve', async () => {
    const saveAction = saved()
    sendingForm(false, saveAction)

    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.has(EMAIL_DAILY_SEND_LIMIT_SETTING_KEY)).toBe(false)
    expect(formData.has(EMAIL_LOGIN_RESERVE_SETTING_KEY)).toBe(false)
  })

  it('le SuperAdmin les modifie ; une réserve égale à la limite est refusée sous la réserve', async () => {
    const saveAction = saved()
    sendingForm(true, saveAction)

    expect(limitField()).not.toHaveAttribute('readonly')
    await userEvent.type(reserveField(), '280')
    await submit()

    expect(
      await within(sendingCard()).findByText(
        'Gardez moins d’envois que la limite quotidienne (280).'
      )
    ).toBeInTheDocument()
    expect(saveAction).not.toHaveBeenCalled()

    await userEvent.clear(reserveField())
    await userEvent.type(reserveField(), '80')
    await submit()
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get(EMAIL_DAILY_SEND_LIMIT_SETTING_KEY)).toBe('280')
    expect(formData.get(EMAIL_LOGIN_RESERVE_SETTING_KEY)).toBe('80')
  })
})

describe('AssociationSettingsForm — carte « Factures » (s19, ADR 059)', () => {
  const billingCard = () =>
    screen
      .getByRole('heading', {level: 3, name: 'Factures'})
      .closest('[data-slot="card"]') as HTMLElement

  const billingForm = (canEditSuperAdminOnly: boolean) =>
    render(
      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
        ])}
        saveAction={saved()}
        canEditSuperAdminOnly={canEditSuperAdminOnly}
      />
    )

  it('rend l’objet, les deux listes de statuts en zones multilignes et le destinataire', () => {
    billingForm(false)

    const card = billingCard()
    expect(within(card).getByLabelText(/Objet des factures/).tagName).toBe(
      'INPUT'
    )
    expect(
      within(card).getByLabelText(/Statuts qui valent « impayé »/).tagName
    ).toBe('TEXTAREA')
    expect(
      within(card).getByLabelText(/Statuts qui valent « réglé »/).tagName
    ).toBe('TEXTAREA')
    expect(
      within(card).getByLabelText(/Adresse des signalements de facture/)
    ).toHaveAttribute('type', 'email')
  })

  it('l’objet obligatoire montre son défaut, et n’est envoyé que s’il change', async () => {
    const saveAction = saved()
    render(
      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
        ])}
        saveAction={saveAction}
      />
    )

    const subject = within(billingCard()).getByLabelText(/Objet des factures/)
    expect(subject).toHaveValue('Facture {année}')
    await submit()
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    expect(
      vi.mocked(saveAction).mock.calls[0][1].has('billing.invoice_subject')
    ).toBe(false)
  })

  it('le bureau lit le fournisseur des factures sans pouvoir le changer', () => {
    billingForm(false)

    const provider = within(billingCard()).getByRole('radiogroup', {
      name: /Source des factures/,
    })
    expect(
      within(provider).getByRole('radio', {name: 'Saisie par le bureau'})
    ).toBeChecked()
    expect(
      within(provider).getByRole('radio', {name: 'Saisie par le bureau'})
    ).toBeDisabled()
  })

  it('propose « Pennylane » au SuperAdmin et rend les libellés des statuts en zone multiligne (s20)', () => {
    billingForm(true)

    const card = billingCard()
    expect(within(card).getByRole('radio', {name: 'Pennylane'})).toBeEnabled()
    expect(within(card).getByLabelText(/Libellés des statuts/).tagName).toBe(
      'TEXTAREA'
    )
  })

  it('le SuperAdmin peut choisir le fournisseur', () => {
    billingForm(true)

    expect(
      within(billingCard()).getByRole('radio', {name: 'Saisie par le bureau'})
    ).toBeEnabled()
  })
})

describe('AssociationSettingsForm — carte d’état après sa section (s20, gap 1)', () => {
  it('rend la carte donnée juste après la carte « Factures », hors du flux des réglages', () => {
    render(
      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
        ])}
        saveAction={saved()}
        afterSection={{billing: <section aria-label="Carte d’état" />}}
      />
    )

    const billing = screen
      .getByRole('heading', {level: 3, name: 'Factures'})
      .closest('[data-slot="card"]') as HTMLElement
    const status = screen.getByRole('region', {name: 'Carte d’état'})
    expect(billing.nextElementSibling).toBe(status)
  })
})

describe('AssociationSettingsForm — carte « Nature des envois » (s27b, ADR 064)', () => {
  const natureCard = () =>
    screen
      .getByRole('heading', {level: 3, name: 'Nature des envois'})
      .closest('[data-slot="card"]') as HTMLElement
  const natureForm = (
    canEditSuperAdminOnly: boolean,
    saveAction: AssociationSettingsSaveAction = saved()
  ) =>
    render(
      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
          {key: CONTACT_EMAIL_SETTING_KEY, value: CONTACT},
          {key: 'campaign.nature.general_assembly', value: 'statutaire'},
        ])}
        saveAction={saveAction}
        canEditSuperAdminOnly={canEditSuperAdminOnly}
      />
    )
  const natureOf = (name: string) =>
    within(natureCard()).getByRole('radiogroup', {name: new RegExp(name)})

  it('rend un choix par type d’envoi, après la carte « Envois »', () => {
    natureForm(false)

    const headings = screen
      .getAllByRole('heading', {level: 3})
      .map((heading) => heading.textContent)
    expect(headings.indexOf('Nature des envois')).toBe(
      headings.indexOf('Envois') + 1
    )
    for (const name of [
      'Message libre',
      'Relance manuelle',
      'Facture disponible',
      'Convocation à l’AG',
      'Documents après l’AG',
    ]) {
      expect(natureOf(name)).toBeInTheDocument()
    }
  })

  it('le bureau lit la nature en vigueur sans pouvoir la changer, et ne l’envoie jamais', async () => {
    const saveAction = saved()
    natureForm(false, saveAction)

    const assembly = natureOf('Convocation à l’AG')
    const statutory = within(assembly).getByRole('radio', {
      name: 'Statutaire — les désinscrits le reçoivent aussi',
    })
    expect(statutory).toBeChecked()
    expect(statutory).toBeDisabled()
    expect(assembly.closest('[data-setting]')).toHaveTextContent(
      'Réglé par l’équipe technique de la plateforme, après avis du conseil RGPD : vous ne pouvez pas le modifier.'
    )

    await submit()
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(
      [...formData.keys()].filter((key) => key.startsWith('campaign.nature.'))
    ).toEqual([])
  })

  it('un type jamais classé se lit facultatif et le dit', () => {
    natureForm(false)

    const free = natureOf('Message libre')
    expect(
      within(free).getByRole('radio', {
        name: 'Facultatif — les désinscrits ne le reçoivent pas',
      })
    ).toBeChecked()
    expect(free.closest('[data-setting]')).toHaveTextContent(
      'Sans choix enregistré : facultatif.'
    )
    expect(
      natureOf('Convocation à l’AG').closest('[data-setting]')
    ).not.toHaveTextContent('Sans choix enregistré')
  })

  it('le SuperAdmin reclasse un type d’envoi ; seule la nature changée part', async () => {
    const saveAction = saved()
    natureForm(true, saveAction)

    const free = natureOf('Message libre')
    expect(free.closest('[data-setting]')).not.toHaveTextContent(
      'après avis du conseil RGPD'
    )
    await userEvent.click(
      within(natureOf('Relance manuelle')).getByRole('radio', {
        name: 'Statutaire — les désinscrits le reçoivent aussi',
      })
    )
    await submit()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
    const formData = vi.mocked(saveAction).mock.calls[0][1]
    expect(formData.get('campaign.nature.reminder')).toBe('statutaire')
    expect(formData.get('campaign.nature.general_assembly')).toBe('statutaire')
    expect(formData.has('campaign.nature.free')).toBe(false)
  })
})

describe('AssociationSettingsForm — carte « Relances des impayés » (s29, écran 2)', () => {
  const reminderCard = () =>
    screen
      .getByRole('heading', {level: 3, name: 'Relances des impayés'})
      .closest('[data-slot="card"]') as HTMLElement

  it('2a · six réglages, juste après la carte « Factures », ancrée pour le lien de la page de suivi', () => {
    productionForm()

    const billing = screen
      .getByRole('heading', {level: 3, name: 'Factures'})
      .closest('[data-slot="card"]') as HTMLElement
    expect(billing.nextElementSibling).toBe(reminderCard())
    expect(reminderCard()).toHaveAttribute('id', 'reglages-reminder')
    const card = within(reminderCard())
    expect(
      card.getByRole('checkbox', {
        name: /Relancer automatiquement les impayés/,
      })
    ).not.toBeChecked()
    expect(card.getByLabelText(/Première relance/)).toBeInTheDocument()
    expect(card.getByText('semaines après l’échéance')).toBeInTheDocument()
    expect(card.getByText('semaines après la première')).toBeInTheDocument()
    expect(card.getByText('semaines après la deuxième')).toBeInTheDocument()
    expect(card.getByLabelText(/Objet de la relance/)).toBeInTheDocument()
    expect(card.getByLabelText(/Texte de la relance/)).toBeInTheDocument()
    expect(
      card.getByText(
        'Variables : {nom}, {parcelle}, {date}, {factures}. {factures} écrit la liste des factures impayées du membre.'
      )
    ).toBeInTheDocument()
  })

  it('2b · activation refusée : résumé et message sous le champ vide, rien n’est envoyé', async () => {
    const saveAction = saved()
    productionForm(saveAction)

    await userEvent.click(
      within(reminderCard()).getByRole('checkbox', {
        name: /Relancer automatiquement les impayés/,
      })
    )
    await submit()

    expect(
      await within(reminderCard()).findByText(
        'Écrivez le texte de la relance avant de l’activer.'
      )
    ).toBeInTheDocument()
    expect(
      within(reminderCard()).getByText(
        'Écrivez l’objet de la relance avant de l’activer.'
      )
    ).toBeInTheDocument()
    expect(saveAction).not.toHaveBeenCalled()
  })

  it('2b · le refus rendu par le serveur s’affiche sous son champ', async () => {
    const saveAction = vi.fn(
      async (): Promise<AssociationSettingsFormState> => ({
        success: false,
        fieldErrors: {'billing.reminder.body': {code: 'unknownVariable'}},
      })
    )
    productionForm(saveAction)

    await userEvent.type(
      within(reminderCard()).getByLabelText(/Texte de la relance/),
      'Bonjour'
    )
    await submit()

    expect(
      await within(reminderCard()).findByText(/variable inconnue/)
    ).toBeInTheDocument()
  })
})
