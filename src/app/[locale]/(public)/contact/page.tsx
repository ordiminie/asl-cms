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
    <div className="mx-auto w-full max-w-[68ch] px-[18px] py-12 sm:px-6">
      <ContactForm />
    </div>
  )
}

export default Page
