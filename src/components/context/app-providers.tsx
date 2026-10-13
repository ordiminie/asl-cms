'use client'

import {PropsWithChildren} from 'react'

import {Toaster} from '@/components/ui/sonner'

import AuthProvider from './auth-provider'
import {QueryProvider} from './query-provider'
import {ThemeProvider} from './theme-provider'

// Clair seul (ADR 033) : le thème est forcé, aucune préférence du système ni
// du navigateur n'est suivie.
// AuthProvider sans promesse : sur les pages publiques, useAuth() renvoie
// simplement un utilisateur nul sans suspendre. Les sections authentifiées
// remontent leur propre AuthProvider avec la session.
export function AppProviders({children}: PropsWithChildren) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        storageKey="theme"
        disableTransitionOnChange
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  )
}
