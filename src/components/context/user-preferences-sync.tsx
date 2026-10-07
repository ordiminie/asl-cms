'use client'

import {useTheme} from 'next-themes'
import {useEffect} from 'react'

import {useAuth} from './auth-provider'

/**
 * Applique le thème enregistré dans les préférences utilisateur.
 *
 * La langue enregistrée n'est plus lue : le produit ne sert que le français
 * (ADR 008, s43). Un compte dont la langue vaut `en` ne doit plus déclencher
 * de bascule vers une locale que le routage ne sert pas.
 *
 * Vit dans son propre composant, et non dans AuthProvider : lire la session
 * suspend, et un provider qui suspend emporte {children} avec lui. À monter
 * derrière un <Suspense>, il ne rend rien.
 */
export function UserPreferencesSync() {
  const {user} = useAuth()
  const {theme, setTheme} = useTheme()

  useEffect(() => {
    const userTheme = user?.settings?.theme
    if (userTheme && theme !== userTheme) {
      setTheme(userTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return null
}
