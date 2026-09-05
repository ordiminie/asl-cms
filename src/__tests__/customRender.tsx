import {cleanup, render} from '@testing-library/react'
import {NextIntlClientProvider} from 'next-intl'
import {ReactElement} from 'react'
import {afterEach} from 'vitest'

import {ThemeProvider} from '@/components/context/theme-provider'

import messages from '../../messages/fr.json'
afterEach(() => {
  cleanup()
})

const customRender = (ui: ReactElement, options = {}) =>
  render(ui, {
    // wrap provider(s) here if needed
    wrapper: ({children}) => (
      <NextIntlClientProvider locale="fr" messages={messages}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </NextIntlClientProvider>
    ),
    ...options,
  })

export * from '@testing-library/react'
export {default as userEvent} from '@testing-library/user-event'

export {customRender as render}
