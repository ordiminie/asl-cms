import {Children, isValidElement, ReactElement, ReactNode} from 'react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('next/font/google', () => {
  const font = () => ({variable: 'font'})
  return {JetBrains_Mono: font, Public_Sans: font, Source_Serif_4: font}
})
vi.mock('next-intl/server', () => ({setRequestLocale: vi.fn()}))
vi.mock('next-intl', () => ({NextIntlClientProvider: () => null}))
vi.mock('nextjs-toploader', () => ({default: () => null}))
vi.mock('@/components/ui/alert-banner', () => ({AlertBanner: () => null}))
vi.mock('@next/third-parties/google', () => ({GoogleAnalytics: () => null}))
vi.mock('@/components/context/app-providers', () => ({
  AppProviders: () => null,
}))
vi.mock('@/env', () => ({env: {}}))

import NextTopLoader from 'nextjs-toploader'

import {AlertBanner} from '@/components/ui/alert-banner'

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

const bodyChildrenOf = async (alert?: {message: string}) => {
  const element = (await BaseLayout({
    children: null,
    locale: 'fr',
    alert,
  })) as ReactElement<{children: ReactNode}>
  const body = Children.toArray(element.props.children).find(
    (child) => isValidElement(child) && child.type === 'body'
  ) as ReactElement<{children: ReactNode}>
  return Children.toArray(body.props.children).filter(isValidElement)
}

describe('BaseLayout — bandeau d alerte en tete de <body>', () => {
  it('rend le bandeau en premier enfant, avant la barre de progression', async () => {
    const children = await bodyChildrenOf({message: 'Coupure d’eau'})

    expect(children[0].type).toBe(AlertBanner)
    expect(children[0].props).toEqual({message: 'Coupure d’eau'})
    expect(children[1].type).toBe(NextTopLoader)
  })

  it('ne rend aucun bandeau sans prop', async () => {
    const children = await bodyChildrenOf()

    expect(children.some((child) => child.type === AlertBanner)).toBe(false)
    expect(children[0].type).toBe(NextTopLoader)
  })
})
