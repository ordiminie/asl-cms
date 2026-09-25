import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentContactMessagesDal,
  getContactMessageForBureauDal,
} from '@/app/dal/contact-message-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {ContactMessageDetail} from '@/components/features/contact/contact-message-detail'
import {MarkReadOnOpen} from '@/components/features/contact/mark-read-on-open'
import {Skeleton} from '@/components/ui/skeleton'

import {
  markContactMessageReadAction,
  markContactMessageUnreadAction,
} from '../actions'

type MessagePageProps = {params: Promise<{locale: string; id: string}>}

export async function generateMetadata({
  params,
}: MessagePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauContactMessagesPage.detail',
  })

  return {title: t('metadataTitle')}
}

/**
 * Detail d'un message recu (ecran 3 du design s08). La lecture n'est pas
 * cachee, et la page **ne mute pas pendant son rendu** : le marquage « lu »
 * part du navigateur, au montage (decision E).
 */
export default async function BureauContactMessagePage({
  params,
}: MessagePageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<MessageSkeleton />}>
      <MessageSection messageId={id} />
    </Suspense>
  )
}

async function MessageSection({messageId}: {messageId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentContactMessagesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const message = await getContactMessageForBureauDal(tenant.id, messageId)
  if (!message) {
    notFound()
  }

  return (
    <MarkReadOnOpen
      messageId={message.id}
      markReadAction={markContactMessageReadAction}
    >
      <ContactMessageDetail
        message={message}
        markUnreadAction={markContactMessageUnreadAction}
      />
    </MarkReadOnOpen>
  )
}

function MessageSkeleton() {
  return (
    <div className="flex w-full max-w-[68ch] flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
