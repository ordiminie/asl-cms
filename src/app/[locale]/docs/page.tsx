import {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'

import {env, PagesConst} from '@/env'
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
  if (
    !isPageEnabled(PagesConst.DOCS) ||
    env.NEXT_PUBLIC_NODE_ENV !== 'development'
  ) {
    return notFound()
  }
  redirect(`/${locale}/docs/introduction`)
}
