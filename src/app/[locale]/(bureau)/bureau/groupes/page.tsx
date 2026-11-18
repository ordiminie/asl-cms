import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentRecipientGroupsDal,
  getRecipientGroupsForBureauDal,
} from '@/app/dal/recipient-group-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  RecipientGroupList,
  RecipientGroupListSkeleton,
} from '@/components/features/recipient-groups/recipient-group-list'
import {RECIPIENT_GROUP_DELETED_FLAG} from '@/components/features/recipient-groups/recipient-group-paths'

import {createRecipientGroupAction} from './actions'

type RecipientGroupsPageProps = {
  params: Promise<{locale: string}>
  searchParams: Promise<{supprime?: string}>
}

export async function generateMetadata({
  params,
}: RecipientGroupsPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'RecipientGroupsBureau'})

  return {title: t('metadata.title')}
}

/**
 * Les groupes de destinataires (ecran 3 de s27). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout. La liste n'est
 * lue qu'apres lui.
 */
export default async function RecipientGroupsPage({
  params,
  searchParams,
}: RecipientGroupsPageProps) {
  const {locale} = await params
  setRequestLocale(locale)
  const {supprime} = await searchParams

  return (
    <Suspense fallback={<RecipientGroupListSkeleton />}>
      <RecipientGroupsSection
        deleted={supprime === RECIPIENT_GROUP_DELETED_FLAG}
      />
    </Suspense>
  )
}

async function RecipientGroupsSection({deleted}: {deleted: boolean}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentRecipientGroupsDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const groups = await getRecipientGroupsForBureauDal(tenant.id)

  return (
    <RecipientGroupList
      groups={groups}
      deleted={deleted}
      createAction={createRecipientGroupAction}
    />
  )
}
