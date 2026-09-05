'use client'

import {useParams} from 'next/navigation'
import {useTheme} from 'next-themes'
import {useEffect} from 'react'

import {usePathname, useRouter} from '@/i18n/navigation'
import {stripLocalePrefix} from '@/lib/helper/locale-helper'

import {useAuth} from './auth-provider'

/**
 * Applique le thème et la langue enregistrés dans les préférences utilisateur.
 *
 * Vit dans son propre composant, et non dans AuthProvider : lire la session
 * suspend, et un provider qui suspend emporte {children} avec lui. À monter
 * derrière un <Suspense>, il ne rend rien.
 */
export function UserPreferencesSync() {
  const {user} = useAuth()
  const {theme, setTheme} = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  // La locale de l'URL fait foi : useLocale() peut retourner la locale par
  // défaut sur les pages statiques, et c'est justement ce décalage qui laisse
  // le préfixe dans le pathname retourné par usePathname().
  const currentLocale = params.locale as string

  useEffect(() => {
    const userTheme = user?.settings?.theme
    if (userTheme && theme !== userTheme) {
      setTheme(userTheme)
    }

    const userLang = user?.settings?.language
    if (userLang && currentLocale !== userLang) {
      router.replace(stripLocalePrefix(pathname, currentLocale), {
        locale: userLang,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return null
}
