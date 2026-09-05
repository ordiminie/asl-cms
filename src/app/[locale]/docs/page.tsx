import {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'

import {PagesConst} from '@/env'
import {isPageEnabled} from '@/lib/utils'

interface DocsPageProps {
  params: Promise<{
    locale: string
  }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Documentation ShipSaaS',
    description:
      'Découvrez toutes les règles et conventions de développement du projet Ship-SaaS.now',
  }
}

export default async function Page({params}: DocsPageProps) {
  const {locale} = await params
  // Seul le flag de page fait foi : une condition sur NODE_ENV renverrait 404
  // sur /docs en production alors que /docs/<slug> y répond normalement.
  if (!isPageEnabled(PagesConst.DOCS)) {
    return notFound()
  }
  redirect(`/${locale}/docs/introduction`)
}
