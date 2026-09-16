import '../globals.css'

import {notFound} from 'next/navigation'
import {Metadata} from 'next/types'
import {hasLocale} from 'next-intl'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import React from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {routing} from '@/i18n/routing'

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
  await requireCurrentTenantDal()

  return <BaseLayout locale={locale}>{children}</BaseLayout>
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

  return {
    title: t('title'),
    description: t('description'),
  }
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
