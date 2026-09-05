import Link from 'next/link'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import React from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {APP_NAME} from '@/lib/constants'
import {getAuthUser} from '@/services/authentication/auth-service'

import LogoutButton from './logout-button'

export default async function Logout() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const t = await getTranslations('Auth.LogoutForm')

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>
          {t('description', {appName: APP_NAME})}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <LogoutButton />
        </div>
        <div className="mt-4 text-center text-sm">
          {t('backToDashboard')}&nbsp;
          <Link href="/dashboard" className="underline">
            {t('dashboardLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
