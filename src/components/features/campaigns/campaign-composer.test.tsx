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
  CampaignPlanDTO,
  CampaignPreviewDTO,
  CampaignTarget,
  CampaignTargetActionResult,
  CampaignTemplateId,
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
const GROUP_ID = '99999999-9999-4999-8999-999999999999'

const TEMPLATES: CampaignTemplates = messages.email.campaign.templates

const contextOf = (
  overrides: Partial<CampaignComposerContextDTO> = {}
): CampaignComposerContextDTO => ({
  associationName: 'ASL Les Pins',
  replyTo: 'contact@lespins.example',
  subjectMaxLength: 45,
  counts: {
    profilesWithEmail: 311,
    profilesWithoutEmail: 71,
    profiles: 382,
    recipients: 296,
    unsubscribed: 15,
    reinstated: 0,
    nature: 'facultative' as const,
  },
  reachableMembers: [
    {id: PROFILE_A, name: 'Claire Aubert'},
    {id: PROFILE_B, name: 'Paul Renaud'},
  ],
  groups: [
    {id: GROUP_ID, name: 'Riverains du chemin des Crêtes', profileCount: 38},
  ],
  templateNatures: {
    free: 'facultative',
    reminder: 'statutaire',
    invoice: 'statutaire',
    general_assembly: 'statutaire',
    post_assembly_documents: 'facultative',
    unpaid_reminder: 'statutaire',
  },
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
  counts: {
    profilesWithEmail: 311,
    profilesWithoutEmail: 71,
    profiles: 382,
    recipients: 296,
    unsubscribed: 15,
    reinstated: 0,
    nature: 'facultative' as const,
  },
  ...overrides,
})

const planOf = (overrides: Partial<CampaignPlanDTO> = {}): CampaignPlanDTO => ({
  today: '2026-11-12',
  dailySendCap: 500,
  allottedToday: 0,
  parts: [{day: '2026-11-12', count: 296}],
  ...overrides,
})

const THREE_DAYS = [
  {day: '2026-11-12', count: 100},
  {day: '2026-11-13', count: 100},
  {day: '2026-11-14', count: 96},
]

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

let targetAction: ReturnType<
  typeof vi.fn<
    (
      target: CampaignTarget,
      templateId: CampaignTemplateId
    ) => Promise<CampaignTargetActionResult>
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
      targetAction={targetAction}
    />
  )

const recipientsCard = () =>
  screen
    .getByRole('heading', {name: '3 · Destinataires'})
    .closest('[data-slot="card"]') as HTMLElement

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
    plan: planOf(),
  }))
  sendAction = vi.fn(async () => ({
    status: 'created' as const,
    campaignId: CAMPAIGN_ID,
  }))
  targetAction = vi.fn(async () => ({
    status: 'ok' as const,
    counts: {
      profilesWithEmail: 31,
      profilesWithoutEmail: 7,
      profiles: 38,
      recipients: 33,
      unsubscribed: 2,
      reinstated: 0,
      nature: 'facultative' as const,
    },
    reachableMembers: [{id: PROFILE_B, name: 'Paul Renaud'}],
  }))
})

