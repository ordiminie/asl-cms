import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const {scope, counters} = vi.hoisted(() => ({
  scope: {current: undefined as string | undefined},
  /** Ce que la table contiendrait : compte par (association, empreinte, jour). */
  counters: new Map<string, number>(),
}))

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
  incrementRateLimitCounterDao: vi.fn(),
  purgeRateLimitCountersDao: vi.fn(),
}))

import {getOrganizationSettingsDao} from '@/db/repositories/organization-setting-repository'
import {
  incrementRateLimitCounterDao,
  purgeRateLimitCountersDao,
} from '@/db/repositories/rate-limit-repository'

import {ValidationParsedZodError} from '../errors/validation-error'
import {consumeMagicLinkRequestQuotaService} from '../rate-limit-service'
import {MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY} from '../types/domain/association-settings-types'
import {setupAuthUserMocked} from './helper-service-test'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
/** 12 h a Paris (heure d'ete, UTC+2). */
const NOW = new Date('2026-09-19T10:00:00.000Z')

const email = 'membre@exemple.test'

type CounterKey = Parameters<typeof incrementRateLimitCounterDao>[0]

const incrementCalls = () =>
  vi.mocked(incrementRateLimitCounterDao).mock.calls.map(([key]) => key)

const request = (organizationId = ORG_ID, address = email) =>
  consumeMagicLinkRequestQuotaService({organizationId, email: address})

describe('[PUBLIC] consumeMagicLinkRequestQuotaService — 3 demandes par adresse et par jour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    setupAuthUserMocked(undefined)
    counters.clear()
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
    vi.mocked(incrementRateLimitCounterDao).mockImplementation(
      async (key: CounterKey) => {
        const id = `${key.organizationId}|${key.fingerprint}|${key.day}`
        const count = (counters.get(id) ?? 0) + 1
        counters.set(id, count)
        return count
      }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepte les trois premières demandes du jour et refuse la quatrième', async () => {
    expect(await request()).toEqual({allowed: true})
    expect(await request()).toEqual({allowed: true})
    expect(await request()).toEqual({allowed: true})
    expect(await request()).toEqual({allowed: false})
  })

  it('compte chaque demande par un incrément unique, sous le scope du tenant', async () => {
    vi.mocked(incrementRateLimitCounterDao).mockImplementationOnce(async () => {
      expect(scope.current).toBe(ORG_ID)
      return 1
    })

    await request()

    expect(incrementRateLimitCounterDao).toHaveBeenCalledTimes(1)
    expect(incrementCalls()[0]).toEqual({
      organizationId: ORG_ID,
      fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      day: '2026-09-19',
    })
  })

  it('applique le seuil réglé par le bureau', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([
      {
        organizationId: ORG_ID,
        key: MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
        value: '1',
        updatedAt: NOW,
        updatedBy: null,
      },
    ])

    expect(await request()).toEqual({allowed: true})
    expect(await request()).toEqual({allowed: false})
  })

  it('un nouveau jour à Paris remet le compteur à zéro', async () => {
    vi.setSystemTime(new Date('2026-09-19T21:59:00.000Z')) // 23 h 59 a Paris
    await request()
    await request()
    await request()
    expect(await request()).toEqual({allowed: false})

    vi.setSystemTime(new Date('2026-09-19T22:00:00.000Z')) // minuit a Paris
    expect(await request()).toEqual({allowed: true})

    expect(incrementCalls().map(({day}) => day)).toEqual([
      '2026-09-19',
      '2026-09-19',
      '2026-09-19',
      '2026-09-19',
      '2026-09-20',
    ])
  })

  it('purge les compteurs des jours passés à chaque demande', async () => {
    await request()

    expect(purgeRateLimitCountersDao).toHaveBeenCalledWith(ORG_ID, '2026-09-19')
  })

  it('la même adresse, casse et espaces mis à part, partage le même compteur', async () => {
    await request(ORG_ID, email)
    await request(ORG_ID, ' Membre@Exemple.TEST ')
    await request(ORG_ID, 'MEMBRE@exemple.test')

    const [first, ...others] = incrementCalls()
    for (const other of others) {
      expect(other.fingerprint).toBe(first.fingerprint)
    }
    expect(await request()).toEqual({allowed: false})
  })

  it('deux adresses ont chacune leur compteur', async () => {
    await request()
    await request()
    await request()

    expect(await request(ORG_ID, 'autre@exemple.test')).toEqual({
      allowed: true,
    })
  })

  it('deux associations n’ont ni la même empreinte ni le même compteur pour la même adresse', async () => {
    await request(ORG_ID)
    await request(ORG_ID)
    await request(ORG_ID)

    expect(await request(OTHER_ORG_ID)).toEqual({allowed: true})
    const calls = incrementCalls()
    const theirs = calls.at(-1) as CounterKey
    expect(theirs.organizationId).toBe(OTHER_ORG_ID)
    expect(theirs.fingerprint).not.toBe(calls[0].fingerprint)
  })

  it('ne transmet jamais l’adresse en clair à la base', async () => {
    await request(ORG_ID, ' Membre@Exemple.TEST ')

    const stored = JSON.stringify([
      vi.mocked(incrementRateLimitCounterDao).mock.calls,
      vi.mocked(purgeRateLimitCountersDao).mock.calls,
    ]).toLowerCase()
    expect(stored).not.toContain('membre@exemple.test')
    expect(stored).not.toContain('membre')
  })

  it('refuse un identifiant d’association invalide sans toucher la base', async () => {
    await expect(request('pas-un-uuid')).rejects.toThrow(
      ValidationParsedZodError
    )

    expect(incrementRateLimitCounterDao).not.toHaveBeenCalled()
    expect(purgeRateLimitCountersDao).not.toHaveBeenCalled()
  })
})
