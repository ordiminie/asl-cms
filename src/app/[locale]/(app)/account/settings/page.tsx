import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {EditUserSettingsForm} from '@/components/features/user/edit-user-settings'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