describe('CampaignComposer — écran 2 (composer)', () => {
  it('b · libre vierge : message libre présélectionné, champs vides, pas d’alerte provisoire', () => {
    renderComposer()

    expect(
      screen.getByRole('heading', {level: 1, name: 'Écrire une campagne'})
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: /Message libre/})).toBeChecked()
    expect(
      within(
        screen.getByRole('radiogroup', {
          name: messages.CampaignsBureau.composer.template.legend,
        })
      ).getAllByRole('radio')
    ).toHaveLength(5)
    expect(subjectField()).toHaveValue('')
    expect(bodyField()).toHaveValue('')
    expect(screen.queryByText('Texte provisoire.')).toBeNull()
  })

  it('ne propose pas la relance automatique (s29) : elle n’est pas un modèle', () => {
    renderComposer()

    expect(
      screen.queryByRole('radio', {name: /Relance automatique/})
    ).toBeNull()
    expect(screen.queryByText(/Relance automatique/)).toBeNull()
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

  it('le décompte compte en fiches, puis en adresses (s27, critère 5)', () => {
    renderComposer()

    const card = recipientsCard()
    const fiches = within(card).getByRole('group', {name: 'Fiches'})
    expect(
      within(fiches).getByText('Avec au moins une adresse email active')
    ).toBeInTheDocument()
    expect(within(fiches).getByText('311')).toBeInTheDocument()
    expect(within(fiches).getByText('71')).toBeInTheDocument()
    expect(within(fiches).getByText('Fiches de la cible')).toBeInTheDocument()
    expect(within(fiches).getByText('382')).toBeInTheDocument()
    const adresses = within(card).getByRole('group', {name: 'Adresses'})
    expect(within(adresses).getByText('296')).toBeInTheDocument()
    expect(within(adresses).getByText('15')).toBeInTheDocument()
  })

  it('g · aucun destinataire : dit pourquoi, « Voir l’aperçu » reste actif', () => {
    renderComposer(
      contextOf({
        counts: {
          profilesWithEmail: 1,
          profilesWithoutEmail: 3,
          profiles: 4,
          recipients: 0,
          unsubscribed: 1,
          reinstated: 0,
          nature: 'facultative' as const,
        },
        reachableMembers: [],
      })
    )

    expect(
      screen.getByText(
        'Aucun membre de cette cible n’a d’adresse email active. Rien ne peut être envoyé.'
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
      screen.getByRole('region', {name: 'Destinataires et plan d’envoi'})
    ).toHaveTextContent(
      '296 membres recevront cette campagne · 71 sans email et 15 désinscrits n’en recevront pas.'
    )
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
      plan: planOf(),
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

describe('CampaignComposer — écran 1 de s26 (plan d’envoi)', () => {
  const withPlan = (plan: CampaignPlanDTO) => {
    previewAction.mockResolvedValue({status: 'ok', preview: previewOf(), plan})
  }
  const planSection = () =>
    screen.getByRole('region', {name: 'Destinataires et plan d’envoi'})

  const openConfirm = async () => {
    await userEvent.click(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    )
    return screen.findByRole('alertdialog')
  }

  it('b · au plus le plafond : un envoi unique, aujourd’hui, rien à faire', async () => {
    renderComposer()
    await openPreview()

    expect(planSection()).toHaveTextContent(
      '296 membres recevront cette campagne · 71 sans email et 15 désinscrits n’en recevront pas.'
    )
    expect(planSection()).toHaveTextContent(
      'Elle part en une seule fois, aujourd’hui. Vous n’avez rien à faire.'
    )
    expect(within(planSection()).queryByRole('list')).toBeNull()
  })

  it('a · trois jours : le plan écrit, une ligne par part, nombres et dates en données', async () => {
    withPlan(planOf({dailySendCap: 100, parts: THREE_DAYS}))
    renderComposer()
    await openPreview()

    expect(planSection()).toHaveTextContent('Elle part en 3 jours :')
    const items = within(planSection()).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '100 membres le 12/11/2026',
      '100 membres le 13/11/2026',
      '96 membres le 14/11/2026',
    ])
    expect(within(items[2]).getByText('96')).toHaveClass('font-mono')
    expect(within(items[2]).getByText('14/11/2026')).toHaveClass('font-mono')
    expect(planSection()).toHaveTextContent('Vous n’avez rien à faire.')
  })

  it('e · la confirmation répète le plan de l’aperçu, en mots sur trois jours', async () => {
    withPlan(planOf({dailySendCap: 100, parts: THREE_DAYS}))
    renderComposer()
    await openPreview()

    const dialog = await openConfirm()

    expect(dialog).toHaveTextContent(
      '296 membres vont recevoir « ASL Les Pins — Peinture du portail », en 3 jours : 100 aujourd’hui, 100 demain, 96 après-demain. L’envoi ne peut pas être annulé.'
    )
    expect(
      within(dialog).getByRole('button', {name: 'Envoyer à 296 membres'})
    ).toHaveClass('bg-destructive')
  })

  it('e · en mobile, la confirmation est ancrée en bas', async () => {
    renderComposer()
    await openPreview()

    const dialog = await openConfirm()

    expect(dialog.className).toMatch(/max-sm:bottom-/)
    expect(dialog.className).toMatch(/max-sm:top-auto/)
  })

  it('c · plafond du jour entamé : le déjà-parti est dit, quatre parts, confirmation en dates', async () => {
    withPlan(
      planOf({
        dailySendCap: 100,
        allottedToday: 40,
        parts: [
          {day: '2026-11-12', count: 60},
          {day: '2026-11-13', count: 100},
          {day: '2026-11-14', count: 100},
          {day: '2026-11-15', count: 36},
        ],
      })
    )
    renderComposer()
    await openPreview()

    expect(planSection()).toHaveTextContent(
      '40 envois de campagne sont déjà partis aujourd’hui : celle-ci commence avec les 60 qui restent.'
    )
    expect(planSection()).toHaveTextContent('Elle part en 4 jours :')
    expect(within(planSection()).getAllByRole('listitem')).toHaveLength(4)

    const dialog = await openConfirm()
    expect(dialog).toHaveTextContent(
      'en 4 jours : 60 le 12/11/2026, 100 le 13/11/2026, 100 le 14/11/2026, 36 le 15/11/2026.'
    )
  })

  it('d · plafond du jour atteint : avertissement, la première part part demain', async () => {
    withPlan(
      planOf({
        dailySendCap: 100,
        allottedToday: 100,
        parts: [
          {day: '2026-11-13', count: 100},
          {day: '2026-11-14', count: 100},
          {day: '2026-11-15', count: 96},
        ],
      })
    )
    renderComposer()
    await openPreview()

    const warning = screen.getByRole('alert')
    expect(warning).toHaveTextContent(
      'Attention : les envois de campagne du jour sont déjà complets. La première part partira demain, le 13/11/2026.'
    )
    expect(warning).toHaveClass('bg-warning')
    expect(planSection()).toHaveTextContent(
      'Elle part en 3 jours, à partir de demain :'
    )
    expect(planSection()).not.toHaveTextContent('déjà partis aujourd’hui')

    const dialog = await openConfirm()
    expect(dialog).toHaveTextContent(
      'en 3 jours : 100 le 13/11/2026, 100 le 14/11/2026, 96 le 15/11/2026.'
    )
  })

  it('aucun état ne dit « trop de destinataires » : une grosse campagne s’étale', async () => {
    withPlan(
      planOf({
        dailySendCap: 100,
        parts: Array.from({length: 6}, (_, index) => ({
          day: `2026-11-${12 + index}`,
          count: 100,
        })),
      })
    )
    renderComposer()
    await openPreview()

    expect(document.body).not.toHaveTextContent(/trop de destinataires/i)
    expect(
      screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    ).toBeEnabled()
  })

  it('les actions s’empilent en mobile et le bouton principal fait 56 px', async () => {
    renderComposer()
    await openPreview()

    const send = screen.getByRole('button', {name: 'Envoyer à 296 membres'})
    expect(send).toHaveClass('h-14', 'w-full', 'sm:w-auto')
    expect(send.parentElement).toHaveClass('flex-col', 'sm:flex-row')
  })
})

describe('CampaignComposer — choix de la cible (s27, écran 1)', () => {
  const targetGroup = () =>
    screen.getByRole('radiogroup', {name: 'Qui reçoit cette campagne ?'})

  it('propose trois cibles, « Tous les membres » d’abord, sans relire le décompte', () => {
    renderComposer()

    const radios = within(targetGroup()).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(
      within(targetGroup()).getByRole('radio', {name: /Tous les membres/})
    ).toBeChecked()
    expect(
      within(targetGroup()).getByRole('radio', {
        name: /Les membres en impayé/,
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Calculé au moment de l’envoi, d’après les factures. Une facture « à classer » ne compte pas.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', {name: 'Groupe'})).toBeNull()
    expect(targetAction).not.toHaveBeenCalled()
  })

  it('« Un groupe » révèle le select des groupes et le lien « Gérer les groupes », puis relit le décompte', async () => {
    renderComposer()

    await userEvent.click(
      within(targetGroup()).getByRole('radio', {name: /Un groupe/})
    )

    expect(screen.getByRole('combobox', {name: 'Groupe'})).toHaveTextContent(
      'Riverains du chemin des Crêtes (38 fiches)'
    )
    expect(
      screen.getByRole('link', {name: 'Gérer les groupes'})
    ).toHaveAttribute('href', '/bureau/groupes')
    await waitFor(() =>
      expect(targetAction).toHaveBeenCalledWith(
        {kind: 'group', groupId: GROUP_ID},
        'free'
      )
    )
    const fiches = within(recipientsCard()).getByRole('group', {
      name: 'Fiches',
    })
    expect(await within(fiches).findByText('38')).toBeInTheDocument()
  })

  it('aucun groupe : le dit, avec un lien pour en créer un, sans relecture', async () => {
    renderComposer(contextOf({groups: []}))

    await userEvent.click(
      within(targetGroup()).getByRole('radio', {name: /Un groupe/})
    )

    expect(screen.getByText(/Aucun groupe pour l’instant/)).toBeInTheDocument()
    expect(screen.getByRole('link', {name: 'Créer un groupe'})).toHaveAttribute(
      'href',
      '/bureau/groupes'
    )
    expect(targetAction).not.toHaveBeenCalled()
  })

  it('« impayés » sans personne : le dit, « Voir l’aperçu » reste actif', async () => {
    targetAction.mockResolvedValue({
      status: 'ok',
      counts: {
        profilesWithEmail: 0,
        profilesWithoutEmail: 0,
        profiles: 0,
        recipients: 0,
        unsubscribed: 0,
        reinstated: 0,
        nature: 'facultative' as const,
      },
      reachableMembers: [],
    })
    renderComposer()

    await userEvent.click(
      within(targetGroup()).getByRole('radio', {name: /impayé/})
    )

    expect(
      await screen.findByText(
        'Aucun membre n’est en impayé aujourd’hui. Rien ne peut être envoyé.'
      )
    ).toBeInTheDocument()
    expect(targetAction).toHaveBeenCalledWith({kind: 'unpaid_members'}, 'free')
    expect(screen.getByRole('button', {name: 'Voir l’aperçu'})).toBeEnabled()
  })

  it('factures illisibles : alerte ancrée, jamais de repli sur « tous »', async () => {
    targetAction.mockResolvedValue({
      status: 'error',
      message: messages.CampaignsBureau.errors.unpaidUnavailable,
    })
    renderComposer()

    await userEvent.click(
      within(targetGroup()).getByRole('radio', {name: /impayé/})
    )

    expect(
      await screen.findByText(messages.CampaignsBureau.errors.unpaidUnavailable)
    ).toBeInTheDocument()
    expect(
      within(recipientsCard()).queryByRole('group', {name: 'Fiches'})
    ).toBeNull()
  })

  it('la cible choisie part avec l’aperçu et avec l’envoi', async () => {
    renderComposer()
    await userEvent.click(
      within(targetGroup()).getByRole('radio', {name: /Un groupe/})
    )
    await waitFor(() => expect(targetAction).toHaveBeenCalled())

    await openPreview()
    expect(sentFields(previewAction)).toMatchObject({
      targetKind: 'group',
      targetGroupId: GROUP_ID,
    })
  })

  it('« tous » part avec l’aperçu, sans groupe', async () => {
    renderComposer()
    await openPreview()

    expect(sentFields(previewAction).targetKind).toBe('all_members')
    expect(sentFields(previewAction)).not.toHaveProperty('targetGroupId')
  })
})

describe('CampaignComposer — nature des envois (s27b, écrans 2 et 3)', () => {
  const templateGroup = () => screen.getByRole('radiogroup', {name: /modèle/i})
  const statutoryCounts = {
    profilesWithEmail: 311,
    profilesWithoutEmail: 71,
    profiles: 382,
    recipients: 311,
    unsubscribed: 0,
    reinstated: 15,
    nature: 'statutaire' as const,
  }

  it('écrit sous chaque modèle sa nature, lue dans les réglages, sans contrôle pour la changer', () => {
    renderComposer()

    const statutory =
      'Envoi statutaire : les membres désinscrits le reçoivent aussi.'
    const optional =
      'Envoi facultatif : les membres désinscrits ne le reçoivent pas.'
    const free = within(templateGroup()).getByRole('radio', {
      name: /Message libre/,
    })
    expect(free).toHaveAccessibleDescription(expect.stringContaining(optional))
    const assembly = within(templateGroup()).getByRole('radio', {
      name: /Convocation/,
    })
    expect(assembly).toHaveAccessibleDescription(
      expect.stringContaining(statutory)
    )
    expect(within(templateGroup()).getAllByText(statutory)).toHaveLength(3)
    expect(within(templateGroup()).getAllByText(optional)).toHaveLength(2)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('radio', {name: /statutaire/i})).toBeNull()
  })

  it('choisir un modèle statutaire relit le décompte : les désinscrits le reçoivent, et la note le dit', async () => {
    let settle: (result: CampaignTargetActionResult) => void = () => {}
    targetAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          settle = resolve
        })
    )
    renderComposer()

    await userEvent.click(
      within(templateGroup()).getByRole('radio', {name: /Convocation/})
    )

    expect(targetAction).toHaveBeenCalledWith(
      {kind: 'all_members'},
      'general_assembly'
    )
    expect(
      recipientsCard().querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    settle({
      status: 'ok',
      counts: statutoryCounts,
      reachableMembers: [{id: PROFILE_A, name: 'Claire Aubert'}],
    })

    const adresses = within(recipientsCard()).getByRole('group', {
      name: 'Adresses',
    })
    expect(
      await within(adresses).findByText(
        'Elles reçoivent celle-ci : c’est un envoi statutaire.'
      )
    ).toBeInTheDocument()
    expect(within(adresses).getByText('311')).toBeInTheDocument()
    expect(within(adresses).getByText('15')).toBeInTheDocument()
    expect(
      within(adresses).queryByText('Elles ne reçoivent pas les campagnes.')
    ).toBeNull()
  })

  it('revenir au message libre sur « tous » reprend le décompte initial, sans relecture', async () => {
    targetAction.mockResolvedValue({
      status: 'ok',
      counts: statutoryCounts,
      reachableMembers: [],
    })
    renderComposer()

    await userEvent.click(
      within(templateGroup()).getByRole('radio', {name: /Convocation/})
    )
    await waitFor(() => expect(targetAction).toHaveBeenCalledTimes(1))
    await userEvent.click(
      within(templateGroup()).getByRole('radio', {name: /Message libre/})
    )

    const adresses = within(recipientsCard()).getByRole('group', {
      name: 'Adresses',
    })
    expect(
      await within(adresses).findByText('Elles ne reçoivent pas les campagnes.')
    ).toBeInTheDocument()
    expect(within(adresses).getByText('296')).toBeInTheDocument()
    expect(targetAction).toHaveBeenCalledTimes(1)
  })

  it('la cible relue garde le modèle choisi', async () => {
    targetAction.mockResolvedValue({
      status: 'ok',
      counts: statutoryCounts,
      reachableMembers: [],
    })
    renderComposer()

    await userEvent.click(
      within(templateGroup()).getByRole('radio', {name: /Convocation/})
    )
    await userEvent.click(
      within(
        screen.getByRole('radiogroup', {name: 'Qui reçoit cette campagne ?'})
      ).getByRole('radio', {name: /impayé/})
    )

    await waitFor(() =>
      expect(targetAction).toHaveBeenLastCalledWith(
        {kind: 'unpaid_members'},
        'general_assembly'
      )
    )
  })

  it('aucune nature ne part avec l’aperçu ni avec l’envoi', async () => {
    renderComposer()
    await openPreview()

    expect(Object.keys(sentFields(previewAction))).not.toContain('nature')
  })

  it('aperçu d’un envoi statutaire : le rappel compte les désinscrits parmi ceux qui le recevront', async () => {
    previewAction.mockResolvedValue({
      status: 'ok',
      preview: previewOf({counts: statutoryCounts}),
      plan: planOf({parts: [{day: '2026-11-12', count: 311}]}),
    })
    renderComposer()
    await openPreview()

    expect(
      screen.getByRole('region', {name: 'Destinataires et plan d’envoi'})
    ).toHaveTextContent(
      '311 membres recevront cette campagne, dont 15 désinscrits (envoi statutaire) · 71 sans email n’en recevront pas.'
    )
  })
})
