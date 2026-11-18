import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  RecipientGroupDetail,
  RecipientGroupDetailSkeleton,
} from '@/components/features/recipient-groups/recipient-group-detail'

import {
  deleteRecipientGroupAction,
  renameRecipientGroupAction,
} from '../actions'

type RecipientGroupPageProps = {
  params: Promise<{locale: string; id: string}>
}

export async function generateMetadata({
  params,
}: RecipientGroupPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'RecipientGroupsBureau'})

  return {title: t('metadata.title')}
}

/**
 * Un groupe de destinataires (ecran 3 de s27). Le controle d'acces est
 * repete ici ; un groupe inconnu, malforme ou d'une autre association rend
 * une 404 (la RLS ne le rend pas).
 */
export default async function RecipientGroupPage({
  params,
}: RecipientGroupPageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense key={id} fallback={<RecipientGroupDetailSkeleton />}>
      <RecipientGroupSection id={id} />
    </Suspense>
  )
}

async function RecipientGroupSection({id}: {id: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentRecipientGroupsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const group = await getRecipientGroupForBureauDal(tenant.id, id)
  if (!group) notFound()

  return (
    <RecipientGroupDetail
      group={group}
      renameAction={renameRecipientGroupAction}
      deleteAction={deleteRecipientGroupAction}
    />
  )
}
