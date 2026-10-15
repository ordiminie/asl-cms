import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/db/repositories/user-repository', () => ({
  getUserByIdDao: vi.fn(),
}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {getUserByIdDao} from '@/db/repositories/user-repository'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {
  ASSOCIATION_SESSION_GUARD_ID,
  associationSessionGuard,
} from './association-session-guard'

const association = (id: string, domain: string): Organization => ({
  id,
  name: `ASL ${id}`,
  slug: id,
  description: null,
  createdAt: null,
  updatedAt: null,
  logo: null,
  metadata: null,
  limitOverrides: null,
  domain,
  enabledModules: [],
  identityLogoKey: null,
  identityFaviconKey: null,
})

const ASSOCIATIONS: Record<string, Organization> = {
  'asso-a.test': association('org-a', 'asso-a.test'),
  'asso-b.test': association('org-b', 'asso-b.test'),
}

const accountOf = (role: string, ...organizationIds: string[]) =>
  ({
    id: 'user-1',
    role,
    organizations: organizationIds.map((organizationId) => ({
      organizationId,
    })),
  }) as never

const session = {userId: 'user-1'}

/** Le hook, tel que Better Auth l'enregistre depuis le plugin. */
const sessionCreateBefore = () => {
  const plugin = associationSessionGuard()
  const hooks = plugin.init().options.databaseHooks
  return hooks.session.create.before
}

/** Mot de passe et double authentification : `context.headers`. */
const withHeaders = (host: string) => ({headers: new Headers({host})})

/** Ouverture d'un lien magique, callback Google : `context.request`. */
const withRequest = (host: string) => ({
  request: new Request(`http://${host}/api/auth/magic-link/verify`, {
    headers: {host},
  }),
})

const MODES = [
  ['mot de passe, 2FA ({headers})', withHeaders],
  ['lien magique, Google ({request})', withRequest],
] as const

describe('associationSessionGuard — session.create.before (ADR 034)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) => ASSOCIATIONS[domain]
    )
  })

  it.each(MODES)('%s : accepte un membre de A sur A', async (_, contextOf) => {
    vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('user', 'org-a'))

    const result = await sessionCreateBefore()(
      session,
      contextOf('asso-a.test:3000')
    )

    expect(result).not.toBe(false)
    expect(getUserByIdDao).toHaveBeenCalledWith('user-1')
  })

  it.each(MODES)('%s : refuse un membre de A sur B', async (_, contextOf) => {
    vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('user', 'org-a'))

    const result = await sessionCreateBefore()(
      session,
      contextOf('asso-b.test')
    )

    expect(result).toBe(false)
  })

  it.each(MODES)(
    '%s : accepte le SuperAdmin sur A, sur B et sur un hôte sans association',
    async (_, contextOf) => {
      vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('super_admin'))
      const before = sessionCreateBefore()

      for (const host of ['asso-a.test', 'asso-b.test', 'plateforme.test']) {
        expect(await before(session, contextOf(host))).not.toBe(false)
      }
    }
  )

  it.each(MODES)(
    '%s : refuse un membre sur un hôte sans association',
    async (_, contextOf) => {
      vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('user', 'org-a'))

      const result = await sessionCreateBefore()(
        session,
        contextOf('plateforme.test')
      )

      expect(result).toBe(false)
    }
  )

  it('refuse quand le contexte est nul ou sans en-têtes (fermé par défaut)', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('user', 'org-a'))
    const before = sessionCreateBefore()

    expect(await before(session, null)).toBe(false)
    expect(await before(session, {})).toBe(false)
  })

  it('accepte le SuperAdmin même quand le contexte est nul', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(accountOf('super_admin'))

    expect(await sessionCreateBefore()(session, null)).not.toBe(false)
  })

  it('refuse un compte introuvable', async () => {
    vi.mocked(getUserByIdDao).mockResolvedValue(undefined)

    expect(
      await sessionCreateBefore()(session, withHeaders('asso-a.test'))
    ).toBe(false)
  })

  it('porte un identifiant de plugin stable', () => {
    expect(associationSessionGuard().id).toBe(ASSOCIATION_SESSION_GUARD_ID)
  })
})
