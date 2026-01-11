import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {EditUserSettingsForm} from '@/components/features/user/edit-user-settings'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

export default async function Page() {
  if (!isPageEnabled(PagesConst.SETTINGS)) {
    return notFound()
  }

  const t = await getTranslations('AccountSettingsPage')
  const user = await getAuthUser()

  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h2>
      </div>

      <div className="space-y-8">
        <div className="rounded-lg border p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-medium">{t('settings.title')}</h3>
          <EditUserSettingsForm user={user} />
        </div>
      </div>
    </div>
  )
}
