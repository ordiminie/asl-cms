import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

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
  role,
  organizations: organizationIds.map((organizationId) => ({organizationId})),
})

describe('canOpenSessionOn', () => {
  it('accepte un membre de A sur A', () => {
    expect(canOpenSessionOn(accountOf('user', 'org-a'), organizationA)).toBe(
      true
    )
  })

  it('refuse un membre de A sur B', () => {
    expect(canOpenSessionOn(accountOf('user', 'org-a'), organizationB)).toBe(
      false
    )
  })

  it('accepte le SuperAdmin sur A, sur B et sans association', () => {
    const superAdmin = accountOf('super_admin')

    expect(canOpenSessionOn(superAdmin, organizationA)).toBe(true)
    expect(canOpenSessionOn(superAdmin, organizationB)).toBe(true)
    expect(canOpenSessionOn(superAdmin, undefined)).toBe(true)
  })

  it('refuse un compte sans aucune association', () => {
    expect(canOpenSessionOn({role: 'user'}, organizationA)).toBe(false)
  })

  it('refuse tout compte autre que le SuperAdmin quand le domaine ne sert aucune association', () => {
    expect(canOpenSessionOn(accountOf('user', 'org-a'), undefined)).toBe(false)
    expect(canOpenSessionOn(accountOf('admin', 'org-a'), undefined)).toBe(false)
  })

  it('ne fait pas du rôle global admin un SuperAdmin', () => {
    expect(canOpenSessionOn(accountOf('admin', 'org-a'), organizationB)).toBe(
      false
    )
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
