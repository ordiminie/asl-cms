import {readFileSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {render, screen} from '@/__tests__/customRender'

import {AlertBanner} from './alert-banner'

const MESSAGE = 'Coupure d’eau rue des Pins, jeudi de 8 h à 12 h.'

describe('AlertBanner', () => {
  it('est une region etiquetee, jamais une alerte annoncee', () => {
    render(<AlertBanner message={MESSAGE} />)

    const banner = screen.getByRole('region', {
      name: "Alerte de l'association",
    })
    expect(banner.tagName).toBe('SECTION')
    expect(banner).not.toHaveAttribute('aria-live')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(banner.querySelector('[aria-live]')).toBeNull()
  })

  it('ecrit le mot « Alerte » puis le message', () => {
    render(<AlertBanner message={MESSAGE} />)

    const banner = screen.getByRole('region')
    expect(banner.textContent).toBe(`Alerte\u00a0: ${MESSAGE}`)
    expect(
      screen.getByText((_, node) => node?.textContent === 'Alerte\u00a0:')
    ).toHaveClass('font-semibold')
  })

  it('rend le message comme du texte, balises comprises', () => {
    const hostile = '<script>alert(1)</script><b>gras</b>'

    render(<AlertBanner message={hostile} />)

    const banner = screen.getByRole('region')
    expect(banner.textContent).toContain(hostile)
    expect(banner.querySelector('script')).toBeNull()
    expect(banner.querySelector('b')).toBeNull()
  })

  it('garde le message entier, retours a la ligne compris', () => {
    const message = `${'a'.repeat(140)}\n${'b'.repeat(140)}`

    render(<AlertBanner message={message} />)

    const text = screen.getByText((_, node) => node?.textContent === message)
    expect(text.className).not.toMatch(/truncate|line-clamp/)
  })

  it('porte les tokens warning, un filet bas de 2 px, sans rayon ni ombre', () => {
    render(<AlertBanner message={MESSAGE} />)

    const banner = screen.getByRole('region')
    expect(banner).toHaveClass(
      'bg-warning',
      'text-warning-foreground',
      'border-b-2',
      'border-warning-border',
      'w-full'
    )
    expect(banner.className).not.toMatch(/rounded|shadow/)
  })

  it('disparait a l impression', () => {
    render(<AlertBanner message={MESSAGE} />)

    expect(screen.getByRole('region')).toHaveClass('print:hidden')
  })

  it('n a aucun element interactif', () => {
    render(<AlertBanner message={MESSAGE} />)

    const banner = screen.getByRole('region')
    expect(banner.querySelector('a, button, input, [tabindex]')).toBeNull()
  })

  it('porte l icone AlertTriangle, decorative', () => {
    render(<AlertBanner message={MESSAGE} />)

    const icon = screen.getByRole('region').querySelector('svg')
    expect(icon).toHaveClass('lucide-triangle-alert')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('token --warning-border (design system §1.9)', () => {
  const css = readFileSync(
    path.resolve(import.meta.dirname, '../../app/globals.css'),
    'utf8'
  )
  const values = [...css.matchAll(/--warning-border:\s*([^;]+);/g)].map(
    (match) => match[1].trim()
  )

  it('le filet clair est corrige, le sombre reste inchange', () => {
    expect(values).toEqual(['oklch(0.6 0.13 65)', 'oklch(0.6 0.11 70)'])
  })
})
