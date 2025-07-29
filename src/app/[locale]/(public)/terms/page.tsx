import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {routing} from '@/i18n/routing'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}))
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'TermsPage'})

  return {
    title: t('title'),
    description: t('description'),
  }
}

const Page = async ({params}: {params: Promise<{locale: string}>}) => {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations('TermsPage')
  const terms = t.raw('terms') as Array<{
    title: string
    contents: string[]
  }>

  return (
    <div className="mx-auto max-w-3xl p-6 text-lg">
      <h1 className="mb-4 text-3xl font-bold">{t('title')}</h1>
      {terms.map((term, index) => {
        return <Term key={term.title} {...term} index={index + 1} />
      })}
    </div>
  )
}

type TermsProps = {
  title: string
  contents: string[]
  index: number
}
const Term = (props: TermsProps) => {
  const {title, contents, index} = props
  const termsContent = contents.map((content, cIndex) => {
    return (
      <li className="p-1" key={cIndex}>
        <span className="">
          {index}.{cIndex + 1}.
        </span>{' '}
        {content}
      </li>
    )
  })
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-xl font-semibold">
        <span>{index}.</span> {title}
      </h2>
      <ul className="text-muted-foreground pl-3">{termsContent}</ul>
    </div>
  )
}

export default Page
