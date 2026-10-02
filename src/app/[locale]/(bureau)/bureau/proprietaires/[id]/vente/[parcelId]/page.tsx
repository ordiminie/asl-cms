import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {
  canManageCurrentMemberProfilesDal,
  getMemberProfileForBureauDal,
  getSaleContextForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {validIsoDateOf} from '@/components/features/member-profile/member-profile-paths'
import {SaleForm} from '@/components/features/member-profile/sale-form'
import type {BuyerOption} from '@/components/features/member-profile/sale-form-validation'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {recordSaleAction, searchBuyersAction} from '../../../actions'

type SalePageProps = {
  params: Promise<{locale: string; id: string; parcelId: string}>
  searchParams: Promise<{acquereur?: string; date?: string}>
}

export async function generateMetadata({
  params,
}: SalePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberProfilesPage',
  })

  return {title: t('sale.metadataTitle')}
}

/**
 * Enregistrer la vente d'une parcelle (ecran 5 du design s12). La lecture
 * n'est pas cachee ; le controle d'acces est repete ici. Au retour de la
 * creation de l'acquereur, il est preselectionne et la date conservee.
 */
export default async function BureauSalePage({
  params,
  searchParams,
}: SalePageProps) {
  const {locale, id, parcelId} = await params
  setRequestLocale(locale)
  const {acquereur, date} = await searchParams

  return (
    <Suspense fallback={<SaleSkeleton />}>
      <SaleSection
        sellerId={id}
        parcelId={parcelId}
        buyerId={acquereur}
        date={validIsoDateOf(date)}
      />
    </Suspense>
  )
}

async function SaleSection({
  sellerId,
  parcelId,
  buyerId,
  date,
}: {
  sellerId: string
  parcelId: string
  buyerId?: string
  date?: string
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberProfilesDal(),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const context = await getSaleContextForBureauDal(
    tenant.id,
    sellerId,
    parcelId
  )
  if (!context) {
    notFound()
  }

  const buyer = buyerId
    ? await getMemberProfileForBureauDal(tenant.id, buyerId)
    : undefined
  const initialBuyer: BuyerOption | undefined = buyer && {
    id: buyer.id,
    name: buyer.name,
    currentParcelNumbers: [],
  }

  // Lue apres la session, donc au rendu de la requete : la date proposee est
  // le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <SaleForm
      context={context}
      today={today}
      initialDate={date}
      initialBuyer={initialBuyer}
      recordSaleAction={recordSaleAction}
      searchBuyersAction={searchBuyersAction}
    />
  )
}

function SaleSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
