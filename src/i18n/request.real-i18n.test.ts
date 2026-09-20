import {cookies} from 'next/headers'
import * as rootParams from 'next/root-params'
import {getTranslations} from 'next-intl/server'
import {beforeEach, describe, expect, it, vi} from 'vitest'

const subjectOf = async (
  argument:
    string | {locale: string; namespace: string} = 'email.user.magicLink'
) => {
  const t = await getTranslations(argument as never)
  return (t as (key: string, values: Record<string, unknown>) => string)(
    'subject',
    {name: 'ASL', minutes: 20}
  )
}

const withLocaleCookie = (value: string) =>
  vi
    .mocked(cookies)
    .mockResolvedValue(new Map([['NEXT_LOCALE', {value}]]) as never)

describe('src/i18n/request.ts par le vrai getTranslations de next-intl', () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue(new Map() as never)
  })

  it('traduit dans la locale explicite, depuis une Server Action sans cookie', async () => {
    expect(
      await subjectOf({locale: 'fr', namespace: 'email.user.magicLink'})
    ).toBe('ASL — votre lien de connexion')
    expect(
      await subjectOf({locale: 'es', namespace: 'email.user.magicLink'})
    ).toBe('ASL — su enlace de conexión')
  })

  it('préfère la locale explicite au cookie NEXT_LOCALE', async () => {
    withLocaleCookie('en')

    expect(
      await subjectOf({locale: 'fr', namespace: 'email.user.magicLink'})
    ).toBe('ASL — votre lien de connexion')
  })

  it('sans locale explicite, garde la chaîne actuelle : cookie, sinon locale par défaut', async () => {
    expect(await subjectOf()).toBe('ASL — your sign-in link')

    withLocaleCookie('fr')
    expect(await subjectOf()).toBe('ASL — votre lien de connexion')
  })

  it('ignore une locale explicite non servie et retombe sur la chaîne actuelle', async () => {
    expect(
      await subjectOf({locale: 'de', namespace: 'email.user.magicLink'})
    ).toBe('ASL — your sign-in link')
  })

  it('sans locale explicite, lit root-params en premier dans une route', async () => {
    withLocaleCookie('en')
    vi.mocked(rootParams.locale).mockResolvedValueOnce('es')

    expect(await subjectOf()).toBe('ASL — su enlace de conexión')
  })
})
