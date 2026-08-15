import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {ApiKeyManagement} from '@/components/features/api-key/api-key-management'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

export default async function ApiKeysPage() {
  if (!isPageEnabled(PagesConst.APIKEY)) {
    return notFound()
  }

  const t = await getTranslations('ApiKeysPage')
  const user = await getAuthUser()

  if (!user) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('title')}
          </h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <div className="space-y-8">
        <div className="rounded-lg border p-4 sm:p-6">
          <ApiKeyManagement />
        </div>
      </div>
    </div>
  )
}
