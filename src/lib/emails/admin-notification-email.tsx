import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'
import React, {Fragment} from 'react'

import {APP_NAME} from '../constants'

type AdminNotificationEmailProps = {
  title: string
  data: string
}

export default function AdminNotificationEmail({
  title,
  data,
}: AdminNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Fragment>
          <Preview>{title}</Preview>
          <Body className="mx-auto my-auto bg-white px-2 font-sans">
            <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-8">
              {/* En-tête */}
              <Section className="mb-6">
                <Text className="mb-2 text-2xl font-bold text-gray-900">
                  [Admin] {title}
                </Text>
              </Section>

              {/* Contenu */}
              <Section className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <Text className="text-base whitespace-pre-wrap text-gray-900">
                  {data}
                </Text>
              </Section>

              {/* Pied de page */}
              <Section className="border-t border-gray-200 pt-4">
                <Text className="text-xs text-gray-400">
                  Ceci est une notification automatique destinée aux
                  administrateurs. {APP_NAME}
                </Text>
              </Section>
            </Container>
          </Body>
        </Fragment>
      </Tailwind>
    </Html>
  )
}
