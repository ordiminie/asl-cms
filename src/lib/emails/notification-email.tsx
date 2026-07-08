import {getTranslations} from 'next-intl/server'
import React, {Fragment} from 'react'
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

type NotificationEmailProps = {
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  preview?: string
  language?: 'fr' | 'en' | 'es'
}

export default async function NotificationEmail({
  title,
  message,
  type,
  preview,
  language = 'fr',
}: NotificationEmailProps) {
  const t = await getTranslations({
    locale: language,
    namespace: 'email.user.notification',
  })

  // Couleurs selon le type de notification
  const typeStyles = {
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-600',
    },
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
  }

  const style = typeStyles[type]

  return (
    <Html>
      <Head />
      <Tailwind>
        <Fragment>
          <Preview>{preview || title}</Preview>
          <Body className="mx-auto my-auto bg-white px-2 font-sans">
            <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-solid border-[#eaeaea] p-8">
              {/* En-tête */}
              <Section className="mb-6">
                <Text className="mb-2 text-xl font-semibold text-gray-900">
                  {title}
                </Text>
              </Section>

              {/* Contenu principal de la notification */}
              <Section
                className={`rounded-lg border p-4 ${style.bgColor} ${style.borderColor} mb-6`}
              >
                <Text className={`text-sm ${style.textColor} mb-0`}>
                  {message}
                </Text>
              </Section>

              {/* Informations supplémentaires */}
              <Section className="mb-6">
                <Text className="mb-2 text-sm text-gray-600">
                  {t('additionalInfo')}
                </Text>
                <Text className="text-sm text-gray-500">
                  {t('timestamp', {
                    date: new Date().toLocaleDateString(language, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })}
                </Text>
              </Section>

              {/* Pied de page */}
              <Section className="border-t border-gray-200 pt-4">
                <Text className="mb-1 text-sm text-gray-500">
                  {t('footer.greeting')}
                </Text>
                <Text className="mb-1 text-sm text-gray-500">
                  {t('footer.signature')}
                </Text>
                <Text className="text-xs text-gray-400">
                  {t('footer.unsubscribe')}
                </Text>
              </Section>
            </Container>
          </Body>
        </Fragment>
      </Tailwind>
    </Html>
  )
}
