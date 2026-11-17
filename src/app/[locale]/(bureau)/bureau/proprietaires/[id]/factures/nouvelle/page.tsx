import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentMemberInvoicesDal,
  getMemberInvoicesForBureauDal,
} from '@/app/dal/member-invoice-dal'
import {
  getMemberParcelsForBureauDal,
  getMemberProfileForBureauDal,
} from '@/app/dal/member-profile-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {MemberInvoiceForm} from '@/components/features/member-invoice/member-invoice-form'
import {
  invoiceFormSettingsOf,
  invoiceParcelOptionsOf,
} from '@/components/features/member-invoice/member-invoice-form-context'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {createMemberInvoiceAction} from '../../actions'

type NewMemberInvoicePageProps = {
  params: Promise<{locale: string; id: string}>
}

export async function generateMetadata({
  params,
}: NewMemberInvoicePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauMemberInvoices'})

  return {title: t('metadata.newTitle')}
}

/**
 * Ajouter une facture a une fiche (s19, ecran 3). La lecture n'est pas
 * cachee ; le controle d'acces est repete ici. Introuvable pour une fiche
 * d'une autre association, ou quand le fournisseur de l'association ne permet
 * pas la saisie.
 */
export default async function NewMemberInvoicePage({
  params,
}: NewMemberInvoicePageProps) {
  const {locale, id} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<InvoiceFormSkeleton />}>
      <NewInvoiceSection memberProfileId={id} />
    </Suspense>
  )
}

async function NewInvoiceSection({memberProfileId}: {memberProfileId: string}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberInvoicesDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const profile = await getMemberProfileForBureauDal(tenant.id, memberProfileId)
  if (!profile) {
    notFound()
  }
  const invoices = await getMemberInvoicesForBureauDal(
    tenant.id,
    memberProfileId
  )
  if (!invoices?.canWrite) {
    notFound()
  }

  const [parcels, settings] = await Promise.all([
    getMemberParcelsForBureauDal(tenant.id, memberProfileId),
    getAssociationSettingsDal(tenant.id),
  ])
  // Lue apres la session, donc au rendu de la requete : l'emission proposee
  // est le jour calendaire de Paris.
  const today = calendarDayOf(new Date())

  return (
    <MemberInvoiceForm
      memberProfile={{id: profile.id, name: profile.name}}
      parcels={invoiceParcelOptionsOf(parcels)}
      {...invoiceFormSettingsOf(settings)}
      today={today}
      action={createMemberInvoiceAction}
    />
  )
}

function InvoiceFormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
