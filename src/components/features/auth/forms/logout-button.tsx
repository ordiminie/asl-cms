'use client'

import {LogOut} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import {logoutAction} from '@/app/[locale]/(auth)/action'
import {Button} from '@/components/ui/button'

type LogoutButtonProps = {
  variant?: 'default' | 'outline'
  /** Icone `LogOut` devant le libelle, jamais a sa place (design system §3.12). */
  withIcon?: boolean
  className?: string
}

export default function LogoutButton({
  variant = 'default',
  withIcon = false,
  className,
}: LogoutButtonProps = {}) {
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
    <Button
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={pending}
    >
      {withIcon && <LogOut className="size-5" aria-hidden="true" />}
      {pending ? t('loggingOut') : t('logoutButton')}
    </Button>
  )
}
