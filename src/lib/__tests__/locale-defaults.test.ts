import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({cacheLife: vi.fn()}))
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://plateforme.test',
    NEXT_PUBLIC_AUTH_METHODS: [],
  },
}))

import {LANGUAGE_OPTIONS} from '@/components/features/admin/blog/post-form-validation'
import {languageEnum} from '@/db/models/user-model'
import {EMAIL_REGISTRY} from '@/lib/emails/email-registry'
import {buildBannedMessage} from '@/lib/helper/auth-helper'
import {getAvailableLocalesForPost} from '@/lib/helper/blog.server'
import {languageSchema} from '@/services/validation/user-validation'

/**
 * Locale unique (ADR 008, s43) : les valeurs par defaut heritees du socle
 * multilingue ne proposent plus que le francais.
 */
describe('valeurs par defaut de locale apres s43', () => {
  it('le message de suspension date en francais par defaut', () => {
    const message = buildBannedMessage({
      banExpires: new Date(Date.UTC(2099, 11, 31, 12)),
    })

    expect(message).toContain('31/12/2099')
  })

  it("le parametre de langue de l'ecran des emails ne propose que fr", () => {
    const languageParams = Object.values(EMAIL_REGISTRY).flatMap(({params}) =>
      params.filter(({key}) => key === 'language')
    )

    expect(languageParams.length).toBeGreaterThan(0)
    for (const param of languageParams) {
      expect(param.options).toEqual(['fr'])
      expect(param.default).toBe('fr')
    }
  })

  it('le blog herite ne lit que les articles servis par le routage', () => {
    expect(getAvailableLocalesForPost('001-bienvenue')).toEqual(['fr'])
  })

  it('la preference de langue enregistree reste valide, sans etre lue (decision C)', () => {
    for (const language of languageEnum.enumValues) {
      expect(languageSchema.safeParse(language).success, language).toBe(true)
    }
  })

  it("le schema de langue reprend exactement l'enum de base language_type", () => {
    expect(languageSchema.options).toEqual(languageEnum.enumValues)
  })

  it("l'editeur d'articles herite ne propose que le francais", () => {
    expect(LANGUAGE_OPTIONS.map(({value}) => value)).toEqual(['fr'])
  })
})
