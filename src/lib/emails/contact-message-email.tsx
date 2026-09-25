import {getTranslations} from 'next-intl/server'
import {type CSSProperties, Fragment, type ReactNode} from 'react'
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
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'

import {
  EMAIL_COLORS,
  EMAIL_DARK_CLASSES,
  EMAIL_FONTS,
  emailDarkModeCss,
  getEmailAccent,
} from './theme'

/** L'association telle que l'email la montre : nom, teinte, logo PNG. */
export type ContactMessageEmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul. */
  logoUrl?: string
  hue: AccentHue
}

/** Le message tel que l'email le montre. */
export type ContactMessageEmailMessage = {
  senderName: string | null
  senderEmail: string
  subject: string
  body: string
  createdAt: Date
}

export type ContactMessageMailProps = {
  association: ContactMessageEmailAssociation
  message: ContactMessageEmailMessage
  /** Adresse absolue du message dans le back-office du bureau. */
  messageUrl: string
  /** Locale explicite : l'email part d'une Server Action (s03). */
  locale: SupportedLocale
}

/** Objet : 60 caracteres au plus, pre-en-tete : 90 (design system §5.6). */
export const CONTACT_MESSAGE_SUBJECT_MAX_LENGTH = 60
export const CONTACT_MESSAGE_PREVIEW_MAX_LENGTH = 90

const ELLIPSIS = '…'

/** Coupe un texte a `max` caracteres, points de suspension compris. */
export const fitToLength = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}${ELLIPSIS}`

/**
 * Objet prefixe du nom de l'association. Trop long, c'est le nom qui se
 * raccourcit : l'objet commence toujours par lui et garde sa fin.
 */
export const fitSubjectToLength = (
  subjectOf: (name: string) => string,
  name: string,
  max: number = CONTACT_MESSAGE_SUBJECT_MAX_LENGTH
): string => {
  const full = subjectOf(name)
  if (full.length <= max) return full

  const overflow = full.length - max
  return subjectOf(fitToLength(name, name.length - overflow))
}

const EMAIL_WIDTH = 600
const LOGO_SIZE = 36

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

const labelCellStyle: CSSProperties = {
  padding: '6px 16px 6px 0',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
  fontSize: '16px',
  lineHeight: 1.6,
  color: EMAIL_COLORS.mutedForeground,
}

const valueCellStyle: CSSProperties = {
  padding: '6px 0',
  verticalAlign: 'top',
  fontSize: '17px',
  lineHeight: 1.6,
  color: EMAIL_COLORS.foreground,
}

/**
 * Email d'avertissement au bureau d'un message recu depuis la page Contact
 * (ecran 4 du design s08, design system §5) : 600 px, tables, styles en
 * ligne, couleurs de `theme.ts` seulement, jumelles sombres servies par
 * `prefers-color-scheme` et `[data-ogsc]`. L'adresse du visiteur est ecrite en
 * clair : c'est par elle que le bureau repond.
 */
export default async function ContactMessageMail({
  association,
  message,
  messageUrl,
  locale,
}: ContactMessageMailProps) {
  const t = await getTranslations({
    locale,
    namespace: 'email.contact.notification',
  })
  const accent = getEmailAccent(association.hue)
  const receivedAt = receivedAtPartsOf(message.createdAt, locale)
  const sender = message.senderName ?? message.senderEmail
  const preview = fitToLength(
    t('preview', {sender, subject: message.subject}),
    CONTACT_MESSAGE_PREVIEW_MAX_LENGTH
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
              {t('title')}
            </Heading>
            <Text className={c.text} style={paragraphStyle}>
              {t('intro')}
            </Text>

            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              style={{margin: '0 0 20px', borderCollapse: 'collapse'}}
            >
              <tbody>
                <DetailRow label={t('labels.from')}>
                  {message.senderName ?? t('anonymous')}
                </DetailRow>
                <DetailRow label={t('labels.email')}>
                  <Link
                    href={`mailto:${message.senderEmail}`}
                    className={c.link}
                    style={{color: EMAIL_COLORS.link}}
                  >
                    {message.senderEmail}
                  </Link>
                </DetailRow>
                <DetailRow label={t('labels.subject')}>
                  {message.subject}
                </DetailRow>
                <DetailRow label={t('labels.receivedAt')}>
                  {t('receivedAt', receivedAt)}
                </DetailRow>
              </tbody>
            </table>

            <Text
              className={c.textMuted}
              style={{
                ...paragraphStyle,
                margin: '0 0 8px',
                fontSize: '16px',
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('labels.message')}
            </Text>
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              width="100%"
              style={{margin: '0 0 24px', borderCollapse: 'collapse'}}
            >
              <tbody>
                <tr>
                  <td
                    className={`${c.background} ${c.rule} ${c.text}`}
                    style={{
                      padding: '16px 20px',
                      backgroundColor: EMAIL_COLORS.muted,
                      border: `1px solid ${EMAIL_COLORS.border}`,
                      borderRadius: '8px',
                      fontSize: '17px',
                      lineHeight: 1.6,
                      color: EMAIL_COLORS.foreground,
                    }}
                  >
                    <MessageBody body={message.body} />
                  </td>
                </tr>
              </tbody>
            </table>

            <ActionButton url={messageUrl} label={t('action')} />
            <Text
              style={{
                ...paragraphStyle,
                textAlign: 'center',
                fontSize: '15px',
                wordBreak: 'break-all',
              }}
            >
              <Link
                href={messageUrl}
                className={c.link}
                style={{color: EMAIL_COLORS.link}}
              >
                {messageUrl}
              </Link>
            </Text>
            <Text
              className={c.textMuted}
              style={{
                ...paragraphStyle,
                margin: 0,
                fontSize: '16px',
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('reply', {email: message.senderEmail})}
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

function DetailRow({label, children}: {label: string; children: ReactNode}) {
  return (
    <tr>
      <td className={EMAIL_DARK_CLASSES.textMuted} style={labelCellStyle}>
        {label}
      </td>
      <td className={EMAIL_DARK_CLASSES.text} style={valueCellStyle}>
        {children}
      </td>
    </tr>
  )
}

/** Les retours a la ligne du visiteur, conserves en `<br>`. */
function MessageBody({body}: {body: string}) {
  const lines = body.split(/\r?\n/)
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  )
}

function AssociationHeader({
  association,
  color,
}: {
  association: ContactMessageEmailAssociation
  color: string
}) {
  return (
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
              color,
            }}
          >
            {association.name}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function ActionButton({url, label}: {url: string; label: string}) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      align="center"
      style={{margin: '8px auto 12px'}}
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
                padding: '12px 28px',
                fontSize: '17px',
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
