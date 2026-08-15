import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {ApiKeyManagement} from '@/components/features/api-key/api-key-management'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

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
