import {beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    const previous = scope.current
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = previous
    }
  }),
}))
vi.mock('@/db/repositories/member-invoice-repository', () => ({
  claimStatusAlertDao: vi.fn(),
  releaseStatusAlertDao: vi.fn(),
  countInvoicesByStatusDao: vi.fn(),
}))
vi.mock('@/db/repositories/organization-repository', () => ({
  getOrganizationByIdDao: vi.fn(),
}))
vi.mock('../association-settings-service', () => ({
  getAssociationSettingsService: vi.fn(),
}))
vi.mock('../parcel-ownership-service', () => ({
  getParcelOwnerAtService: vi.fn(),
}))
vi.mock('../email-service', () => ({
  sendInvoiceStatusAlertEmailService: vi.fn(),
}))

import {
  claimStatusAlertDao,
  countInvoicesByStatusDao,
  releaseStatusAlertDao,
} from '@/db/repositories/member-invoice-repository'
import {getOrganizationByIdDao} from '@/db/repositories/organization-repository'
import {logger} from '@/lib/logger'

import {getAssociationSettingsService} from '../association-settings-service'
import {sendInvoiceStatusAlertEmailService} from '../email-service'
import {signalUnknownInvoiceStatuses} from '../member-invoice-service'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  BILLING_ALERT_EMAIL_SETTING_KEY,
  BILLING_SETTLED_STATUSES_SETTING_KEY,
  BILLING_UNPAID_STATUSES_SETTING_KEY,
  CONTACT_EMAIL_SETTING_KEY,
  resolveSettings,
} from '../types/domain/association-settings-types'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const ALERT_ID = '77777777-7777-4777-8777-777777777777'

const settingsWith = (rows: {key: string; value: string}[] = []) =>
  resolveSettings(ASSOCIATION_SETTINGS_REGISTRY, [
    {key: CONTACT_EMAIL_SETTING_KEY, value: 'contact@asl.test'},
    {key: BILLING_UNPAID_STATUSES_SETTING_KEY, value: 'En attente'},
    {key: BILLING_SETTLED_STATUSES_SETTING_KEY, value: 'Payée'},
    ...rows,
  ])

/** La base des alertes, en mémoire : une réclamation par statut. */
let claimed: Set<string>

beforeEach(() => {
  vi.clearAllMocks()
  claimed = new Set()
  vi.mocked(getAssociationSettingsService).mockResolvedValue(settingsWith())
  vi.mocked(getOrganizationByIdDao).mockResolvedValue({
    id: ORG_ID,
    name: 'Clos-Fleuri',
    domain: 'clos-fleuri.test',
    identityLogoKey: null,
  } as never)
  vi.mocked(claimStatusAlertDao).mockImplementation(async (org, status) => {
    expect(scope.current).toBe(ORG_ID)
    expect(org).toBe(ORG_ID)
    if (claimed.has(status)) return undefined
    claimed.add(status)
    return {id: ALERT_ID}
  })
  vi.mocked(releaseStatusAlertDao).mockImplementation(async (_org, status) => {
    expect(scope.current).toBe(ORG_ID)
    claimed.delete(status)
  })
  vi.mocked(countInvoicesByStatusDao).mockResolvedValue(4)
  vi.mocked(sendInvoiceStatusAlertEmailService).mockResolvedValue({
    status: 'sent',
  })
})

describe('signalUnknownInvoiceStatuses — un statut à classer est signalé une fois (critère 6, ADR 059 §5)', () => {
  it('premier passage : un email au destinataire paramétré, statut et nombre de factures, rien de nominatif', async () => {
    vi.mocked(getAssociationSettingsService).mockResolvedValue(
      settingsWith([
        {key: BILLING_ALERT_EMAIL_SETTING_KEY, value: 'presidente@asl.test'},
      ])
    )

    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])

    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledTimes(1)
    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      alertId: ALERT_ID,
      to: 'presidente@asl.test',
      locale: 'fr',
      association: {name: 'Clos-Fleuri', hue: 195},
      status: 'Relance 9',
      invoiceCount: 4,
      settingsUrl: expect.stringMatching(
        /^https?:\/\/clos-fleuri\.test(:\d+)?\/bureau\/reglages$/
      ),
    })
  })

  it('le destinataire se replie sur l’adresse de contact', async () => {
    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])

    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledWith(
      expect.objectContaining({to: 'contact@asl.test'})
    )
  })

  it('second passage : aucun envoi', async () => {
    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])
    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])

    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledTimes(1)
  })

  it('un lot portant plusieurs fois le même statut : un seul envoi', async () => {
    await signalUnknownInvoiceStatuses(ORG_ID, [
      'Relance 9',
      ' Relance 9 ',
      'Relance 9',
    ])

    expect(claimStatusAlertDao).toHaveBeenCalledTimes(1)
    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledTimes(1)
  })

  it('un statut classé ne déclenche rien', async () => {
    await signalUnknownInvoiceStatuses(ORG_ID, ['Payée', 'En attente'])

    expect(claimStatusAlertDao).not.toHaveBeenCalled()
    expect(sendInvoiceStatusAlertEmailService).not.toHaveBeenCalled()
  })

  it('échec d’envoi : le signalement est libéré, journalisé sans contenu, renvoyé au passage suivant, et rien ne lève', async () => {
    vi.mocked(sendInvoiceStatusAlertEmailService).mockRejectedValueOnce(
      new Error('brevo refuse')
    )

    await expect(
      signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])
    ).resolves.toBeUndefined()
    expect(releaseStatusAlertDao).toHaveBeenCalledWith(ORG_ID, 'Relance 9')
    expect(logger.error).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls[0])
    expect(logged).not.toContain('Relance 9')
    expect(logged).not.toContain('contact@asl.test')
    expect(logged).not.toContain('brevo refuse')

    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])
    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledTimes(2)
  })

  it('budget épuisé : l’envoi est reporté, pas un échec — le signalement reste posé', async () => {
    vi.mocked(sendInvoiceStatusAlertEmailService).mockResolvedValueOnce({
      status: 'deferred',
      until: '2026-11-18',
    })

    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])
    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])

    expect(releaseStatusAlertDao).not.toHaveBeenCalled()
    expect(sendInvoiceStatusAlertEmailService).toHaveBeenCalledTimes(1)
  })

  it('domaine de l’association absent : traité comme un échec, libéré', async () => {
    vi.mocked(getOrganizationByIdDao).mockResolvedValue({
      id: ORG_ID,
      name: 'Clos-Fleuri',
      domain: null,
      identityLogoKey: null,
    } as never)

    await signalUnknownInvoiceStatuses(ORG_ID, ['Relance 9'])

    expect(sendInvoiceStatusAlertEmailService).not.toHaveBeenCalled()
    expect(releaseStatusAlertDao).toHaveBeenCalledWith(ORG_ID, 'Relance 9')
  })
})
