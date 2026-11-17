import {getTranslations} from 'next-intl/server'
import type {CSSProperties, ReactNode} from 'react'
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
import {joinParcelNumbers} from '@/services/rules/campaign-rules'

import type {MagicLinkEmailAssociation} from './magic-link-email'
import {
  EMAIL_COLORS,
  EMAIL_DARK_CLASSES,
  EMAIL_FONTS,
  emailDarkModeCss,
  getEmailAccent,
} from './theme'

export type MemberEmailConfirmationMailProps = {
  url: string
  association: MagicLinkEmailAssociation
  /** La personne connectee qui a ajoute (ou modifie) l'adresse. */
  authorName: string
  /** Le nom de la premiere fiche concernee. */
  profileName: string
  /** Les parcelles actuelles des fiches concernees, en ordre numerique. */
  parcelNumbers: string[]
  /** L'echeance du lien, deja ecrite en toutes lettres (« 23 novembre 2026 »). */
  expiresOn: string
  locale: SupportedLocale
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

/** Les valeurs communes au texte HTML et au texte brut de l'envoi. */
export const memberEmailConfirmationValuesOf = (
  props: Pick<
    MemberEmailConfirmationMailProps,
    'association' | 'authorName' | 'profileName' | 'parcelNumbers' | 'expiresOn'
  >
) => ({
  name: props.association.name,
  author: props.authorName,
  profile: props.profileName,
  count: props.parcelNumbers.length,
  numbers: joinParcelNumbers(props.parcelNumbers),
  date: props.expiresOn,
})

/**
 * Email « Confirmez votre adresse email » (s54, ecran 2) : gabarit
 * transactionnel du lien magique (design system §5.5), 600 px, tables,
 * couleurs hexadecimales et jumelles sombres (§5.2). Une seule action,
 * doublee de l'URL en clair ; pied transactionnel, sans desinscription.
 */
export default async function MemberEmailConfirmationMail(
  props: MemberEmailConfirmationMailProps
) {
  const {url, association, locale} = props
  const t = await getTranslations({
    locale,
    namespace: 'email.user.memberEmailConfirmation',
  })
  const accent = getEmailAccent(association.hue)
  const values = memberEmailConfirmationValuesOf(props)
  const c = EMAIL_DARK_CLASSES

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
              {t('title')}
            </Heading>
            <Text className={c.text} style={paragraphStyle}>
              {t('greeting')}
            </Text>
            <Text className={c.text} style={paragraphStyle}>
              {t.rich('intro', {
                ...values,
                strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
              })}
            </Text>
            <ActionButton url={url} label={t('action')} />
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
            <Text
              className={c.textMuted}
              style={{
                ...paragraphStyle,
                margin: 0,
                fontSize: '16px',
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('expiry', values)}
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
              {t('footer', values)}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function AssociationHeader({
  association,
  color,
}: {
  association: MagicLinkEmailAssociation
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
