import {getTranslations} from 'next-intl/server'
import {Fragment} from 'react'
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'

export type SubscriptionCanceledMailProps = {
  planName: string
  status: string
  seats: string
  price: string
  limits: string
  canceledAt: string
  periodEnd: string
}

export default async function SubscriptionCanceledMail({
  planName,
  status,
  seats,
  price,
  limits,
  canceledAt,
  periodEnd,
}: SubscriptionCanceledMailProps) {
  const t = await getTranslations('email.user.subscriptionCanceled')

  return (
    <Html>
      <Head />
      <Tailwind>
        <Fragment>
          <Preview>{t('preview', {planName})}</Preview>
          <Body className="mx-auto my-auto bg-white px-2 font-sans">
            <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-8">
              <Text className="text-2xl font-bold text-black">
                {t('title')}
              </Text>
              <Section className="my-4">
                <Text className="text-base">{t('message', {planName})}</Text>
                <Text className="mt-4 text-base font-semibold">
                  {t('planDetails')}
                </Text>
                <Text className="text-base">{t('planName', {planName})}</Text>
                <Text className="text-base">{t('status', {status})}</Text>
                <Text className="text-base">{t('seats', {seats})}</Text>
                <Text className="text-base">{t('price', {price})}</Text>
                <Text className="text-base">{t('limits', {limits})}</Text>
                <Text className="text-base">
                  {t('canceledAt', {canceledAt})}
                </Text>
                <Text className="text-base">{t('periodEnd', {periodEnd})}</Text>
                <Text className="mt-4 text-base text-blue-600">
                  {t('reactivateInfo')}
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
