import {redirect} from 'next/navigation'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import Logout from '@/components/features/auth/forms/logout-form'
import {CLOSED_ACCESS_PATH} from '@/components/features/auth/with-auth'
import {
  getAuthUser,
  getSessionAuth,
} from '@/services/authentication/auth-service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.LogoutPage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

async function Page({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params
  setRequestLocale(locale)

  const user = await getAuthUser()
  if (!user) {
    const session = await getSessionAuth()
    // Une session dont l'acces est ferme est terminee par sa route (s12d)
    redirect(session?.session?.userId ? CLOSED_ACCESS_PATH : '/login')
  }
  return (
    <div className="flex h-screen w-full items-center justify-center px-4">
      <Logout />
    </div>
  )
}

export default Page
