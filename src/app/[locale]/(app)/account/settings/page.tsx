import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {EditUserSettingsForm} from '@/components/features/user/edit-user-settings'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

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
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <EditUserSettingsForm user={user} />
    </div>
  )
}
