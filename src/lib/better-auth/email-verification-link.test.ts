import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('next/headers', () => ({headers: vi.fn()}))
vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {headers} from 'next/headers'

import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {verificationLinkOnAssociation} from './email-verification-link'

const association = {id: 'org-a', domain: 'asso-a.test'} as Organization

/** Le lien tel que Better Auth le construit, sur `BETTER_AUTH_URL`. */
const platformLink =
  'http://localhost:3000/api/auth/verify-email?token=jeton-secret&callbackURL=%2Faccount'

const requestOn = (host: string) =>
  new Request('http://interne:3000/api/auth/verify-email', {headers: {host}})

describe('verificationLinkOnAssociation (revue M2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrganizationByDomainService).mockImplementation(
      async (domain: string) =>
        domain === association.domain ? association : undefined
    )
    vi.mocked(headers).mockRejectedValue(new Error('hors requête') as never)
  })

  it('reporte le lien sur l’origine de l’association de la requête', async () => {
    const link = new URL(
      await verificationLinkOnAssociation(
        platformLink,
        requestOn('asso-a.test')
      )
    )

    expect(link.origin).toBe('http://asso-a.test:3000')
    expect(link.pathname).toBe('/api/auth/verify-email')
    expect(link.searchParams.get('token')).toBe('jeton-secret')
    expect(link.searchParams.get('callbackURL')).toBe(
      'http://asso-a.test:3000/account'
    )
  })

  /**
   * Appel direct `auth.api.*` (Server Action) : Better Auth ne transmet pas de
   * `Request` au callback, seulement ses en-tetes au contexte. Ceux de la
   * requete Next en cours prennent le relais.
   */
  it('lit l’hôte de la requête Next quand Better Auth ne transmet pas de Request', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'asso-a.test'}) as never
    )

    const link = new URL(
      await verificationLinkOnAssociation(platformLink, undefined)
    )

    expect(link.origin).toBe('http://asso-a.test:3000')
  })

  it('préfère la Request transmise par Better Auth aux en-têtes de Next', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({host: 'autre.test'}) as never
    )

    const link = new URL(
      await verificationLinkOnAssociation(
        platformLink,
        requestOn('asso-a.test')
      )
    )

    expect(link.origin).toBe('http://asso-a.test:3000')
  })

  it('garde le lien de la plateforme sur un hôte sans association (SuperAdmin)', async () => {
    expect(
      await verificationLinkOnAssociation(
        platformLink,
        requestOn('localhost:3000')
      )
    ).toBe(platformLink)
  })

  it('garde le lien de la plateforme sans requête ni en-têtes lisibles', async () => {
    expect(await verificationLinkOnAssociation(platformLink, undefined)).toBe(
      platformLink
    )
    expect(getOrganizationByDomainService).not.toHaveBeenCalled()
  })
})
