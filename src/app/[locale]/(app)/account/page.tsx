import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import withAuth from '@/components/features/auth/with-auth'
import {UserSecurityFactorSection} from '@/components/features/user/security-section'
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
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className="text-primary focus-visible:outline-ring inline-flex h-12 items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
        {t('backToMemberSpace')}
      </Link>
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <UserSecurityFactorSection user={user} />
    </div>
  )
}
export default withAuth(Page)
