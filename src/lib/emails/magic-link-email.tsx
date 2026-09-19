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

import {MAGIC_LINK_EXPIRES_IN_MINUTES} from '@/lib/better-auth/magic-link-constants'
import type {AccentHue} from '@/services/types/domain/association-settings-types'

import {EMAIL_COLORS, EMAIL_FONTS, getEmailAccent} from './theme'

/** L'association du domaine appele, telle que l'email la montre. */
export type MagicLinkEmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul (s03, manque n° 2). */
  logoUrl?: string
  hue: AccentHue
}

export type MagicLinkMailProps = {
  url: string
  association: MagicLinkEmailAssociation
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

/**
 * Email de connexion (design system §5, planche D de s03) : 600 px, tables,
 * styles en ligne, couleurs hexadecimales de `theme.ts`. Une seule action,
 * doublee de l'URL en clair ; pied transactionnel, sans desinscription.
 */
export default async function MagicLinkMail({
  url,
  association,
}: MagicLinkMailProps) {
  const t = await getTranslations('email.user.magicLink')
  const accent = getEmailAccent(association.hue)
  const values = {
    name: association.name,
    minutes: MAGIC_LINK_EXPIRES_IN_MINUTES,
  }

  return (
    <Html lang="fr">
      <Head />
      <Preview>{t('preview', values)}</Preview>
      <Body style={bodyStyle}>
        <Container
          width={EMAIL_WIDTH}
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
            <AssociationHeader association={association} color={accent.foreground} />
          </Section>

          <Section style={{padding: '32px 40px'}}>
            <Heading
              as="h1"
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
            <Text style={paragraphStyle}>
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
              <Link href={url} style={{color: EMAIL_COLORS.link}}>
                {url}
              </Link>
            </Text>
            <Text
              style={{
                ...paragraphStyle,
                margin: 0,
                fontSize: '16px',
                color: EMAIL_COLORS.mutedForeground,
              }}
            >
              {t('ignore')}
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: EMAIL_COLORS.muted,
              padding: '16px 40px',
            }}
          >
            <Text
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
            style={{
              backgroundColor: EMAIL_COLORS.primary,
              borderRadius: '8px',
            }}
          >
            <Link
              href={url}
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
