import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationIdentityCard} from '@/components/features/association/association-identity-card'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'

import {replaceAssociationIdentityFileAction} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauIdentityPage'})

  return {title: t('metadata.title')}
}

/**
 * Page « Identite de l'association » (s01b, ecran A). Le controle d'acces est
 * repete ici : une navigation cliente ne rejoue pas le layout.
 */
export default async function BureauIdentityPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const [tenant, allowed, t] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentAssociationIdentityDal(),
    getTranslations('BureauIdentityPage'),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  return (
    <div className="flex w-full max-w-190 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList className="text-[15px]">
            <BreadcrumbItem>{t('breadcrumb.association')}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('breadcrumb.identity')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-[68ch] text-[17px]">
          {t('intro')}
        </p>
      </div>

      <AssociationIdentityCard
        kind="logo"
        associationName={tenant.name}
        version={getIdentityVersionFromKey(tenant.logoKey)}
        uploadAction={replaceAssociationIdentityFileAction}
      />
      <AssociationIdentityCard
        kind="favicon"
        associationName={tenant.name}
        version={getIdentityVersionFromKey(tenant.faviconKey)}
        uploadAction={replaceAssociationIdentityFileAction}
      />
    </div>
  )
}
