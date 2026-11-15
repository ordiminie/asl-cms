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
export type MemberQuestionEmailAssociation = {
  name: string
  /** URL absolue d'un logo PNG ; absente, le nom seul. */
  logoUrl?: string
  hue: AccentHue
}

/** La question telle que l'email la montre, identite lue sur la fiche. */
export type MemberQuestionEmailQuestion = {
  categoryName: string
  memberName: string
  /** Nul quand la fiche n'a pas d'adresse email. */
  memberEmail: string | null
  body: string
  createdAt: Date
}

export type MemberQuestionMailProps = {
  association: MemberQuestionEmailAssociation
  question: MemberQuestionEmailQuestion
  /** Adresse absolue de la question dans le back-office du bureau. */
  questionUrl: string
  /** Locale explicite : l'email part d'une Server Action (s03). */
  locale: SupportedLocale
}

/** Objet : 60 caracteres au plus, pre-en-tete : 90 (design system §5.6). */
export const MEMBER_QUESTION_SUBJECT_MAX_LENGTH =
  CONTACT_MESSAGE_SUBJECT_MAX_LENGTH
export const MEMBER_QUESTION_PREVIEW_MAX_LENGTH =
  CONTACT_MESSAGE_PREVIEW_MAX_LENGTH

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
 * Email d'avertissement au bureau d'une question posee par un membre depuis
 * son espace (s23), sur le patron de `ContactMessageMail` (design system §5) :
 * 600 px, tables, styles en ligne, couleurs de `theme.ts` seulement, jumelles
 * sombres. Pied de page de la notification interne (§5.4). L'email du membre
 * est en `mailto:` : c'est par lui que le bureau repond.
 */
export default async function MemberQuestionMail({
  association,
  question,
  questionUrl,
  locale,
}: MemberQuestionMailProps) {
  const t = await getTranslations({
    locale,
    namespace: 'email.question.notification',
  })
  const accent = getEmailAccent(association.hue)
  const receivedAt = receivedAtPartsOf(question.createdAt, locale)
  const preview = fitToLength(
    t('preview', {
      member: question.memberName,
      category: question.categoryName,
    }),
    MEMBER_QUESTION_PREVIEW_MAX_LENGTH
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
                <DetailRow label={t('labels.category')}>
                  {question.categoryName}
                </DetailRow>
                <DetailRow label={t('labels.member')}>
                  {question.memberName}
                </DetailRow>
                <DetailRow label={t('labels.email')}>
                  {question.memberEmail ? (
                    <Link
                      href={`mailto:${question.memberEmail}`}
                      className={c.link}
                      style={{color: EMAIL_COLORS.link}}
                    >
                      {question.memberEmail}
                    </Link>
                  ) : (
                    <span
                      className={c.textMuted}
                      style={{color: EMAIL_COLORS.mutedForeground}}
                    >
                      {t('noEmail')}
                    </span>
                  )}
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
              {t('labels.question')}
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
                    <MultilineText text={question.body} />
                  </td>
                </tr>
              </tbody>
            </table>

            <ActionButton url={questionUrl} label={t('action')} />
            <Text
              className={c.text}
              style={{
                ...paragraphStyle,
                textAlign: 'center',
                fontSize: '15px',
                wordBreak: 'break-all',
              }}
            >
              {t('urlIntro')}{' '}
              <Link
                href={questionUrl}
                className={c.link}
                style={{color: EMAIL_COLORS.link}}
              >
                {questionUrl}
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
              {question.memberEmail
                ? t('reply', {email: question.memberEmail})
                : t('replyWithoutEmail')}
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

/** Les retours a la ligne du membre, conserves en `<br>`. */
function MultilineText({text}: {text: string}) {
  const lines = text.split(/\r?\n/)
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
  association: MemberQuestionEmailAssociation
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
