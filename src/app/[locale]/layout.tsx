import '../globals.css'

import {notFound} from 'next/navigation'
import {Metadata} from 'next/types'
import {hasLocale} from 'next-intl'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import React from 'react'

import {getAssociationSettingsDal} from '@/app/dal/association-settings-dal'
import {getPublicSiteAlertDal} from '@/app/dal/site-alert-dal'
import {
  getCurrentTenantDal,
  requireCurrentTenantDal,
} from '@/app/dal/tenant-dal'
import {routing} from '@/i18n/routing'
import {getIdentityVersionFromKey} from '@/services/types/domain/association-identity-types'
import {getAccentHue} from '@/services/types/domain/association-settings-types'

import BaseLayout from './base-layout'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{locale: string}>
}) {
  const paramsStore = await params
  const locale = paramsStore.locale

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  // Configurer la locale AVANT toute utilisation de next-intl
  setRequestLocale(locale)

  // Le tenant vient du domaine appele (ADR 003). Un domaine qu'aucune
  // association ne sert ne rend rien du tout : ni contenu, ni coquille.
  // « Introuvable » et non « 404 » — le statut reste 200 sous Cache
  // Components, mesure consignee dans l'ADR 013.
  //
  // Consequence assumee, heritee de l'ADR 003 : lire le Host ici rend toute
  // page dependante de la requete, et **tout domaine servant l'application
  // doit etre provisionne**, back-office du prestataire compris.
  const tenant = await requireCurrentTenantDal()

  // La teinte d'accent de l'association (s02) et son bandeau d'alerte (s07),
  // lus en cache par association. Le bandeau vit ici parce que c'est le seul
  // point commun a toutes les pages, publiques comme authentifiees.
  const [settings, siteAlert] = await Promise.all([
    getAssociationSettingsDal(tenant.id),
    getPublicSiteAlertDal(tenant.id),
  ])
  const accentHue = getAccentHue(settings)

  return (
    <BaseLayout
      locale={locale}
      accentHue={accentHue}
      alert={siteAlert ?? undefined}
    >
      {children}
    </BaseLayout>
  )
}

// Déplacer generateMetadata après le composant principal
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const paramsStore = await params
  const locale = paramsStore.locale

  // Configurer la locale avant getTranslations
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'LocaleLayout'})
  const tenant = await getCurrentTenantDal()

  return {
    title: t('title'),
    description: t('description'),
    icons: {icon: associationFaviconUrl(tenant?.faviconKey)},
  }
}

/**
 * Le favicon de l'association du domaine appele (ADR 015) : toujours la route
 * de l'application, versionnee quand un favicon a ete televerse. Sans favicon,
 * la route sert le monogramme de l'association.
 */
const associationFaviconUrl = (faviconKey: string | null | undefined) => {
  const version = getIdentityVersionFromKey(faviconKey)
  return version
    ? `/api/identity/favicon?v=${encodeURIComponent(version)}`
    : '/api/identity/favicon'
}

/**
 * Route bloquante assumee, et pour tout le segment : le tenant vient de
 * l'en-tete `Host` (ADR 003), donc **toute** page depend de la requete. L'ADR
 * 003 assume explicitement cette tension — « aucune page n'est prerendue par
 * tenant au build » — parce que ce qui coute cher (le contenu) reste cache
 * dans des fonctions du DAL indexees sur l'organisation, et que ce qui depend
 * de la requete (la resolution du domaine) est bon marche et cache par
 * `cacheTag('tenant')`.
 *
 * L'opt-out d'un layout couvre son segment : ne pas le repeter sur les pages
 * en dessous (`rule-react-cache-next-cache.md`).
 */
export const instant = false

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}
