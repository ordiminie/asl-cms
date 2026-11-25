import {getTranslations} from 'next-intl/server'
import type {CSSProperties} from 'react'
import {Body, Container, Head, Html, Preview, Section, Text} from 'react-email'

import type {SupportedLocale} from '@/lib/helper/locale-helper'

import {AssociationHeader, type EmailAssociation} from './association-header'
import {
  getInvitationContentTexts,
  InvitationContent,
} from './invitation-content'
import {
  EMAIL_COLORS,
  EMAIL_DARK_CLASSES,
  EMAIL_FONTS,
  emailDarkModeCss,
  getEmailAccent,
} from './theme'

export type InvitationMailProps = {
  url: string
  association: EmailAssociation
  /** Le texte de l'association (reglage) ; nul, le texte par defaut. */
  text: string | null
  /** L'echeance du lien, deja ecrite en toutes lettres (« 1 décembre 2026 »). */
  expiresOn: string
  locale: SupportedLocale
}

const EMAIL_WIDTH = 600

const bodyStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: EMAIL_COLORS.background,
  color: EMAIL_COLORS.foreground,
  fontFamily: EMAIL_FONTS.body,
  fontSize: '17px',
  lineHeight: 1.6,
}

/**
 * Email « Votre espace membre » (s42a, ecran 3) : gabarit transactionnel du
 * lien de connexion (design system §5.5), 600 px, tables, couleurs
 * hexadecimales et jumelles sombres (§5.2). Le texte de l'association, une
 * seule action doublee de l'URL en clair, trois etapes, pied transactionnel
 * sans desinscription.
 */
export default async function InvitationMail({
  url,
  association,
  text,
  expiresOn,
  locale,
}: InvitationMailProps) {
  const t = await getTranslations({locale, namespace: 'email.user.invitation'})
  const accent = getEmailAccent(association.hue)
  const values = {name: association.name, date: expiresOn}
  const c = EMAIL_DARK_CLASSES
  const content = getInvitationContentTexts(locale, {
    associationName: association.name,
    text,
    expiresOn,
  })

  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{emailDarkModeCss()}</style>
      </Head>
      <Preview>{t('preview', values)}</Preview>
      <Body style={bodyStyle} className={`${c.background} ${c.text}`}>
        <Container
          width={EMAIL_WIDTH}
          className={c.background}
          style={{
            maxWidth: `${EMAIL_WIDTH}px`,
            backgroundColor: EMAIL_COLORS.background,
          }}
        >
          <Section
            style={{
              backgroundColor: accent.surface,
              borderBottom: `3px solid ${accent.solid}`,
              padding: '16px 40px',
            }}
          >
            <AssociationHeader
              association={association}
              color={accent.foreground}
            />
          </Section>

          <Section style={{padding: '32px 40px'}}>
            <InvitationContent url={url} texts={content} />
          </Section>

          <Section
            className={c.background}
            style={{
              backgroundColor: EMAIL_COLORS.muted,
              padding: '16px 40px',
            }}
          >
            <Text
              className={c.textMuted}
              style={{
                margin: 0,
                fontSize: '14px',
                lineHeight: 1.6,
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('footer', values)}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
