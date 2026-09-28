import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const {scope, counters} = vi.hoisted(() => ({
  scope: {current: undefined as string | undefined},
  /** Ce que la table contiendrait : compte par (association, empreinte, fenetre). */
  counters: new Map<string, number>(),
}))

vi.mock('@/db/tenant-scope', () => ({
  withRlsBypass: vi.fn(),
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
vi.mock('@/db/repositories/organization-repository', () => ({
  getAllOrganizationIdsDao: vi.fn(),
}))
vi.mock('@/db/repositories/rate-limit-repository', () => ({
  incrementRateLimitCounterDao: vi.fn(),
  purgeRateLimitCountersDao: vi.fn(),
}))

import {createHmac} from 'node:crypto'

import {getAllOrganizationIdsDao} from '@/db/repositories/organization-repository'
import {getOrganizationSettingsDao} from '@/db/repositories/organization-setting-repository'
import {
  incrementRateLimitCounterDao,
  purgeRateLimitCountersDao,
} from '@/db/repositories/rate-limit-repository'
import {withRlsBypass, withTenant} from '@/db/tenant-scope'
import {env} from '@/env'
import {logger} from '@/lib/logger'

import {ValidationParsedZodError} from '../errors/validation-error'
import {
  consumeContactMessageQuotaService,
  consumeMagicLinkRequestQuotaService,
  dayWindowStartOf,
  fingerprintOf,
  hourWindowStartOf,
  purgeExpiredRateLimitFingerprintsService,
  RateLimitPurposeConst,
} from '../rate-limit-service'
import {
  CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
  MAGIC_LINK_REQUESTS_PER_DAY_SETTING_KEY,
} from '../types/domain/association-settings-types'
import {setupAuthUserMocked} from './helper-service-test'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
/** 12 h a Paris (heure d'ete, UTC+2). */
const NOW = new Date('2026-09-19T10:00:00.000Z')
/** Minuit a Paris le 19/09/2026 (UTC+2). */
const PARIS_MIDNIGHT = new Date('2026-09-18T22:00:00.000Z')

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
        const id = `${key.organizationId}|${key.fingerprint}|${key.windowStart.toISOString()}`
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
      windowStart: PARIS_MIDNIGHT,
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

    expect(
      incrementCalls().map(({windowStart}) => windowStart.toISOString())
    ).toEqual([
      '2026-09-18T22:00:00.000Z',
      '2026-09-18T22:00:00.000Z',
      '2026-09-18T22:00:00.000Z',
      '2026-09-18T22:00:00.000Z',
      '2026-09-19T22:00:00.000Z',
    ])
  })

  it('purge les compteurs des jours passés à chaque demande', async () => {
    await request()

    expect(purgeRateLimitCountersDao).toHaveBeenCalledWith(
      ORG_ID,
      PARIS_MIDNIGHT
    )
  })

  it('garde l’empreinte de s03 : même chaîne d’usage, même empreinte pour la même adresse', async () => {
    await request()

    const expected = createHmac('sha256', env.BETTER_AUTH_SECRET)
      .update(`${ORG_ID}\nmagic_link.address\n${email}`)
      .digest('hex')
    expect(incrementCalls()[0].fingerprint).toBe(expected)
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

describe('fingerprintOf — empreinte HMAC liée à l’association et à l’usage', () => {
  const ip = '203.0.113.7'

  it('garde la chaîne d’usage de s03 au caractère près', () => {
    expect(RateLimitPurposeConst.MAGIC_LINK_ADDRESS).toBe('magic_link.address')
    expect(RateLimitPurposeConst.CONTACT_IP).toBe('contact.ip')
  })

  it('est un HMAC de 64 caractères hexadécimaux qui ne contient pas la valeur', () => {
    const fingerprint = fingerprintOf(
      ORG_ID,
      RateLimitPurposeConst.CONTACT_IP,
      ip
    )

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(fingerprint).not.toContain(ip)
    expect(fingerprint).not.toContain('203')
  })

  it('deux usages, même association, même valeur : deux empreintes', () => {
    expect(
      fingerprintOf(ORG_ID, RateLimitPurposeConst.CONTACT_IP, ip)
    ).not.toBe(
      fingerprintOf(ORG_ID, RateLimitPurposeConst.MAGIC_LINK_ADDRESS, ip)
    )
  })

  it('deux associations, même IP : deux empreintes', () => {
    expect(
      fingerprintOf(ORG_ID, RateLimitPurposeConst.CONTACT_IP, ip)
    ).not.toBe(
      fingerprintOf(OTHER_ORG_ID, RateLimitPurposeConst.CONTACT_IP, ip)
    )
  })
})

describe('fenêtres du compteur', () => {
  it('le jour commence à minuit à Paris, en été comme en hiver', () => {
    expect(dayWindowStartOf(NOW)).toEqual(PARIS_MIDNIGHT)
    expect(dayWindowStartOf(new Date('2026-12-01T10:00:00.000Z'))).toEqual(
      new Date('2026-11-30T23:00:00.000Z')
    )
    expect(dayWindowStartOf(new Date('2026-09-18T22:30:00.000Z'))).toEqual(
      PARIS_MIDNIGHT
    )
  })

  it('l’heure commence à la minute zéro', () => {
    expect(hourWindowStartOf(new Date('2026-09-19T10:59:59.999Z'))).toEqual(
      new Date('2026-09-19T10:00:00.000Z')
    )
    expect(hourWindowStartOf(new Date('2026-09-19T11:00:00.000Z'))).toEqual(
      new Date('2026-09-19T11:00:00.000Z')
    )
  })
})

describe('[PUBLIC] consumeContactMessageQuotaService — N envois par heure et par visiteur', () => {
  const ip = '203.0.113.7'
  /** 12 h 25 a Paris. */
  const CONTACT_NOW = new Date('2026-09-19T10:25:00.000Z')

  const submit = (organizationId = ORG_ID, address: string | undefined = ip) =>
    consumeContactMessageQuotaService({organizationId, ip: address})

  const settingRow = (value: string) => ({
    organizationId: ORG_ID,
    key: CONTACT_MESSAGES_PER_HOUR_SETTING_KEY,
    value,
    updatedAt: CONTACT_NOW,
    updatedBy: null,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(CONTACT_NOW)
    setupAuthUserMocked(undefined)
    counters.clear()
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([])
    vi.mocked(incrementRateLimitCounterDao).mockImplementation(
      async (key: CounterKey) => {
        const id = `${key.organizationId}|${key.fingerprint}|${key.windowStart.toISOString()}`
        const count = (counters.get(id) ?? 0) + 1
        counters.set(id, count)
        return count
      }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepte trois envois par défaut et refuse le quatrième, en rendant le seuil', async () => {
    expect(await submit()).toEqual({allowed: true, limit: 3})
    expect(await submit()).toEqual({allowed: true, limit: 3})
    expect(await submit()).toEqual({allowed: true, limit: 3})
    expect(await submit()).toEqual({allowed: false, limit: 3})
  })

  it('lit le seuil dans les paramètres de l’association, pas en dur', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([settingRow('1')])

    expect(await submit()).toEqual({allowed: true, limit: 1})
    expect(await submit()).toEqual({allowed: false, limit: 1})

    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([settingRow('5')])
    expect(await submit()).toEqual({allowed: true, limit: 5})
  })

  it('compte dans la fenêtre de l’heure courante, sous l’usage « contact », dans le scope du tenant', async () => {
    vi.mocked(incrementRateLimitCounterDao).mockImplementationOnce(async () => {
      expect(scope.current).toBe(ORG_ID)
      return 1
    })

    await submit()

    expect(incrementCalls()).toEqual([
      {
        organizationId: ORG_ID,
        fingerprint: fingerprintOf(
          ORG_ID,
          RateLimitPurposeConst.CONTACT_IP,
          ip
        ),
        windowStart: new Date('2026-09-19T10:00:00.000Z'),
      },
    ])
  })

  it('une nouvelle heure remet le compteur à zéro', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([settingRow('1')])
    await submit()
    expect(await submit()).toMatchObject({allowed: false})

    vi.setSystemTime(new Date('2026-09-19T11:00:00.000Z'))
    expect(await submit()).toMatchObject({allowed: true})
  })

  it('purge à chaque envoi les empreintes de plus de 24 h, avant de compter', async () => {
    await submit()

    expect(purgeRateLimitCountersDao).toHaveBeenCalledWith(
      ORG_ID,
      new Date('2026-09-18T10:25:00.000Z')
    )
    expect(
      vi.mocked(purgeRateLimitCountersDao).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(incrementRateLimitCounterDao).mock.invocationCallOrder[0]
    )
  })

  it('deux IP ont chacune leur compteur', async () => {
    vi.mocked(getOrganizationSettingsDao).mockResolvedValue([settingRow('1')])
    await submit()

    expect(await submit(ORG_ID, '198.51.100.4')).toMatchObject({
      allowed: true,
    })
  })

  it('ne transmet jamais l’IP en clair à la base', async () => {
    await submit()

    const stored = JSON.stringify([
      vi.mocked(incrementRateLimitCounterDao).mock.calls,
      vi.mocked(purgeRateLimitCountersDao).mock.calls,
    ])
    expect(stored).not.toContain(ip)
  })

  it.each([undefined, '', '   '])(
    'sans IP résoluble (%j) : laisse passer sans compter, et le signale',
    async (missing) => {
      expect(
        await consumeContactMessageQuotaService({
          organizationId: ORG_ID,
          ip: missing,
        })
      ).toMatchObject({allowed: true})

      expect(incrementRateLimitCounterDao).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    }
  )

  it('refuse un identifiant d’association invalide sans toucher la base', async () => {
    await expect(submit('pas-un-uuid')).rejects.toThrow(
      ValidationParsedZodError
    )

    expect(incrementRateLimitCounterDao).not.toHaveBeenCalled()
    expect(purgeRateLimitCountersDao).not.toHaveBeenCalled()
    expect(withTenant).not.toHaveBeenCalled()
  })
})

describe('purgeExpiredRateLimitFingerprintsService — purge appelable seule, hors requête', () => {
  const PURGE_NOW = new Date('2026-09-19T10:25:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(PURGE_NOW)
    setupAuthUserMocked(undefined)
    vi.mocked(getAllOrganizationIdsDao).mockResolvedValue([
      ORG_ID,
      OTHER_ORG_ID,
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('purge chaque association dans son propre scope, et rend le compte', async () => {
    const scopes: (string | undefined)[] = []
    vi.mocked(purgeRateLimitCountersDao).mockImplementation(
      async (organizationId: string) => {
        scopes.push(scope.current)
        return organizationId === ORG_ID ? 2 : 1
      }
    )

    const result = await purgeExpiredRateLimitFingerprintsService()

    expect(result).toEqual({organizations: 2, deleted: 3})
    expect(scopes).toEqual([ORG_ID, OTHER_ORG_ID])
    expect(vi.mocked(purgeRateLimitCountersDao).mock.calls).toEqual([
      [ORG_ID, new Date('2026-09-18T10:25:00.000Z')],
      [OTHER_ORG_ID, new Date('2026-09-18T10:25:00.000Z')],
    ])
  })

  it('n’ouvre jamais la porte dérobée de la RLS', async () => {
    vi.mocked(purgeRateLimitCountersDao).mockResolvedValue(0)

    await purgeExpiredRateLimitFingerprintsService()

    expect(withRlsBypass).not.toHaveBeenCalled()
    expect(withTenant).toHaveBeenCalledTimes(2)
  })

  it('sans association, ne purge rien', async () => {
    vi.mocked(getAllOrganizationIdsDao).mockResolvedValue([])

    expect(await purgeExpiredRateLimitFingerprintsService()).toEqual({
      organizations: 0,
      deleted: 0,
    })
    expect(purgeRateLimitCountersDao).not.toHaveBeenCalled()
  })
})
