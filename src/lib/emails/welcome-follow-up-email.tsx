import {getTranslations} from 'next-intl/server'
import React from 'react'
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
} from 'react-email'

type WelcomeFollowUpEmailProps = {
  userName: string
  userEmail: string
  appUrl: string
  language?: 'fr' | 'en' | 'es'
}

export default async function WelcomeFollowUpEmail({
  userName,
  userEmail,
  appUrl,
  language = 'fr',
}: WelcomeFollowUpEmailProps) {
  const t = await getTranslations({
    locale: language,
    namespace: 'WelcomeFollowUpEmail',
  })

  return (
    <Html>
      <Head />
      <Preview>{t('preview')}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-[40px] w-[465px] rounded border border-solid border-[#eaeaea] p-[20px]">
            <Section className="mt-[32px]">
              <Text className="text-center text-[24px] font-semibold text-black">
                {t('title')}
              </Text>
            </Section>

            <Section className="mt-[32px]">
              <Text className="text-[14px] leading-[24px] text-black">
                {t('greeting', {name: userName})}
              </Text>

              <Text className="text-[14px] leading-[24px] text-black">
                {t('message')}
              </Text>

              <Section className="my-[24px] text-center">
                <Link
                  className="rounded bg-blue-600 px-6 py-3 text-white no-underline"
                  href={`${appUrl}/dashboard`}
                >
                  {t('ctaButton')}
                </Link>
              </Section>

              <Text className="text-[14px] leading-[24px] text-black">
                {t('tips.title')}
              </Text>

              <Text className="ml-4 text-[14px] leading-[24px] text-black">
                • {t('tips.tip1')}
              </Text>
              <Text className="ml-4 text-[14px] leading-[24px] text-black">
                • {t('tips.tip2')}
              </Text>
              <Text className="ml-4 text-[14px] leading-[24px] text-black">
                • {t('tips.tip3')}
              </Text>

              <Text className="text-[14px] leading-[24px] text-black">
                {t('support')}
              </Text>
            </Section>

            <Section className="mt-[32px]">
              <Text className="text-[12px] leading-[24px] text-[#666666]">
                {t('footer', {email: userEmail})}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
