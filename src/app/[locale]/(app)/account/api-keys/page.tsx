import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {ApiKeyManagement} from '@/components/features/api-key/api-key-management'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
