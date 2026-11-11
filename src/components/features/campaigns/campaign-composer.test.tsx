import {readFileSync} from 'node:fs'
import path from 'node:path'

import {beforeEach, describe, expect, it, vi} from 'vitest'

const router = vi.hoisted(() => ({push: vi.fn(), refresh: vi.fn()}))
vi.mock('next/navigation', () => ({useRouter: () => router}))

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/__tests__/customRender'
import type {
  CampaignComposerContextDTO,
  CampaignPreviewDTO,
  PreviewCampaignActionResult,
  SendCampaignActionResult,
} from '@/services/types/domain/campaign-types'

import messages from '../../../../messages/fr.json'
import {
  CampaignComposer,
  CampaignComposerSkeleton,
  type CampaignTemplates,
} from './campaign-composer'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Radix Select s'appuie sur des API de pointeur absentes de jsdom.
Element.prototype.hasPointerCapture = vi.fn(() => false)
Element.prototype.releasePointerCapture = vi.fn()
Element.prototype.scrollIntoView = vi.fn()

const CAMPAIGN_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROFILE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const TEMPLATES: CampaignTemplates = messages.email.campaign.templates

const contextOf = (
  overrides: Partial<CampaignComposerContextDTO> = {}
): CampaignComposerContextDTO => ({
  associationName: 'ASL Les Pins',
  replyTo: 'contact@lespins.example',
  subjectMaxLength: 45,
  counts: {recipients: 296, withoutEmail: 71, unsubscribed: 15, total: 382},
  reachableMembers: [
    {id: PROFILE_A, name: 'Claire Aubert'},
    {id: PROFILE_B, name: 'Paul Renaud'},
  ],
  ...overrides,
})

const previewOf = (
  overrides: Partial<CampaignPreviewDTO> = {}
): CampaignPreviewDTO => ({
  member: {id: PROFILE_A, name: 'Claire Aubert'},
  subject: 'ASL Les Pins — Peinture du portail',
  preheader: 'Merci de laisser le passage libre.',
  html: '<html><body>Bonjour Claire Aubert</body></html>',
  text: 'Bonjour Claire Aubert',
  counts: {recipients: 296, withoutEmail: 71, unsubscribed: 15, total: 382},
  ...overrides,
})

let previewAction: ReturnType<
  typeof vi.fn<
    (
      state: PreviewCampaignActionResult | undefined,
      formData: FormData
    ) => Promise<PreviewCampaignActionResult>
  >
>
let sendAction: ReturnType<
  typeof vi.fn<
    (
      state: SendCampaignActionResult | undefined,
      formData: FormData
    ) => Promise<SendCampaignActionResult>
  >
>

const sentFields = (action: {mock: {calls: unknown[][]}}, call = 0) =>
  Object.fromEntries(
    [...(action.mock.calls[call][1] as FormData).entries()].map(
      ([key, value]) => [key, String(value)]
    )
  )

const renderComposer = (context = contextOf()) =>
  render(
    <CampaignComposer
      context={context}
      templates={TEMPLATES}
      previewAction={previewAction}
      sendAction={sendAction}
    />
  )

const subjectField = () => screen.getByRole('textbox', {name: /^Objet/})
const bodyField = () => screen.getByRole('textbox', {name: 'Message'})

const writeFreeMessage = async (
  subject = 'Peinture du portail',
  body = 'Bonjour {nom}'
) => {
  await userEvent.type(subjectField(), subject)
  await userEvent.type(bodyField(), body.replaceAll('{', '{{'))
}

const openPreview = async () => {
  await writeFreeMessage()
  await userEvent.click(screen.getByRole('button', {name: 'Voir l’aperçu'}))
  await screen.findByRole('heading', {name: 'Aperçu avant l’envoi'})
}

beforeEach(() => {
  vi.clearAllMocks()
  previewAction = vi.fn(async () => ({
    status: 'ok' as const,
    preview: previewOf(),
  }))
  sendAction = vi.fn(async () => ({
    status: 'created' as const,
    campaignId: CAMPAIGN_ID,
  }))
})

