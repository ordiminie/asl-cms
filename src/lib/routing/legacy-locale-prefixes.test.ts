import {describe, expect, it} from 'vitest'

import {
  LEGACY_LOCALE_PREFIXES,
  legacyLocaleRedirects,
} from './legacy-locale-prefixes'

const matchesSource = (source: string, pathname: string) => {
  const pattern = source.replace(/:path\*/, '(.*)').replace(/\//g, '\\/')
  return new RegExp(`^${pattern}$`).test(pathname)
}

describe('LEGACY_LOCALE_PREFIXES', () => {
  it('liste les trois préfixes historiques', () => {
    expect([...LEGACY_LOCALE_PREFIXES].sort()).toEqual(['en', 'es', 'fr'])
  })
})

describe('legacyLocaleRedirects', () => {
  const rules = legacyLocaleRedirects()

  it.each(['fr', 'en', 'es'])(
    'redirige l’adresse exacte /%s vers la racine',
    (prefix) => {
      expect(rules).toContainEqual({
        source: `/${prefix}`,
        destination: '/',
        permanent: true,
      })
    }
  )

  it.each(['fr', 'en', 'es'])(
    'redirige les sous-chemins de /%s vers le même chemin sans préfixe',
    (prefix) => {
      expect(rules).toContainEqual({
        source: `/${prefix}/:path*`,
        destination: '/:path*',
        permanent: true,
      })
    }
  )

  it('ne produit que des redirections permanentes', () => {
    expect(rules).toHaveLength(6)
    for (const rule of rules) {
      expect(rule.permanent).toBe(true)
    }
  })

  it.each(['/english', '/french-page', '/esprit', '/actualites', '/'])(
    'ne capture pas le segment voisin %s',
    (pathname) => {
      expect(rules.some((rule) => matchesSource(rule.source, pathname))).toBe(
        false
      )
    }
  )

  it.each(['/en', '/en/actualites', '/fr/bureau/membres', '/es'])(
    'capture l’adresse préfixée %s',
    (pathname) => {
      expect(rules.some((rule) => matchesSource(rule.source, pathname))).toBe(
        true
      )
    }
  )
})
