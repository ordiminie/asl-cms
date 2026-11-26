import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Suspense} from 'react'

import {canImportCurrentMemberContactsDal} from '@/app/dal/member-annual-import-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {AnnualImportScreen} from '@/components/features/member-profile/annual-import/annual-import-screen'
import {MEMBER_PROFILES_PATH} from '@/components/features/member-profile/member-profile-paths'

import {importAnnualMemberContactsAction} from './actions'
import AnnualImportLoading from './loading'

type AnnualImportPageProps = {
  params: Promise<{locale: string}>
}

export async function generateMetadata({
  params,
}: AnnualImportPageProps): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({
    locale,
    namespace: 'BureauMemberAnnualImport',
  })

  return {title: t('metadata.title')}
}

/**
 * Mise a jour annuelle des coordonnees (s56, ecrans 1 et 2), presidence
 * seule. L'association est celle du domaine appele (ADR 003). Le controle
 * d'acces est repete ici : le layout laisse passer le Bureau, et une
 * navigation cliente ne rejoue pas le layout. La garde vit aussi dans
 * l'action et le service.
 */
export default async function BureauMemberAnnualImportPage({
  params,
}: AnnualImportPageProps) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<AnnualImportLoading />}>
      <AnnualImportSection />
    </Suspense>
  )
}

async function AnnualImportSection() {
  const [tenant, allowed] = await Promise.all([
    requireCurrentTenantDal(),
    canImportCurrentMemberContactsDal(),
  ])

  if (!allowed) {
    return (
      <BureauAccessDenied
        namespace="BureauMemberAnnualImport.denied"
        backHref={MEMBER_PROFILES_PATH}
      />
    )
  }

  return (
    <AnnualImportScreen
      associationName={tenant.name}
      importAction={importAnnualMemberContactsAction}
    />
  )
}