describe('CampaignComposer — écran 2 (composer)', () => {
  it('b · libre vierge : message libre présélectionné, champs vides, pas d’alerte provisoire', () => {
    renderComposer()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Écrire une campagne'})
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: /Message libre/})).toBeChecked()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(subjectField()).toHaveValue('')
    expect(bodyField()).toHaveValue('')
    expect(screen.queryByText('Texte provisoire.')).toBeNull()
  })

  it('montre la phrase d’usage de chaque modèle', () => {
    renderComposer()

    for (const usage of Object.values(
      messages.CampaignsBureau.templateUsages
    )) {
      expect(screen.getByText(usage)).toBeInTheDocument()
    }
  })

  it('a/f · choisir un modèle sur une saisie vide remplit objet et corps, alerte « Texte provisoire »', async () => {
    renderComposer()

    await userEvent.click(
      screen.getByRole('radio', {name: /Convocation à l’AG/})
    )

    expect(subjectField()).toHaveValue(TEMPLATES.general_assembly.subject)
    expect(bodyField()).toHaveValue(TEMPLATES.general_assembly.body)
    expect(screen.getByText('Texte provisoire.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Modèle appliqué. L’objet et le message ont été remplacés.'
      )
    ).toBeInTheDocument()
  })

  it('h · un texte déjà écrit : « Remplacer votre texte ? » avant de l’écraser', async () => {
    renderComposer()
    await writeFreeMessage('Mon objet', 'Mon texte')

    await userEvent.click(screen.getByRole('radio', {name: /Relance manuelle/}))

    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText('Remplacer votre texte ?')
    ).toBeInTheDocument()
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Garder mon texte'})
    )
    expect(subjectField()).toHaveValue('Mon objet')
    expect(screen.getByRole('radio', {name: /Message libre/})).toBeChecked()

    await userEvent.click(screen.getByRole('radio', {name: /Relance manuelle/}))
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Remplacer le texte',
      })
    )
    expect(subjectField()).toHaveValue(TEMPLATES.reminder.subject)
    expect(bodyField()).toHaveValue(TEMPLATES.reminder.body)
  })

  it('compte l’objet sur le plafond calculé, et dit le préfixe ajouté', async () => {
    renderComposer()

    await userEvent.type(subjectField(), 'Peinture')

    expect(screen.getByText('8 / 45')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Le nom de l’association est ajouté devant l’objet : « ASL Les Pins — … ».'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('0 / 90')).toBeInTheDocument()
  })

  it('d · compteur dépassé : signalé, « Voir l’aperçu » reste actif et refuse au clic', async () => {
    renderComposer()
    await writeFreeMessage('x'.repeat(47), 'Bonjour')

    expect(subjectField()).toHaveAttribute('aria-invalid', 'true')
    const button = screen.getByRole('button', {name: 'Voir l’aperçu'})
    expect(button).toBeEnabled()
    await userEvent.click(button)

    expect(await screen.findByText(/1 champ à corriger/)).toBeInTheDocument()
    expect(screen.getAllByText(/2 caractères de trop/).length).toBeGreaterThan(
      0
    )
    expect(previewAction).not.toHaveBeenCalled()
  })

  it('c · erreurs de saisie : résumé ancré, rien n’est envoyé', async () => {
    renderComposer()

    await userEvent.click(screen.getByRole('button', {name: 'Voir l’aperçu'}))

    const summary = await screen.findByText(/2 champs à corriger/)
    expect(summary.closest('[role="alert"]')).toHaveTextContent(
      'Rien n’a été envoyé.'
    )
    expect(
      screen.getByText('Objet : Écrivez l’objet de la campagne.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Message : Écrivez le message.')
    ).toBeInTheDocument()
    expect(previewAction).not.toHaveBeenCalled()
  })

  it('e · variable inconnue : « Voir l’aperçu » reste actif, montre l’alerte, pas d’aperçu', async () => {
    previewAction.mockResolvedValue({
      status: 'unknown_variables',
      variables: ['parcele'],
    })
    renderComposer()
    await writeFreeMessage('Objet', 'Parcelle {parcele}')

    await userEvent.click(screen.getByRole('button', {name: 'Voir l’aperçu'}))

    const alert = await screen.findByText('Variable inconnue : {parcele}.')
    expect(alert.closest('[role="alert"]')).toHaveTextContent(
      'remplacez-la par {parcelle}, {nom} ou {date}'
    )
    expect(
      screen.queryByRole('heading', {name: 'Aperçu avant l’envoi'})
    ).toBeNull()
    expect(screen.getByRole('button', {name: 'Voir l’aperçu'})).toBeEnabled()
  })

  it('liste les variables et l’adresse de réponse', () => {
    renderComposer()

    for (const variable of ['{nom}', '{parcelle}', '{date}']) {
      expect(screen.getByText(variable)).toBeInTheDocument()
    }
    expect(
      screen.getByText('Les réponses arrivent à contact@lespins.example.')
    ).toBeInTheDocument()
  })

  it('le décompte distingue les trois groupes, et leur somme fait le total', () => {
    renderComposer()

    const card = screen
      .getByRole('heading', {name: '3 · Destinataires'})
      .closest('[data-slot="card"]') as HTMLElement
    expect(within(card).getByText('Tous les membres')).toBeInTheDocument()
    const figures = ['296', '71', '15'].map((figure) =>
      Number(within(card).getByText(figure).textContent)
    )
    expect(figures.reduce((sum, n) => sum + n, 0)).toBe(382)
    expect(within(card).getByText('382')).toBeInTheDocument()
  })

  it('g · aucun destinataire : dit pourquoi, « Voir l’aperçu » reste actif', () => {
    renderComposer(
      contextOf({
        counts: {recipients: 0, withoutEmail: 3, unsubscribed: 1, total: 4},
        reachableMembers: [],
      })
    )

    expect(
      screen.getByText(
        'Aucun membre ne peut recevoir cette campagne : aucun n’a d’adresse email, ou tous sont désinscrits.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Voir l’aperçu'})).toBeEnabled()
  })

  it('i · décompte en chargement : skeleton', () => {
    const {container} = render(<CampaignComposerSkeleton />)

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it('une seule action principale : « Voir l’aperçu »', () => {
    const {container} = renderComposer()

    const defaults = [
      ...container.querySelectorAll('[data-slot="button"]'),
    ].filter((button) => button.classList.contains('bg-primary'))
    expect(defaults.map((button) => button.textContent)).toEqual([
      'Voir l’aperçu',
    ])
  })

  it('aucun jeu de classes sombres (web clair seul, ADR 033)', () => {
    for (const file of ['campaign-composer.tsx', 'campaign-preview-step.tsx']) {
      const source = readFileSync(
        path.resolve(import.meta.dirname, file),
        'utf8'
      )
      expect(source).not.toMatch(/\bdark:/)
    }
  })
})

