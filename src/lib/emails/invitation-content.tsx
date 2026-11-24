import {createTranslator} from 'next-intl'
import type {CSSProperties, ReactNode} from 'react'
import {Heading, Link, Text} from 'react-email'

import type {SupportedLocale} from '@/lib/helper/locale-helper'

import fr from '../../../messages/fr.json'
import {EMAIL_COLORS, EMAIL_DARK_CLASSES, EMAIL_FONTS} from './theme'

/** Les messages de chaque locale du produit (ADR 008 : `fr` seule). */
const MESSAGES: Record<SupportedLocale, typeof fr> = {fr}

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

/** Les phrases du contenu d'une invitation, deja traduites. */
export type InvitationContentTexts = {
  title: string
  paragraphs: string[]
  action: string
  urlIntro: string
  step1: string
  step2: string
  /** La troisieme etape, « aucun mot de passe » en gras. */
  step3: ReactNode
  /** La meme, en texte brut. */
  step3Plain: string
}

/**
 * Le contenu d'une invitation (s42a, ecran 3 ; s42b, ADR 072 §7) : titre,
 * texte de l'association ou texte par defaut, action, URL en clair, trois
 * etapes. Traduit par `createTranslator`, sans requete : le planificateur
 * compose les campagnes hors de Next.
 */
export const getInvitationContentTexts = (
  locale: SupportedLocale,
  {
    associationName,
    text,
    expiresOn,
  }: {associationName: string; text: string | null; expiresOn: string}
): InvitationContentTexts => {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: 'email.user.invitation',
  })
  const values = {name: associationName, date: expiresOn}
  return {
    title: t('title', values),
    paragraphs: invitationParagraphsOf(text ?? t('defaultText')),
    action: t('action'),
    urlIntro: t('urlIntro'),
    step1: t('step1'),
    step2: t('step2', values),
    step3: t.rich('step3', {
      strong: (chunks: ReactNode) => <strong>{chunks}</strong>,
    }),
    step3Plain: t.markup('step3', {strong: (chunks) => chunks}),
  }
}

/** Le contenu d'une invitation en texte brut, pour la version texte. */
export type InvitationPlainContent = {
  title: string
  paragraphs: string[]
  action: string
  url: string
  steps: string[]
}

export const invitationPlainContentOf = (
  texts: InvitationContentTexts,
  url: string
): InvitationPlainContent => ({
  title: texts.title,
  paragraphs: texts.paragraphs,
  action: texts.action,
  url,
  steps: [texts.step1, texts.step2, texts.step3Plain],
})

const paragraphStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: '17px',
  lineHeight: 1.6,
  color: EMAIL_COLORS.foreground,
}

/**
 * Le bloc d'une invitation, partage par l'email transactionnel de s42a et
 * l'habillage de campagne du lancement (ADR 072 §7) : un seul contenu
 * d'invitation, deux enveloppes.
 */
export function InvitationContent({
  url,
  texts,
}: {
  url: string
  texts: InvitationContentTexts
}) {
  const c = EMAIL_DARK_CLASSES
  return (
    <>
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
        {texts.title}
      </Heading>
      {texts.paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          className={c.text}
          style={{...paragraphStyle, whiteSpace: 'pre-line'}}
        >
          {paragraph}
        </Text>
      ))}
      <ActionButton url={url} label={texts.action} />
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
        {texts.urlIntro}
      </Text>
      <Text
        style={{
          ...paragraphStyle,
          textAlign: 'center',
          fontSize: '15px',
          wordBreak: 'break-all',
        }}
      >
        <Link href={url} className={c.link} style={{color: EMAIL_COLORS.link}}>
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
        <li style={{marginBottom: '12px'}}>{texts.step1}</li>
        <li style={{marginBottom: '12px'}}>{texts.step2}</li>
        <li>{texts.step3}</li>
      </ol>
    </>
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
