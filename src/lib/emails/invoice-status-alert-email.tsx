import {getTranslations} from 'next-intl/server'
import {type CSSProperties} from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'react-email'

import type {SupportedLocale} from '@/lib/helper/locale-helper'
import type {AccentHue} from '@/services/types/domain/association-settings-types'

import {
  CONTACT_MESSAGE_PREVIEW_MAX_LENGTH,
  CONTACT_MESSAGE_SUBJECT_MAX_LENGTH,
  fitToLength,
} from './contact-message-email'
import {
  EMAIL_COLORS,
  EMAIL_DARK_CLASSES,
  EMAIL_FONTS,
  emailDarkModeCss,
  getEmailAccent,
} from './theme'

/** L'association telle que l'email la montre : nom, teinte, logo PNG. */
export type InvoiceStatusAlertEmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul. */
  logoUrl?: string
  hue: AccentHue
}

export type InvoiceStatusAlertMailProps = {
  association: InvoiceStatusAlertEmailAssociation
  /** Le statut a classer, tel que la source l'ecrit. */
  status: string
  /** Factures de l'association qui le portent. */
  invoiceCount: number
  /** Adresse absolue de la page « Reglages » du back-office. */
  settingsUrl: string
  locale: SupportedLocale
}

/** Objet : 60 caracteres au plus, pre-en-tete : 90 (design system §5.6). */
export const INVOICE_STATUS_ALERT_SUBJECT_MAX_LENGTH =
  CONTACT_MESSAGE_SUBJECT_MAX_LENGTH
export const INVOICE_STATUS_ALERT_PREVIEW_MAX_LENGTH =
  CONTACT_MESSAGE_PREVIEW_MAX_LENGTH

const EMAIL_WIDTH = 600
const LOGO_SIZE = 36
const NAMESPACE = 'email.invoice.statusAlert'

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
 * Email au bureau : un statut de facture n'est dans aucune des deux listes
 * du tenant (s19, ecran 4), sur le patron des notifications au bureau de s23
 * (design system §5). **Aucun nom de membre ni montant** : le detail se lit
 * dans le back-office.
 */
export default async function InvoiceStatusAlertMail({
  association,
  status,
  invoiceCount,
  settingsUrl,
  locale,
}: InvoiceStatusAlertMailProps) {
  const t = await getTranslations({locale, namespace: NAMESPACE})
  const accent = getEmailAccent(association.hue)
  const preview = fitToLength(
    t('preview', {status}),
    INVOICE_STATUS_ALERT_PREVIEW_MAX_LENGTH
  )
  const c = EMAIL_DARK_CLASSES

  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{emailDarkModeCss()}</style>
      </Head>
      <Preview>{preview}</Preview>
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
            <table role="presentation" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  {association.logoUrl && (
                    <td style={{paddingRight: '12px', verticalAlign: 'middle'}}>
                      <Img
                        src={association.logoUrl}
                        alt={association.name}
                        width={LOGO_SIZE}
                        height={LOGO_SIZE}
                        style={{display: 'block'}}
                      />
                    </td>
                  )}
                  <td
                    style={{
                      verticalAlign: 'middle',
                      fontFamily: EMAIL_FONTS.heading,
                      fontSize: '20px',
                      fontWeight: 600,
                      color: accent.foreground,
                    }}
                  >
                    {association.name}
                  </td>
                </tr>
              </tbody>
            </table>
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
              {t('title')}
            </Heading>
            <Text className={c.text} style={paragraphStyle}>
              {t('intro', {status})}
            </Text>
            <Text className={c.text} style={paragraphStyle}>
              {t('consequence')}
            </Text>
            <Text className={c.text} style={paragraphStyle}>
              {t('count', {count: invoiceCount})}
            </Text>
            <Text className={c.text} style={paragraphStyle}>
              {t('howTo')}
            </Text>
            <Text
              className={c.text}
              style={{...paragraphStyle, wordBreak: 'break-all'}}
            >
              {t('urlIntro')}{' '}
              <Link
                href={settingsUrl}
                className={c.link}
                style={{color: EMAIL_COLORS.link}}
              >
                {settingsUrl}
              </Link>
            </Text>
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
              {t('footer', {name: association.name})}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
