import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/services/facades/organization-service-facade', () => ({
  getOrganizationByDomainService: vi.fn(),
}))

import {env} from '@/env'
import {getOrganizationByDomainService} from '@/services/facades/organization-service-facade'
import type {Organization} from '@/services/types/domain/organization-types'

import {
  associationOriginOf,
  rebaseMagicLinkUrl,
  trustedOriginsOf,
} from './association-origin'

describe('associationOriginOf', () => {
  it('remplace le nom d’hôte de la plateforme en gardant protocole et port', () => {
    expect(associationOriginOf('127.0.0.1', 'http://localhost:3000')).toBe(
      'http://127.0.0.1:3000'
    )
  })

  it('construit l’origine HTTPS d’une association en production', () => {
    expect(associationOriginOf('asso.fr', 'https://plateforme.fr')).toBe(
      'https://asso.fr'
    )
  })

  it('normalise un domaine en majuscules ou avec un point final', () => {
    expect(associationOriginOf('ASSO.FR.', 'https://plateforme.fr')).toBe(
      'https://asso.fr'
    )
  })

  it('ignore le chemin de l’adresse de la plateforme', () => {
    expect(
      associationOriginOf('asso.fr', 'https://plateforme.fr/api/auth')
    ).toBe('https://asso.fr')
  })

  it('ne rend rien pour un domaine vide ou absent', () => {
    expect(associationOriginOf('', 'https://plateforme.fr')).toBeUndefined()
    expect(associationOriginOf('  ', 'https://plateforme.fr')).toBeUndefined()
    expect(associationOriginOf(null, 'https://plateforme.fr')).toBeUndefined()
  })

  it('prend BETTER_AUTH_URL par défaut', () => {
    expect(associationOriginOf('127.0.0.1')).toBe('http://127.0.0.1:3000')
  })
})

describe('rebaseMagicLinkUrl', () => {
  const origin = 'http://127.0.0.1:3000'
  const pluginUrl = (query: string) =>
    `http://localhost:3000/api/auth/magic-link/verify?token=jeton-secret${query}`
  const rebase = (query: string) =>
    new URL(rebaseMagicLinkUrl(pluginUrl(query), origin))

  it('remplace l’origine en gardant le chemin et le jeton', () => {
    const url = rebase('')

    expect(url.origin).toBe(origin)
    expect(url.pathname).toBe('/api/auth/magic-link/verify')
    expect(url.searchParams.get('token')).toBe('jeton-secret')
  })

  it('rend absolus sur l’association les callbackURL relatifs', () => {
    const url = rebase(
      '&callbackURL=%2Fdashboard' +
        '&errorCallbackURL=%2Flogin%2Flien-invalide' +
        '&newUserCallbackURL=%2Fbienvenue%3Fa%3D1'
    )

    expect(url.searchParams.get('callbackURL')).toBe(`${origin}/dashboard`)
    expect(url.searchParams.get('errorCallbackURL')).toBe(
      `${origin}/login/lien-invalide`
    )
    expect(url.searchParams.get('newUserCallbackURL')).toBe(
      `${origin}/bienvenue?a=1`
    )
  })

  it('ramène sur l’association un callbackURL absolu vers une autre origine', () => {
    const url = rebase(
      `&callbackURL=${encodeURIComponent(
        'https://ailleurs.example/vol?x=1#frag'
      )}`
    )

    expect(url.searchParams.get('callbackURL')).toBe(`${origin}/vol?x=1#frag`)
  })

  it('garde tel quel un callbackURL déjà sur l’association', () => {
    const url = rebase(
      `&callbackURL=${encodeURIComponent(`${origin}/dashboard`)}`
    )

    expect(url.searchParams.get('callbackURL')).toBe(`${origin}/dashboard`)
  })

  it('n’ajoute aucun paramètre absent et ne touche pas aux autres', () => {
    const url = rebase('&autre=%2Frelatif')

    expect(url.searchParams.has('callbackURL')).toBe(false)
    expect(url.searchParams.has('errorCallbackURL')).toBe(false)
    expect(url.searchParams.has('newUserCallbackURL')).toBe(false)
    expect(url.searchParams.get('autre')).toBe('/relatif')
  })
})

describe('trustedOriginsOf', () => {
  const association = {
    id: 'org-b',
    domain: '127.0.0.1',
  } as Organization
  const requestOn = (headers: Record<string, string>) =>
    new Request('http://interne:3000/api/auth/get-session', {headers})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ajoute l’origine de l’association servie par l’hôte de la requête', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(association)

    const origins = await trustedOriginsOf(requestOn({host: '127.0.0.1:3000'}))

    expect(getOrganizationByDomainService).toHaveBeenCalledWith('127.0.0.1')
    expect(origins).toEqual([
      ...env.BETTER_AUTH_TRUSTED_ORIGINS,
      'http://127.0.0.1:3000',
    ])
  })

  it('lit l’hôte derrière le proxy (x-forwarded-host)', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(association)

    await trustedOriginsOf(
      requestOn({host: 'interne:3000', 'x-forwarded-host': '127.0.0.1'})
    )

    expect(getOrganizationByDomainService).toHaveBeenCalledWith('127.0.0.1')
  })

  it('s’en tient à la liste d’environnement pour un hôte inconnu', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue(undefined)

    const origins = await trustedOriginsOf(requestOn({host: 'inconnu.test'}))

    expect(origins).toEqual(env.BETTER_AUTH_TRUSTED_ORIGINS)
  })

  it('s’en tient à la liste d’environnement sans requête', async () => {
    const origins = await trustedOriginsOf()

    expect(origins).toEqual(env.BETTER_AUTH_TRUSTED_ORIGINS)
    expect(getOrganizationByDomainService).not.toHaveBeenCalled()
  })

  it('ne produit jamais d’origine à joker', async () => {
    vi.mocked(getOrganizationByDomainService).mockResolvedValue({
      ...association,
      domain: '*',
    })

    const origins = await trustedOriginsOf(requestOn({host: '*'}))

    expect(origins.some((origin) => origin.includes('*'))).toBe(false)
  })
})
