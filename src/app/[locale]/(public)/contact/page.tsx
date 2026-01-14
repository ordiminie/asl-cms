import {Metadata} from 'next/types'
import {setRequestLocale} from 'next-intl/server'

import {routing} from '@/i18n/routing'

import {ContactForm} from './contact-form'

export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Contact',
    description: 'Contactez-nous pour toute question ou demande.',
  }
}

const Page = async ({params}: {params: Promise<{locale: string}>}) => {
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