describe('CampaignComposer — écran 3 (aperçu)', () => {
  it('b · aperçu libre : identité du membre, objet, cadre de l’email, rappel du décompte', async () => {
    renderComposer()
    await openPreview()

    expect(sentFields(previewAction)).toMatchObject({
      templateId: 'free',
      subject: 'Peinture du portail',
      bodyMarkdown: 'Bonjour {nom}',
    })
    expect(
      screen.getByText(
        'Aperçu avec les données de Claire Aubert, membre de l’association.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Objet : ASL Les Pins — Peinture du portail')
    ).toBeInTheDocument()
    const frame = screen.getByTitle('Aperçu de l’email')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('srcdoc')).toContain('Bonjour Claire Aubert')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(
      screen.getByText(
        '296 membres recevront cette campagne · 71 sans email et 15 désinscrits n’en recevront pas.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Texte provisoire.')).toBeNull()
  })

  it('a · aperçu d’un modèle : l’alerte « Texte provisoire » reste visible', async () => {
    renderComposer()
    await userEvent.click(
      screen.getByRole('radio', {name: /Facture disponible/})
    )
    await userEvent.click(screen.getByRole('button', {name: 'Voir l’aperçu'}))

    await screen.findByRole('heading', {name: 'Aperçu avant l’envoi'})
    expect(screen.getByText('Texte provisoire.')).toBeInTheDocument()
  })

  it('voir avec un autre membre joignable relance l’aperçu pour lui', async () => {
    renderComposer()
    await openPreview()
    previewAction.mockResolvedValue({
      status: 'ok',
      preview: previewOf({member: {id: PROFILE_B, name: 'Paul Renaud'}}),
    })

    await userEvent.click(
      screen.getByRole('combobox', {name: 'Voir avec un autre membre'})
    )
    await userEvent.click(screen.getByRole('option', {name: 'Paul Renaud'}))

    await waitFor(() =>
      expect(sentFields(previewAction, 1).memberProfileId).toBe(PROFILE_B)
    )
    expect(
      await screen.findByText(
        'Aperçu avec les données de Paul Renaud, membre de l’association.'
      )
    ).toBeInTheDocument()
  })

  it('« Modifier le message » revient au composeur, saisie conservée', async () => {
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier le message'})
    )

    expect(subjectField()).toHaveValue('Peinture du portail')
    expect(bodyField()).toHaveValue('Bonjour {nom}')
  })

  it('e · confirmation : alert-dialog qui nomme l’acte, focus sur « Revenir à l’aperçu »', async () => {
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )

    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText('Envoyer la campagne ?')
    ).toBeInTheDocument()
    expect(dialog).toHaveTextContent(
      '296 membres vont recevoir « ASL Les Pins — Peinture du portail ». L’envoi ne peut pas être annulé.'
    )
    expect(
      within(dialog).getByRole('button', {name: 'Revenir à l’aperçu'})
    ).toHaveFocus()
    expect(sendAction).not.toHaveBeenCalled()
  })

  it('confirmer envoie avec la saisie et un submissionId tiré à l’ouverture, puis ouvre la campagne', async () => {
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Envoyer à 296 membres',
      })
    )

    await waitFor(() => expect(sendAction).toHaveBeenCalledTimes(1))
    const fields = sentFields(sendAction)
    expect(fields).toMatchObject({
      templateId: 'free',
      subject: 'Peinture du portail',
      bodyMarkdown: 'Bonjour {nom}',
    })
    expect(fields.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        `/bureau/campagnes/${CAMPAIGN_ID}?envoi=1`
      )
    )
  })

  it('deux clics sur « Envoyer » → une seule action', async () => {
    let release: (value: SendCampaignActionResult) => void = () => {}
    sendAction.mockImplementation(
      () => new Promise((resolve) => (release = resolve))
    )
    renderComposer()
    await openPreview()
    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    const confirm = within(await screen.findByRole('alertdialog')).getByRole(
      'button',
      {name: 'Envoyer à 296 membres'}
    )

    await userEvent.click(confirm)
    await userEvent.click(confirm).catch(() => undefined)
    release({status: 'created', campaignId: CAMPAIGN_ID})

    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect(sendAction).toHaveBeenCalledTimes(1)
  })

  it('i · envoi coupé par les réglages : « aucun email n’est parti », saisie conservée', async () => {
    sendAction.mockResolvedValue({status: 'delivery_disabled'})
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Envoyer à 296 membres',
      })
    )

    expect(
      await screen.findByText(
        'L’envoi est désactivé sur cet environnement : aucun email n’est parti.'
      )
    ).toBeInTheDocument()
    expect(router.push).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', {name: 'Modifier le message'})
    )
    expect(subjectField()).toHaveValue('Peinture du portail')
  })

  it('j · échec avant tout envoi : « Rien n’est parti », on peut réessayer', async () => {
    sendAction.mockResolvedValue({status: 'error', message: 'panne'})
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Envoyer à 296 membres',
      })
    )

    expect(
      await screen.findByText('La campagne n’a pas pu être envoyée.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    ).toBeEnabled()
  })

  it('d · variable inconnue au moment d’envoyer : retour au composeur avec l’alerte', async () => {
    sendAction.mockResolvedValue({
      status: 'unknown_variables',
      variables: ['parcele'],
    })
    renderComposer()
    await openPreview()

    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Envoyer à 296 membres',
      })
    )

    expect(
      await screen.findByText('Variable inconnue : {parcele}.')
    ).toBeInTheDocument()
    expect(subjectField()).toHaveValue('Peinture du portail')
  })

  it('c · aperçu en chargement : skeleton dans le cadre', async () => {
    previewAction.mockImplementation(() => new Promise(() => {}))
    const {container} = renderComposer()
    await writeFreeMessage()

    await userEvent.click(screen.getByRole('button', {name: 'Voir l’aperçu'}))

    await waitFor(() =>
      expect(
        container.querySelectorAll('[data-slot="skeleton"]').length
      ).toBeGreaterThan(0)
    )
  })
})
