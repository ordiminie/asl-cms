import {isValidElement, ReactElement} from 'react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('next/font/google', () => {
  const font = () => ({variable: 'font'})
  return {JetBrains_Mono: font, Public_Sans: font, Source_Serif_4: font}
})
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}))
vi.mock('next-intl', () => ({NextIntlClientProvider: () => null}))
vi.mock('nextjs-toploader', () => ({default: () => null}))
vi.mock('@next/third-parties/google', () => ({GoogleAnalytics: () => null}))
vi.mock('@/components/context/app-providers', () => ({
  AppProviders: () => null,
}))
vi.mock('@/env', () => ({env: {}}))

import BaseLayout from './base-layout'

type HtmlProps = {style?: Record<string, unknown>; lang?: string}

const htmlOf = async (accentHue?: number) => {
  const element = (await BaseLayout({
    children: null,
    locale: 'fr',
    accentHue,
  })) as ReactElement<HtmlProps>
  expect(isValidElement(element)).toBe(true)
  expect(element.type).toBe('html')
  return element.props
}

describe('BaseLayout — teinte d accent posee sur <html>', () => {
  it('porte la teinte recue', async () => {
    expect((await htmlOf(40)).style).toEqual({'--accent-hue': 40})
  })

  it('sans teinte, la teinte par defaut 195', async () => {
    expect((await htmlOf()).style).toEqual({'--accent-hue': 195})
  })

  it('une teinte hors des six teintes validees retombe sur 195', async () => {
    expect((await htmlOf(12)).style).toEqual({'--accent-hue': 195})
  })
})
