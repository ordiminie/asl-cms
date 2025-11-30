import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {routing} from '@/i18n/routing'

export const dynamic = 'force-static'
export const dynamicParams = false

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
  const t = await getTranslations({locale, namespace: 'PrivacyPage'})

  return {
    title: t('title'),
    description: t('description'),
  }
}

const Page = async ({params}: {params: Promise<{locale: string}>}) => {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations('PrivacyPage')

  const privacySections = [
    {key: 'privacyPolicy', hasContents: false},
    {key: 'collectedInformation', hasContents: true},
    {key: 'informationUsage', hasContents: true},
    {key: 'informationProtection', hasContents: false},
    {key: 'dataRetention', hasContents: false},
    {key: 'policyChanges', hasContents: false},
  ]

  return (
    <div className="mx-auto max-w-3xl p-6 text-lg">
      <h1 className="mb-6 text-3xl font-bold">{t('title')}</h1>
      {privacySections.map((section) => {
        const contents = section.hasContents
          ? (t.raw(`sections.${section.key}.contents`) as string[])
          : []

        return (
          <PrivacySection
            key={section.key}
            title={t(`sections.${section.key}.title`)}
            description={t(`sections.${section.key}.description`)}
            contents={contents}
          />
        )
      })}
    </div>
  )
}

type PrivacySectionProps = {
  title: string
  description: string
  contents: string[]
}

const PrivacySection = ({
  title,
  description,
  contents,
}: PrivacySectionProps) => {
  return (
    <div className="py-2">
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-4">{description}</p>
      {contents.length > 0 && (
        <ul className="text-muted-foreground pl-8">
          {contents.map((content, index) => (
            <li className="list-disc p-1" key={index}>
              {content}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Page
