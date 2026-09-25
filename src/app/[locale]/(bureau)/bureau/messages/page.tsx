import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentContactMessagesDal,
  getContactMessagesForBureauDal,
} from '@/app/dal/contact-message-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  ContactMessageList,
  ContactMessageListSkeleton,
} from '@/components/features/contact/contact-message-list'

type MessagesPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{page?: string}>
}

export async function generateMetadata({
  params,
}: MessagesPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauContactMessagesPage',
  })

  return {title: t('metadata.title')}
}

/**
 * Messages recus depuis la page Contact (ecran 2 du design s08). Le controle
 * d'acces est repete ici : une navigation cliente ne rejoue pas le layout. La
 * liste n'est lue qu'apres ce controle.
 */
export default async function BureauContactMessagesPage({
  params,
  searchParams,
}: MessagesPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {page} = await searchParams
  const requested = Number.parseInt(page ?? '1', 10)
  const current = Number.isNaN(requested) || requested < 1 ? 1 : requested

  return (
    <Suspense key={current} fallback={<ContactMessageListSkeleton />}>
      <MessagesListSection page={current} />
    </Suspense>
  )
}

async function MessagesListSection({page}: {page: number}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentContactMessagesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const list = await getContactMessagesForBureauDal(tenant.id, page)

  return <ContactMessageList list={list} />
}
