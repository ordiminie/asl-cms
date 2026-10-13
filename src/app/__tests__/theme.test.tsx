import {render, screen, waitFor} from '@testing-library/react'
import {useTheme} from 'next-themes'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {AppProviders} from '@/components/context/app-providers'

vi.mock('@/components/ui/sonner', () => ({Toaster: () => null}))

/** Un navigateur réglé en sombre : ce que `enableSystem` suivrait. */
const preferDarkScheme = () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
}

const ThemeProbe = () => {
  const {forcedTheme, resolvedTheme} = useTheme()
  return (
    <p>
      forced:{forcedTheme ?? 'none'} resolved:{resolvedTheme ?? 'none'}
    </p>
  )
}

describe('Thème — clair seul (ADR 033)', () => {
  beforeEach(() => {
    preferDarkScheme()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.localStorage.removeItem('theme')
    document.documentElement.className = ''
  })

  it('force le thème clair, même pour un navigateur réglé en sombre', async () => {
    render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>
    )

    expect(await screen.findByText(/forced:light/)).toBeInTheDocument()
    await waitFor(() =>
      expect(document.documentElement).not.toHaveClass('dark')
    )
  })

  it('ignore un thème sombre enregistré dans le navigateur', async () => {
    window.localStorage.setItem('theme', 'dark')

    render(
      <AppProviders>
        <ThemeProbe />
      </AppProviders>
    )

    expect(await screen.findByText(/forced:light/)).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
