import {beforeEach, describe, expect, it, vi} from 'vitest'

import {createMemoryTransport} from '@/lib/emails/transport/memory-transport'

const memoryTransport = createMemoryTransport()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))
vi.mock('@/lib/emails/transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/emails/transport')>()),
  getEmailTransport: vi.fn(() => memoryTransport),
}))
vi.mock('@/services/app-settings-service', () => ({
  getBooleanSettingService: vi.fn(() => Promise.resolve(false)),
  getStringSettingService: vi.fn(() => Promise.resolve('')),
}))
vi.mock('@/services/subscription-service', () => ({
  getPlanByPriceIdService: vi.fn(),
}))
vi.mock('@/lib/stripe/stripe-utils', () => ({
  getFormattedPriceFromSubscription: vi.fn(),
  getSubscriptionDetails: vi.fn(),
}))
vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn((_organizationId: string, callback: () => unknown) =>
    callback()
  ),
}))
vi.mock('@/db/repositories/email-send-budget-repository', () => ({
  claimReportableSendTxnDao: vi.fn(async () => true),
  countLoginSendTxnDao: vi.fn(async () => undefined),
  refundReportableSendTxnDao: vi.fn(async () => undefined),
}))
vi.mock('@/db/repositories/deferred-email-repository', () => ({
  createDeferredEmailTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/scheduled-job-repository', () => ({
  enqueueScheduledJobTxnDao: vi.fn(),
}))
vi.mock('@/lib/better-auth/invitation-link', () => ({
  revokeInvitationLink: vi.fn(),
}))
vi.mock('@/services/association-settings-service', async () => {
  const settings =
    await import('@/services/types/domain/association-settings-types')
  return {
    getAssociationSettingsService: vi.fn(async () =>
      settings.resolveSettings(settings.ASSOCIATION_SETTINGS_REGISTRY, [])
    ),
  }
})

import {createDeferredEmailTxnDao} from '@/db/repositories/deferred-email-repository'
import {
  claimReportableSendTxnDao,
  countLoginSendTxnDao,
} from '@/db/repositories/email-send-budget-repository'
import {revokeInvitationLink} from '@/lib/better-auth/invitation-link'
import {getEmailTransport} from '@/lib/emails/transport'
import {logger} from '@/lib/logger'
import {sendInvitationEmailService} from '@/services/email-service'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const TOKEN = 'InvitationToken'.padEnd(32, 'Z')
const URL = `https://clos-fleuri.test/api/auth/magic-link/verify?token=${TOKEN}&callbackURL=https%3A%2F%2Fclos-fleuri.test%2Flogin%2Fdestination`

const send = (text: string | null = null) =>
  sendInvitationEmailService({
    organizationId: ORG_ID,
    email: 'jean.dubois@exemple.test',
    url: URL,
    token: TOKEN,
    association: {name: 'Clos-Fleuri', hue: 195},
    text,
    expiresAt: new Date('2026-12-01T09:00:00Z'),
    locale: 'fr',
  })

describe('sendInvitationEmailService — l’email d’invitation (s42a, écran 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(createDeferredEmailTxnDao).mockResolvedValue({id: 'deferred'})
  })

  it('envoie, même envois aux membres coupés, objet préfixé par l’association, texte brut complet', async () => {
    const result = await send()

    expect(result).toEqual({status: 'sent'})
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('jean.dubois@exemple.test')
    expect(sent.subject).toMatch(
      /Clos-Fleuri — Votre espace membre vous attend$/
    )
    expect(sent.text).toContain('Votre espace sur le site de Clos-Fleuri')
    expect(sent.text).toContain(
      'Votre association a ouvert sur son site un espace personnel'
    )
    expect(sent.text).toContain(URL)
    expect(sent.text).toContain(
      'Ce lien vaut jusqu’au 1 décembre 2026 et ne sert qu’une fois.'
    )
    expect(sent.text).toContain('aucun mot de passe')
    expect(sent.text).toContain('le bureau de Clos-Fleuri vous a invité')
  })

  it('reprend le texte de l’association tel qu’écrit, une balise restant du texte', async () => {
    await send('Bonjour,\n\nVenez voir <b>le site</b>.')

    const [sent] = memoryTransport.messages
    expect(sent.text).toContain('Venez voir <b>le site</b>.')
    expect(sent.html).toContain('Venez voir &lt;b&gt;le site&lt;/b&gt;.')
    expect(sent.text).not.toContain('Votre association a ouvert')
  })

  it('décompte le budget de l’association comme un envoi reportable de nature « invitation »', async () => {
    await send()

    expect(claimReportableSendTxnDao).toHaveBeenCalledWith(
      expect.objectContaining({organizationId: ORG_ID})
    )
    expect(countLoginSendTxnDao).not.toHaveBeenCalled()
  })

  it('ne journalise ni l’URL ni le jeton', async () => {
    await send()

    const logged = JSON.stringify(
      Object.values(vi.mocked(logger)).flatMap((fn) =>
        vi.isMockFunction(fn) ? fn.mock.calls : []
      )
    )
    expect(logged).not.toContain(TOKEN)
    expect(logged).not.toContain('magic-link/verify')
  })
})

describe('sendInvitationEmailService — budget épuisé : l’invitation est reportée (s42a, ADR 071 §4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)
    vi.mocked(createDeferredEmailTxnDao).mockResolvedValue({id: 'deferred'})
  })

  it('l’email conservé ne contient ni le lien, ni le jeton, ni la date de validité', async () => {
    const result = await send()

    expect(result.status).toBe('deferred')
    expect(memoryTransport.messages).toHaveLength(0)
    expect(createDeferredEmailTxnDao).toHaveBeenCalledTimes(1)
    const [stored] = vi.mocked(createDeferredEmailTxnDao).mock.calls[0]
    const kept = JSON.stringify(stored)
    expect(kept).not.toContain(TOKEN)
    expect(kept).not.toContain('magic-link/verify')
    expect(kept).not.toContain('1 décembre 2026')
    expect(stored).toMatchObject({
      nature: 'invitation',
      recipient: 'jean.dubois@exemple.test',
      confirmationTokenHash: null,
    })
    expect(stored.textBody).toContain('Votre espace sur le site de Clos-Fleuri')
  })

  it('le jeton émis pour l’envoi refusé est révoqué', async () => {
    await send()

    expect(revokeInvitationLink).toHaveBeenCalledWith(TOKEN)
  })
})
