import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {getActiveReportCategoriesDal} from '@/app/dal/association-category-dal'
import {getMyReportIdentityDal} from '@/app/dal/member-space-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import withAuth from '@/components/features/auth/with-auth'
import {MyReportForm} from '@/components/features/member-space/my-report-form'
import {Alert, AlertDescription} from '@/components/ui/alert'

import {submitMyReportAction} from './actions'

/**
 * « Signaler une fuite ou un incident » depuis l'espace membre (s22, ecran
 * B). Les categories sont celles de l'association du domaine appele ;
 * l'identite transmise au bureau est celle de la fiche du compte connecte,
 * lue sans cache. Un compte sans fiche dans l'association n'a pas cette page.
 */
async function Page() {
  const t = await getTranslations('MemberReportPage')
  const tReport = await getTranslations('ReportPage')

  const tenant = await requireCurrentTenantDal()
  const [categories, identity] = await Promise.all([
    getActiveReportCategoriesDal(tenant.id),
    getMyReportIdentityDal(),
  ])
  if (!identity) notFound()

  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-6">
      <Link
        href="/dashboard"
        className="text-primary focus-visible:outline-ring inline-flex h-12 items-center gap-2 self-start font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
        {t('back')}
      </Link>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      <Alert role="note">
        <AlertDescription className="text-foreground text-base">
          {tReport('emergency')}
        </AlertDescription>
      </Alert>
      <MyReportForm
        categories={categories}
        identity={identity}
        action={submitMyReportAction}
      />
    </div>
  )
}

export default withAuth(Page)
