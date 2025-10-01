import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'
import {getTranslations} from 'next-intl/server'
import {Fragment} from 'react'

VerificationEmail.PreviewProps = {
  url: 'https://example.com/verify-email?token=123',
} as VerificationMailProps

type VerificationMailProps = {
  url: string
}

export default async function VerificationEmail({url}: VerificationMailProps) {
  const t = await getTranslations('email.user.verification')

  return (
    <Html>
      <Head />
      <Tailwind>
        <Fragment>
          <Preview>{t('preview')}</Preview>
          <Body className="mx-auto my-auto bg-white px-2 font-sans">
            <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-8">
              <Text className="text-2xl font-bold text-black">
                {t('title')}
              </Text>
              <Section className="my-4">
                <Text className="text-base">{t('welcomeMessage')}</Text>
                <Text className="text-base">
                  <Link className="text-sky-500 underline" href={url}>
                    {t('clickToVerify')}
                  </Link>
                </Text>
                <Text className="mt-4 text-base text-gray-500">
                  {t('expirationWarning')}
                </Text>
                <Text className="mt-2 text-base text-gray-500">
                  {t('ignoreMessage')}
                </Text>
              </Section>
              <Text className="text-base leading-6 text-gray-500">
                {t('footer')}
              </Text>
            </Container>
          </Body>
        </Fragment>
      </Tailwind>
    </Html>
  )
}
