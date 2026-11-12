import {createTranslator} from 'next-intl'
import {type CSSProperties, Fragment} from 'react'
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

import fr from '../../../messages/fr.json'
import type {CampaignFooterTexts} from './campaign-text'
import {
  EMAIL_COLORS,
  EMAIL_DARK_CLASSES,
  EMAIL_FONTS,
  emailDarkModeCss,
  getEmailAccent,
} from './theme'

/** L'association telle que la campagne la montre : en-tete et pied. */
export type CampaignEmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul. */
  logoUrl?: string
  hue: AccentHue
  /** Raison sociale des Reglages ; vide, le pied porte le nom seul. */
  legalName: string | null
  /** Mentions du pied des Reglages ; vides, aucune mention. */
  legalMentions: string | null
}

export type CampaignMailProps = {
  association: CampaignEmailAssociation
  /** L'objet saisi, sans le prefixe de l'association : le titre `<h1>`. */
  heading: string
  preheader: string | null
  /** Corps **deja assaini** par `renderCampaignBodyHtml`. */
  bodyHtml: string
  /** Adresse absolue de la page publique de desinscription. */
  unsubscribeUrl: string
  locale: SupportedLocale
}

const EMAIL_WIDTH = 600
const LOGO_SIZE = 36

const blankToNull = (value: string | null): string | null =>
  value && value.trim() !== '' ? value.trim() : null

/** Les messages de chaque locale du produit (ADR 008 : `fr` seule). */
const MESSAGES: Record<SupportedLocale, typeof fr> = {fr}

/**
 * Les phrases du pied « facultatif » (ecran E du design s25), partagees par le
 * gabarit et la version texte : un seul endroit les compose. Traduites par
 * `createTranslator`, sans requete : le planificateur (script de la minuterie,
 * ADR 052) compose les campagnes hors de Next, ou `next-intl/server` leve.
 */
export const getCampaignFooterTexts = async (
  locale: SupportedLocale,
  association: Pick<
    CampaignEmailAssociation,
    'name' | 'legalName' | 'legalMentions'
  >
): Promise<CampaignFooterTexts> => {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: 'email.campaign.footer',
  })
  return {
    associationName: association.name,
    legalName: blankToNull(association.legalName),
    legalMentions: blankToNull(association.legalMentions),
    reason: t('reason', {name: association.name}),
    unsubscribeLabel: t('unsubscribe'),
    notice: t('notice'),
  }
}

const bodyStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  backgroundColor: EMAIL_COLORS.background,
  color: EMAIL_COLORS.foreground,
  fontFamily: EMAIL_FONTS.body,
  fontSize: '17px',
  lineHeight: 1.6,
}

const footerTextStyle: CSSProperties = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: 1.6,
  color: EMAIL_COLORS.mutedForeground,
}

/**
 * L'habillage commun de **tout** envoi de campagne, modele ou mode libre
 * (critere 3, ADR 051) : en-tete au logo, corps, pied avec mentions, motif et
 * desinscription. 600 px, tables, styles en ligne, couleurs de `theme.ts`
 * seulement, jumelles sombres par `prefers-color-scheme` et `[data-ogsc]`.
 */
export default async function CampaignMail({
  association,
  heading,
  preheader,
  bodyHtml,
  unsubscribeUrl,
  locale,
}: CampaignMailProps) {
  const footer = await getCampaignFooterTexts(locale, association)
  const accent = getEmailAccent(association.hue)
  const c = EMAIL_DARK_CLASSES

  return (
    <Html lang={locale}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{emailDarkModeCss()}</style>
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
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
              padding: '16px 32px',
            }}
          >
            <AssociationHeader
              association={association}
              color={accent.foreground}
            />
          </Section>

          <Section style={{padding: '32px'}}>
            <Heading
              as="h1"
              className={c.text}
              style={{
                margin: '0 0 24px',
                fontFamily: EMAIL_FONTS.heading,
                fontSize: '24px',
                lineHeight: 1.25,
                fontWeight: 700,
                color: EMAIL_COLORS.foreground,
              }}
            >
              {heading}
            </Heading>
            <div
              className={c.text}
              style={{
                fontSize: '17px',
                lineHeight: 1.6,
                color: EMAIL_COLORS.foreground,
              }}
              dangerouslySetInnerHTML={{__html: bodyHtml}}
            />
          </Section>

          <Section
            className={c.background}
            style={{
              backgroundColor: EMAIL_COLORS.muted,
              borderTop: `1px solid ${EMAIL_COLORS.border}`,
              padding: '24px 32px',
            }}
          >
            <CampaignFooter footer={footer} unsubscribeUrl={unsubscribeUrl} />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

function CampaignFooter({
  footer,
  unsubscribeUrl,
}: {
  footer: CampaignFooterTexts
  unsubscribeUrl: string
}) {
  const c = EMAIL_DARK_CLASSES
  const mentions = [footer.legalName, footer.legalMentions]
    .filter((value): value is string => value !== null)
    .join('\n')

  return (
    <>
      <Text
        className={c.text}
        style={{
          ...footerTextStyle,
          margin: '0 0 8px',
          fontSize: '17px',
          fontWeight: 700,
          color: EMAIL_COLORS.foreground,
        }}
      >
        {footer.associationName}
      </Text>
      {mentions !== '' && (
        <Text className={c.textMuted} style={footerTextStyle}>
          <MultilineText text={mentions} />
        </Text>
      )}
      <Text className={c.textMuted} style={footerTextStyle}>
        {footer.reason}
      </Text>
      <UnsubscribeButton url={unsubscribeUrl} label={footer.unsubscribeLabel} />
      <Text
        style={{
          ...footerTextStyle,
          margin: '8px 0 16px',
          wordBreak: 'break-all',
        }}
      >
        <Link
          href={unsubscribeUrl}
          className={c.link}
          style={{color: EMAIL_COLORS.link, textDecoration: 'underline'}}
        >
          {unsubscribeUrl}
        </Link>
      </Text>
      <Text className={c.textMuted} style={{...footerTextStyle, margin: 0}}>
        {footer.notice}
      </Text>
    </>
  )
}

/** Les retours a la ligne des mentions, conserves en `<br>`. */
function MultilineText({text}: {text: string}) {
  return (
    <>
      {text.split(/\r?\n/).map((line, index) => (
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
  association: CampaignEmailAssociation
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
              fontWeight: 700,
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

/** Bouton contour du pied (ecran E), en table : cible de 48 px. */
function UnsubscribeButton({url, label}: {url: string; label: string}) {
  const c = EMAIL_DARK_CLASSES
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{borderCollapse: 'separate'}}
    >
      <tbody>
        <tr>
          <td
            className={c.rule}
            style={{
              border: `1px solid ${EMAIL_COLORS.input}`,
              borderRadius: '8px',
              height: '48px',
              padding: '0 24px',
              verticalAlign: 'middle',
            }}
          >
            <Link
              href={url}
              className={c.text}
              style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: '48px',
                color: EMAIL_COLORS.foreground,
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
