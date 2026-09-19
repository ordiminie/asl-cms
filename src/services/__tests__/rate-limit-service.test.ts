import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const scope = vi.hoisted(() => ({current: undefined as string | undefined}))

vi.mock('@/db/tenant-scope', () => ({
  withTenant: vi.fn(async (organizationId: string, callback: () => unknown) => {
    scope.current = organizationId
    try {
      return await callback()
    } finally {
      scope.current = undefined
    }
  }),
}))
vi.mock('@/db/repositories/organization-setting-repository', () => ({
  getOrganizationSettingsDao: vi.fn(),
  saveOrganizationSettingsTxnDao: vi.fn(),
}))
vi.mock('@/db/repositories/rate-limit-repository', () => ({
  countRateLimitEventsDao: vi.fn(),
  addRateLimitEventsDao: vi.fn(),
  purgeRateLimitEventsDao: vi.fn(),
}))

import {getOrganizationSettingsDao} from '@/db/repositories/organization-setting-repository'
import {
  addRateLimitEventsDao,
  countRateLimitEventsDao,
  purgeRateLimitEventsDao,
} from '@/db/repositories/rate-limit-repository'

import {ValidationParsedZodError} from '../errors/validation-error'
import {
  consumeMagicLinkRequestQuotaService,
  MAGIC_LINK_ADDRESS_BUCKET,
  MAGIC_LINK_NETWORK_BUCKET,
} from '../rate-limit-service'
import {
  MAGIC_LINK_REQUESTS_PER_ADDRESS_SETTING_KEY,
  MAGIC_LINK_REQUESTS_PER_NETWORK_SETTING_KEY,
} from '../types/domain/association-settings-types'
import {setupAuthUserMocked} from './helper-service-test'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-09-19T10:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const email = 'membre@exemple.test'
const ip = '203.0.113.7'

type CountQuery = Parameters<typeof countRateLimitEventsDao>[0]

/** Compteurs simules par seau : ce que la base rendrait pour l'heure ecoulee. */
const countsAre = (counts: {address?: number; network?: number}) =>
  vi
    .mocked(countRateLimitEventsDao)
    .mockImplementation(async (query: CountQuery) =>
      query.bucket === MAGIC_LINK_ADDRESS_BUCKET
        ? (counts.address ?? 0)
        : (counts.network ?? 0)
    )

const insertedRows = () =>
  vi.mocked(addRateLimitEventsDao).mock.calls.flatMap(([rows]) => rows)

describe('[PUBLIC] consumeMagicLinkRequestQuotaService — seuils de demande de lien', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    setupAuthUserMocked(undefined)
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
    countsAre({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepte sous les seuils et compte la demande par adresse et par accès, sous le scope du tenant', async () => {
    const result = await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
      ip,
    })

    expect(result).toEqual({allowed: true})
    expect(insertedRows()).toEqual([
      {
        organizationId: ORG_ID,
        bucket: MAGIC_LINK_ADDRESS_BUCKET,
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
      {
        organizationId: ORG_ID,
        bucket: MAGIC_LINK_NETWORK_BUCKET,
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    ])
    expect(vi.mocked(addRateLimitEventsDao).mock.calls).toHaveLength(1)
  })

  it('ne stocke ni l’adresse ni l’IP en clair', async () => {
    await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
      ip,
    })

    const stored = JSON.stringify([
      insertedRows(),
      vi.mocked(countRateLimitEventsDao).mock.calls,
    ])
    expect(stored).not.toContain(email)
    expect(stored).not.toContain(ip)
  })

  it('compte sur l’heure glissante et purge ce qui a plus de 24 h', async () => {
    await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
      ip,
    })

    for (const [query] of vi.mocked(countRateLimitEventsDao).mock.calls) {
      expect(query.organizationId).toBe(ORG_ID)
      expect(query.since).toEqual(new Date(NOW.getTime() - HOUR))
    }
    expect(purgeRateLimitEventsDao).toHaveBeenCalledWith(
      ORG_ID,
      new Date(NOW.getTime() - DAY)
    )
  })

  it('refuse au seuil par adresse (5 par défaut), sans rien compter de plus', async () => {
    countsAre({address: 5})

    const result = await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
      ip,
    })

    expect(result).toEqual({allowed: false})
    expect(addRateLimitEventsDao).not.toHaveBeenCalled()
  })

  it('refuse au seuil par accès internet (30 par défaut), toutes adresses confondues', async () => {
    countsAre({network: 30})

    const result = await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
      ip,
    })

    expect(result).toEqual({allowed: false})
    expect(addRateLimitEventsDao).not.toHaveBeenCalled()
  })

  it('applique les seuils réglés par le bureau', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      {
        organizationId: ORG_ID,
        key: MAGIC_LINK_REQUESTS_PER_ADDRESS_SETTING_KEY,
        value: '2',
        updatedAt: NOW,
        updatedBy: null,
      },
      {
        organizationId: ORG_ID,
        key: MAGIC_LINK_REQUESTS_PER_NETWORK_SETTING_KEY,
        value: '100',
        updatedAt: NOW,
        updatedBy: null,
      },
    ])

    countsAre({address: 2})
    expect(
      await consumeMagicLinkRequestQuotaService({
        organizationId: ORG_ID,
        email,
        ip,
      })
    ).toEqual({allowed: false})

    countsAre({address: 1, network: 99})
    expect(
      await consumeMagicLinkRequestQuotaService({
        organizationId: ORG_ID,
        email,
        ip,
      })
    ).toEqual({allowed: true})
  })

  it('sans IP connue, ne compte que par adresse', async () => {
    const result = await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email,
    })

    expect(result).toEqual({allowed: true})
    expect(insertedRows().map((row) => row.bucket)).toEqual([
      MAGIC_LINK_ADDRESS_BUCKET,
    ])
  })

  it('la même adresse, casse et espaces mis à part, a la même empreinte', async () => {
    await consumeMagicLinkRequestQuotaService({organizationId: ORG_ID, email})
    await consumeMagicLinkRequestQuotaService({
      organizationId: ORG_ID,
      email: ' Membre@Exemple.TEST ',
    })

    const [first, second] = insertedRows()
    expect(second.fingerprint).toBe(first.fingerprint)
  })

  it('deux associations n’ont pas la même empreinte pour la même adresse', async () => {
    const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
    await consumeMagicLinkRequestQuotaService({organizationId: ORG_ID, email})
    await consumeMagicLinkRequestQuotaService({
      organizationId: OTHER_ORG_ID,
      email,
    })

    const [first, second] = insertedRows()
    expect(second.organizationId).toBe(OTHER_ORG_ID)
    expect(second.fingerprint).not.toBe(first.fingerprint)
  })

  it('refuse un identifiant d’association invalide sans toucher la base', async () => {
    await expect(
      consumeMagicLinkRequestQuotaService({
        organizationId: 'pas-un-uuid',
        email,
      })
    ).rejects.toThrow(ValidationParsedZodError)

    expect(countRateLimitEventsDao).not.toHaveBeenCalled()
    expect(addRateLimitEventsDao).not.toHaveBeenCalled()
  })
})
