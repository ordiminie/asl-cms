import {Metadata} from 'next'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {canManageCurrentAssociationIdentityDal} from '@/app/dal/association-identity-dal'
import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {AssociationSettingsForm} from '@/components/features/association/association-settings-form'
import {BureauAccessDenied} from '@/components/features/association/bureau-access-denied'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  ASSOCIATION_SETTINGS_REGISTRY,
  getSettingsForPage,
} from '@/services/types/domain/association-settings-types'

import {updateAssociationSettingsAction} from './actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'BureauSettingsPage'})

  return {title: t('metadata.title')}
}

/**
 * Page « Reglages de l'association » (s02, ecran B), generee par le registre
 * des parametres. Le controle d'acces est repete ici : une navigation cliente
 * ne rejoue pas le layout. Les adresses ne sont lues qu'apres ce controle.
 */
export default async function BureauSettingsPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  const [tenant, allowed, t] = await Promise.all([
    requireCurrentTenantDal(),
    canManageCurrentAssociationIdentityDal(),
    getTranslations('BureauSettingsPage'),
  ])

  if (!allowed) {
    return <BureauAccessDenied />
  }

  const settings = await getAssociationSettingsDal(tenant.id)

  return (
    <div className="flex w-full max-w-190 flex-col gap-8 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList className="text-[15px]">
            <BreadcrumbItem>{t('breadcrumb.association')}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('breadcrumb.settings')}</BreadcrumbPage>
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

      <AssociationSettingsForm
        definitions={getSettingsForPage(
          ASSOCIATION_SETTINGS_REGISTRY,
          'settings'
        )}
        settings={settings}
        saveAction={updateAssociationSettingsAction}
      />
    </div>
  )
}
