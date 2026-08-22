import {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {Suspense} from 'react'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

import {AffiliatesContent} from './affiliates-content'

export const metadata: Metadata = {
  title: 'Affiliés',
  description: "Administration du programme d'affiliation",
}

type SearchParamsType = Promise<{page?: string; limit?: string}>

async function AffiliatesPage({
  searchParams,
}: {
  searchParams: SearchParamsType
}) {
  const params = await searchParams
  const t = await getTranslations('Affiliate.admin')
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '20'}`

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Suspense key={suspenseKey} fallback={<div className="h-40" />}>
        <AffiliatesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(AffiliatesPage)
