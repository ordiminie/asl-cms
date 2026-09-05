import {getTranslations} from 'next-intl/server'
import {Fragment} from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'

OtpEmail.PreviewProps = {
  otp: '123456',
  otpLink: 'https://example.com/verify-request/otp?code=123456',
} as OtpEmailProps

type OtpEmailProps = {
  otp: string
  otpLink?: string
}

export default async function OtpEmail({otp, otpLink}: OtpEmailProps) {
  const t = await getTranslations('email.user.otp')

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
                <Text className="text-base">{t('description')}</Text>
                <Text className="mt-4 text-center text-3xl font-bold tracking-widest text-sky-500">
                  {otp}
                </Text>
                <Text className="mt-4 text-base text-gray-500">
                  {t('expirationWarning')}
                </Text>
                {otpLink && (
                  <Section className="my-6 text-center">
                    <Button
                      className="rounded-md bg-sky-500 px-6 py-3 font-medium text-white"
                      href={otpLink}
                    >
                      {t('verifyAutomatically')}
                    </Button>
                    <Text className="mt-2 text-sm text-gray-500">
                      {t('orCopyCode')}
                    </Text>
                  </Section>
                )}
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
