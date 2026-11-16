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
  getBooleanSettingService: vi.fn(() => Promise.resolve(true)),
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
import {claimReportableSendTxnDao} from '@/db/repositories/email-send-budget-repository'
import {getEmailTransport} from '@/lib/emails/transport'
import {sendMemberEmailConfirmationEmailService} from '@/services/email-service'

describe('sendMemberEmailConfirmationEmailService — le lien de confirmation (s54, écran 2)', () => {
  const token = 'Xk3abc'.padEnd(43, 'Q')
  const url = `https://clos-fleuri.test/confirmer-adresse/${token}`
  const pendingEmailId = '33333333-3333-4333-8333-333333333333'
  const send = () =>
    sendMemberEmailConfirmationEmailService({
      organizationId: '11111111-1111-4111-8111-111111111111',
      email: 'marc@exemple.test',
      url,
      token,
      pendingEmailId,
      association: {name: 'Clos-Fleuri', hue: 195},
      authorName: 'Claire Dubois',
      profileName: 'Jean Dubois',
      parcelNumbers: ['21'],
      expiresAt: new Date('2026-11-23T10:00:00Z'),
      locale: 'fr',
    })

  beforeEach(() => {
    memoryTransport.messages.length = 0
    vi.mocked(getEmailTransport).mockReturnValue(memoryTransport)
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(true)
    vi.mocked(createDeferredEmailTxnDao).mockResolvedValue({id: 'deferred'})
  })

  it('envoie à l’adresse à confirmer, objet préfixé par l’association, texte brut complet avec l’URL', async () => {
    const result = await send()

    expect(result).toEqual({status: 'sent'})
    expect(memoryTransport.messages).toHaveLength(1)
    const [sent] = memoryTransport.messages
    expect(sent.to).toBe('marc@exemple.test')
    expect(sent.subject).toMatch(/Clos-Fleuri — Confirmez votre adresse email$/)
    expect(sent.text).toContain(url)
    expect(sent.text).toContain('Claire Dubois a ajouté cette adresse')
    expect(sent.text).toContain('Ce lien vaut jusqu’au 23 novembre 2026.')
  })

  it('budget épuisé : l’email reporté ne garde ni le jeton ni l’échéance, seulement l’attente qu’il couvre (revue M1, ADR 056 §1)', async () => {
    vi.mocked(claimReportableSendTxnDao).mockResolvedValue(false)

    const result = await send()

    expect(result.status).toBe('deferred')
    expect(memoryTransport.messages).toHaveLength(0)
    expect(createDeferredEmailTxnDao).toHaveBeenCalledTimes(1)
    const [stored] = vi.mocked(createDeferredEmailTxnDao).mock.calls[0]
    const kept = JSON.stringify(stored)
    expect(kept).not.toContain(token)
    expect(kept).not.toContain('23 novembre 2026')
    expect(stored.textBody).toContain(
      'https://clos-fleuri.test/confirmer-adresse/'
    )
    expect(stored).toMatchObject({
      nature: 'member_email_confirmation',
      recipient: 'marc@exemple.test',
      referenceType: 'member_profile_email',
      referenceId: pendingEmailId,
    })
  })
})
