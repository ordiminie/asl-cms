import {cacheLife} from 'next/cache'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {routing} from '@/i18n/routing'

import {ContactForm} from './contact-form'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ContactPage.metadata')
  return {
    title: t('title'),
    description: t('description'),
  }
}

const Page = async ({params}: {params: Promise<{locale: string}>}) => {
  'use cache'
  cacheLife('max')

  const {locale} = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <ContactForm />
      </div>
    </div>
  )
}

export default Page
