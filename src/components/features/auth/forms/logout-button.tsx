'use client'

import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {logoutAction} from '@/app/[locale]/(auth)/action'
import {Button} from '@/components/ui/button'

export default function LogoutButton() {
  const t = useTranslations('Auth.LogoutForm')
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    setPending(true)

    await logoutAction()

    // Rechargement complet volontaire : sous Cache Components, <Activity> conserve
    // l'état client entre les navigations, y compris à travers un changement
    // d'authentification. router.push laisserait des données du compte précédent.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign('/login/')
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? t('loggingOut') : t('logoutButton')}
    </Button>
  )
}
