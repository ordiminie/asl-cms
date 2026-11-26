import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))
vi.mock('@/services/facades/member-profile-access-service-facade', () => ({
  hasMemberSpaceAccessService: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: {error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn()},
}))

import {logger} from '@/lib/logger'
import {hasMemberSpaceAccessService} from '@/services/facades/member-profile-access-service-facade'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {
  canOpenSessionOn,
  isMemberOf,
  organizationOfRequest,
} from './association-membership'

const association = (id: string, domain: string | null): Organization => ({
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

const organizationA = association('org-a', 'asso-a.test')
const organizationB = association('org-b', 'asso-b.test')

const accountOf = (role: string, ...organizationIds: string[]) => ({
  id: 'user-1',
  role,
  organizations: organizationIds.map((organizationId) => ({
    organizationId,
    role: 'member',
  })),
})

const withOrganizationRole = (organizationRole: string) => ({
  id: 'user-1',
  role: 'user',
  organizations: [{organizationId: 'org-a', role: organizationRole}],
})

describe('canOpenSessionOn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasMemberSpaceAccessService).mockResolvedValue(true)
  })

  it('accepte un membre de A sur A dont une fiche reste ouverte', async () => {
    await expect(
      canOpenSessionOn(accountOf('user', 'org-a'), organizationA)
    ).resolves.toBe(true)
    expect(hasMemberSpaceAccessService).toHaveBeenCalledWith('org-a', 'user-1')
  })

  it('refuse un membre de A sur B, sans lire ses fiches', async () => {
    await expect(
      canOpenSessionOn(accountOf('user', 'org-a'), organizationB)
    ).resolves.toBe(false)
    expect(hasMemberSpaceAccessService).not.toHaveBeenCalled()
  })

  it('accepte le SuperAdmin sur A, sur B et sans association, sans lire de fiche', async () => {
    const superAdmin = accountOf('super_admin')

    await expect(canOpenSessionOn(superAdmin, organizationA)).resolves.toBe(
      true
    )
    await expect(canOpenSessionOn(superAdmin, organizationB)).resolves.toBe(
      true
    )
    await expect(canOpenSessionOn(superAdmin, undefined)).resolves.toBe(true)
    expect(hasMemberSpaceAccessService).not.toHaveBeenCalled()
  })

  it('refuse un compte sans aucune association', async () => {
    await expect(
      canOpenSessionOn({id: 'user-1', role: 'user'}, organizationA)
    ).resolves.toBe(false)
  })

  it('refuse tout compte autre que le SuperAdmin quand le domaine ne sert aucune association', async () => {
    await expect(
      canOpenSessionOn(accountOf('user', 'org-a'), undefined)
    ).resolves.toBe(false)
    await expect(
      canOpenSessionOn(accountOf('admin', 'org-a'), undefined)
    ).resolves.toBe(false)
  })

  it('ne fait pas du rôle global admin un SuperAdmin', async () => {
    await expect(
      canOpenSessionOn(accountOf('admin', 'org-a'), organizationB)
    ).resolves.toBe(false)
  })

  describe('accès après la vente (s57, ADR 075 §3)', () => {
    it('refuse un membre dont toutes les fiches sont fermées', async () => {
      vi.mocked(hasMemberSpaceAccessService).mockResolvedValue(false)

      await expect(
        canOpenSessionOn(accountOf('user', 'org-a'), organizationA)
      ).resolves.toBe(false)
    })

    it('le bureau et la présidence gardent la session, sans lire leurs fiches', async () => {
      vi.mocked(hasMemberSpaceAccessService).mockResolvedValue(false)

      await expect(
        canOpenSessionOn(withOrganizationRole('board'), organizationA)
      ).resolves.toBe(true)
      await expect(
        canOpenSessionOn(withOrganizationRole('owner'), organizationA)
      ).resolves.toBe(true)
      expect(hasMemberSpaceAccessService).not.toHaveBeenCalled()
    })

    it('une session ouverte à la place d’un compte s’ouvre toujours, sans lire ses fiches', async () => {
      vi.mocked(hasMemberSpaceAccessService).mockResolvedValue(false)

      await expect(
        canOpenSessionOn(accountOf('user', 'org-a'), organizationA, {
          impersonated: true,
        })
      ).resolves.toBe(true)
      expect(hasMemberSpaceAccessService).not.toHaveBeenCalled()
    })

    it('une imitation ne fait pas entrer un compte hors de l’association', async () => {
      await expect(
        canOpenSessionOn(accountOf('user', 'org-a'), organizationB, {
          impersonated: true,
        })
      ).resolves.toBe(false)
    })

    it('une erreur de lecture refuse (fermé par défaut), journalisée sans adresse', async () => {
      vi.mocked(hasMemberSpaceAccessService).mockRejectedValue(
        new Error('connexion perdue')
      )

      await expect(
        canOpenSessionOn(
          {
            ...accountOf('user', 'org-a'),
            email: 'lucie@example.test',
          } as Parameters<typeof canOpenSessionOn>[0],
          organizationA
        )
      ).resolves.toBe(false)
      expect(logger.error).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
        'lucie@example.test'
      )
    })
  })
})

describe('isMemberOf', () => {
  it('ne regarde que l’appartenance, pas le rôle global', () => {
    expect(isMemberOf(accountOf('super_admin'), organizationA)).toBe(false)
    expect(isMemberOf(accountOf('user', 'org-a'), organizationA)).toBe(true)
  })
})

describe('organizationOfRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('résout l’association du domaine appelé, normalisé', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(organizationA)

    await expect(organizationOfRequest('ASSO-A.test:3000')).resolves.toBe(
      organizationA
    )
    expect(getOrganizationByDomainService).toHaveBeenCalledWith('asso-a.test')
  })

  it('ne rend rien sans hôte, sans association, ou pour une association sans domaine', async () => {
    await expect(organizationOfRequest(undefined)).resolves.toBeUndefined()
    expect(getOrganizationByDomainService).not.toHaveBeenCalled()

    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)
    await expect(organizationOfRequest('inconnu.test')).resolves.toBeUndefined()

    vi.mocked(getOrganizationByDomainService).mockResolvedValue(
      association('org-c', null)
    )
    await expect(organizationOfRequest('asso-c.test')).resolves.toBeUndefined()
  })
})
