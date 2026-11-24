import {getTranslations} from 'next-intl/server'
import type {CSSProperties, ReactNode} from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email'

import type {SupportedLocale} from '@/lib/helper/locale-helper'

import {AssociationHeader, type EmailAssociation} from './association-header'
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

const paragraphStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: '17px',
  lineHeight: 1.6,
  color: EMAIL_COLORS.foreground,
}

/**
 * Les paragraphes du texte de l'association : separes par une ligne vide,
 * rendus comme **texte** (jamais comme HTML), retours a la ligne gardes.
 */
export const invitationParagraphsOf = (text: string): string[] =>
  text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')

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
  const paragraphs = invitationParagraphsOf(text ?? t('defaultText'))

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
            <Heading
              as="h1"
              className={c.text}
              style={{
                margin: '0 0 20px',
                fontFamily: EMAIL_FONTS.heading,
                fontSize: '24px',
                fontWeight: 600,
                color: EMAIL_COLORS.foreground,
              }}
            >
              {t('title', values)}
            </Heading>
            {paragraphs.map((paragraph, index) => (
              <Text
                key={index}
                className={c.text}
                style={{...paragraphStyle, whiteSpace: 'pre-line'}}
              >
                {paragraph}
              </Text>
            ))}
            <ActionButton url={url} label={t('action')} />
            <Text
              className={c.textMuted}
              style={{
                ...paragraphStyle,
                margin: '0 0 4px',
                textAlign: 'center',
                fontSize: '15px',
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('urlIntro')}
            </Text>
            <Text
              style={{
                ...paragraphStyle,
                textAlign: 'center',
                fontSize: '15px',
                wordBreak: 'break-all',
              }}
            >
              <Link
                href={url}
                className={c.link}
                style={{color: EMAIL_COLORS.link}}
              >
                {url}
              </Link>
            </Text>
            <ol
              className={c.text}
              style={{
                margin: 0,
                paddingLeft: '24px',
                fontSize: '17px',
                lineHeight: 1.6,
                color: EMAIL_COLORS.foreground,
              }}
            >
              <li style={{marginBottom: '12px'}}>{t('step1')}</li>
              <li style={{marginBottom: '12px'}}>{t('step2', values)}</li>
              <li>
                {t.rich('step3', {
                  strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
                })}
              </li>
            </ol>
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

function ActionButton({url, label}: {url: string; label: string}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      align="center"
      style={{margin: '8px auto 20px'}}
    >
      <tbody>
        <tr>
          <td
            className={EMAIL_DARK_CLASSES.button}
            style={{
              backgroundColor: EMAIL_COLORS.primary,
              borderRadius: '8px',
            }}
          >
            <Link
              href={url}
              className={EMAIL_DARK_CLASSES.buttonText}
              style={{
                display: 'inline-block',
                padding: '16px 32px',
                fontSize: '19px',
                fontWeight: 700,
                lineHeight: '24px',
                color: `${EMAIL_COLORS.buttonForeground} !important`,
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
