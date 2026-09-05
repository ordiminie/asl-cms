import Link from 'next/link'
import {getTranslations} from 'next-intl/server'
import {Suspense} from 'react'

import {getCreditPacksDal} from '@/app/dal/credit-dal'
import {Skeleton} from '@/components/ui/skeleton'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'

import {CreditPageContent} from './credit-content'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
      </div>
      <Skeleton className="h-[350px]" />
      <Skeleton className="h-[300px]" />
    </div>
  )
}

export default async function CreditPage() {
  const t = await getTranslations('Credits')
  const packs = await getCreditPacksDal()

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('page.title')}</h1>
        <p className="text-muted-foreground">{t('page.description')}</p>
      </div>

      <Tabs defaultValue="credits" className="mb-6 w-fit">
        <TabsList>
          <TabsTrigger value="credits">{t('tabs.credits')}</TabsTrigger>
          <TabsTrigger value="usage" asChild>
            <Link href="/account/billing/usage">{t('tabs.usage')}</Link>
          </TabsTrigger>
          <TabsTrigger value="plans" asChild>
            <Link href="/account/billing/subscription">{t('tabs.plans')}</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Suspense fallback={<LoadingSkeleton />}>
        <CreditPageContent packs={packs} />
      </Suspense>
    </div>
  )
}
