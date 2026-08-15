import Link from 'next/link'
import {Suspense} from 'react'

import {getCreditPacksDal} from '@/app/dal/credit-dal'
import {Skeleton} from '@/components/ui/skeleton'
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs'

import {CreditPageContent} from './credit-content'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

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
  const packs = await getCreditPacksDal()

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Crédits</h1>
        <p className="text-muted-foreground">
          Gérez vos crédits et achetez des packs supplémentaires
        </p>
      </div>

      <Tabs defaultValue="credits" className="mb-6 w-fit">
        <TabsList>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="usage" asChild>
            <Link href="/account/billing/usage">Usage</Link>
          </TabsTrigger>
          <TabsTrigger value="plans" asChild>
            <Link href="/account/billing/subscription">Plans</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Suspense fallback={<LoadingSkeleton />}>
        <CreditPageContent packs={packs} />
      </Suspense>
    </div>
  )
}
