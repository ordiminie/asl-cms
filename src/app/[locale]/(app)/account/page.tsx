import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import withAuth from '@/components/features/auth/with-auth'
import {EditUserProfileForm} from '@/components/features/user/edit-user-profile'
import {UserSecurityFactorSection} from '@/components/features/user/security-section'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'
import {getAuthUser} from '@/services/authentication/auth-service'

async function Page() {
  if (!isPageEnabled(PagesConst.ACCOUNT)) {
    return notFound()
  }

  const t = await getTranslations('AccountPage')

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

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.title')}</CardTitle>
          <CardDescription>{t('profile.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <EditUserProfileForm user={user} />
        </CardContent>
      </Card>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('security.title')}</h2>
        <p className="text-muted-foreground text-sm">
          {t('security.description')}
        </p>
      </div>
      <UserSecurityFactorSection user={user} />
    </div>
  )
}
export default withAuth(Page)
