import {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {
  canManageCurrentMemberInvoicesDal,
  getMemberInvoiceForBureauDal,
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
import {MemberInvoiceReadOnly} from '@/components/features/member-invoice/member-invoice-read-only'
import {Skeleton} from '@/components/ui/skeleton'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {updateMemberInvoiceAction} from '../../actions'

type MemberInvoicePageProps = {
  params: Promise<{locale: string; id: string; invoiceId: string}>
}

export async function generateMetadata({
  params,
}: MemberInvoicePageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauMemberInvoices'})

  return {title: t('metadata.editTitle')}
}

/**
 * Une facture d'une fiche (s19, ecran 3). Saisie sur le site et fournisseur
 * qui permet la saisie : le formulaire de correction. Sinon — Pennylane
 * compris — une lecture **sans formulaire** (3d) ; le service refuse de toute
 * facon une modification envoyee en direct (critere 9).
 */
export default async function MemberInvoicePage({
  params,
}: MemberInvoicePageProps) {
  const {locale, id, invoiceId} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<InvoiceSkeleton />}>
      <InvoiceSection memberProfileId={id} invoiceId={invoiceId} />
    </Suspense>
  )
}

async function InvoiceSection({
  memberProfileId,
  invoiceId,
}: {
  memberProfileId: string
  invoiceId: string
}) {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentMemberInvoicesDal(),
  ])
  if (!allowed) {
    return <BureauAccessDenied />
  }

  const [profile, invoice] = await Promise.all([
    getMemberProfileForBureauDal(tenant.id, memberProfileId),
    getMemberInvoiceForBureauDal(tenant.id, memberProfileId, invoiceId),
  ])
  if (!profile || !invoice) {
    notFound()
  }
  const memberProfile = {id: profile.id, name: profile.name}

  const invoices = await getMemberInvoicesForBureauDal(
    tenant.id,
    memberProfileId
  )
  if (invoice.source !== 'site' || !invoices?.canWrite) {
    return (
      <MemberInvoiceReadOnly memberProfile={memberProfile} invoice={invoice} />
    )
  }

  const [parcels, settings] = await Promise.all([
    getMemberParcelsForBureauDal(tenant.id, memberProfileId),
    getAssociationSettingsDal(tenant.id),
  ])
  const today = calendarDayOf(new Date())

  return (
    <MemberInvoiceForm
      memberProfile={memberProfile}
      parcels={invoiceParcelOptionsOf(parcels)}
      {...invoiceFormSettingsOf(settings)}
      today={today}
      invoice={invoice}
      action={updateMemberInvoiceAction}
    />
  )
}

function InvoiceSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-4 px-4 pt-6 pb-12 sm:px-8">
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
