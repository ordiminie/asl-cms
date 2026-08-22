import {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {Suspense} from 'react'

import withAuth from '@/components/features/auth/with-auth'

import {AffiliateContent} from './affiliate-content'
import {AffiliateSkeleton} from './affiliate-skeleton'

export const metadata: Metadata = {
  title: 'Affiliation',
  description: "Programme d'affiliation",
}

async function Page() {
  const t = await getTranslations('Affiliate.page')

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Suspense fallback={<AffiliateSkeleton />}>
        <AffiliateContent />
      </Suspense>
    </div>
  )
}

export default withAuth(Page)
