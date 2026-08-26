import Link from 'next/link'
import {getTranslations} from 'next-intl/server'

import {Button} from '@/components/ui/button'
import {getAuthUser} from '@/services/authentication/auth-service'

export default async function ButtonConnexionDashboard() {
  const t = await getTranslations('AppSidebar.nav')
  const user = await getAuthUser()
  if (user) {
    return (
      <Button asChild>
        <Link href="/dashboard">{t('dashboard')}</Link>
      </Button>
    )
  }
  return (
    <Button asChild>
      <Link href="/login">{t('login')}</Link>
    </Button>
  )
}
