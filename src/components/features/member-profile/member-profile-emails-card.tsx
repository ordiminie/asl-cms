'use client'

import {CircleCheck, Plus} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {
  MemberProfileDTO,
  MemberProfileEmailChange,
  MemberProfileEmailDTO,
} from '@/services/types/domain/member-profile-types'

import {dayOfInstant, shortDayOfInstant} from './member-email-format'
import {BoardRoleBadge} from './member-profile-badges'
import {DetailCard} from './member-profile-detail-card'
import {
  AddEmailDialog,
  ManageEmailDialog,
  RemoveEmailDialog,
} from './member-profile-email-dialogs'
import type {MemberProfileEmailActions} from './member-profile-email-validation'
import {memberProfilePathOf} from './member-profile-paths'

type MemberProfileEmailsCardProps = MemberProfileEmailActions & {
  profile: Pick<MemberProfileDTO, 'id' | 'name' | 'emails'>
}

type Saved = {change: MemberProfileEmailChange; email: string}

const DATA_CLASS = 'font-mono font-medium break-all'

/**
 * Carte « Adresses email » de la fiche (s54, ecran 4) : une ligne par
 * adresse, son role sur cette fiche, son origine et son statut ; une seule
 * action par ligne, « Gerer ». Tableau a partir de 640 px, cartes empilees
 * en dessous. Aucun identifiant d'adresse dans le DOM : les fenetres
 * retrouvent l'adresse par sa position, l'action l'envoie en `FormData`.
 */
export function MemberProfileEmailsCard({
  profile,
  ...actions
}: MemberProfileEmailsCardProps) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')
  const [saved, setSaved] = useState<Saved | null>(null)
  const [adding, setAdding] = useState(false)
  const [managed, setManaged] = useState<number | null>(null)
  const [removed, setRemoved] = useState<number | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const emails = profile.emails

  useEffect(() => {
    if (saved) noticeRef.current?.focus()
  }, [saved])

  const onSaved = (result: Saved) => {
    setAdding(false)
    setManaged(null)
    setRemoved(null)
    setSaved(result)
  }

  return (
    <DetailCard title={t('title')}>
      {saved && (
        <Alert
          ref={noticeRef}
          tabIndex={-1}
          role="status"
          className="[&>svg]:size-5"
        >
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t(`saved.${saved.change}`, {email: saved.email})}
          </AlertDescription>
        </Alert>
      )}

      {emails.length === 0 ? (
        <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <EmailsTable emails={emails} onManage={setManaged} />
          </div>
          <ul className="flex flex-col gap-4 sm:hidden">
            {emails.map((email, index) => (
              <li key={email.email}>
                <EmailCard email={email} onManage={() => setManaged(index)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base sm:h-11 sm:w-auto"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden="true" className="size-5" />
          {t('add')}
        </Button>
      </div>

      <AddEmailDialog
        profileId={profile.id}
        emails={emails}
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={onSaved}
        action={actions.addEmailAction}
      />
      <ManageEmailDialog
        profileId={profile.id}
        emails={emails}
        index={managed}
        onClose={() => setManaged(null)}
        onSaved={onSaved}
        onRemove={(index) => {
          setManaged(null)
          setRemoved(index)
        }}
        updateAction={actions.updateEmailAction}
        designateAction={actions.designateHolderAction}
      />
      <RemoveEmailDialog
        profileId={profile.id}
        emails={emails}
        index={removed}
        onClose={() => setRemoved(null)}
        onSaved={onSaved}
        action={actions.removeEmailAction}
      />
    </DetailCard>
  )
}

function EmailsTable({
  emails,
  onManage,
}: {
  emails: MemberProfileEmailDTO[]
  onManage: (index: number) => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')

  return (
    <Table aria-label={t('title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('columns.address')}</TableHead>
          <TableHead>{t('columns.role')}</TableHead>
          <TableHead>{t('columns.origin')}</TableHead>
          <TableHead>{t('columns.status')}</TableHead>
          <TableHead>{t('columns.action')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.map((email, index) => (
          <TableRow key={email.email} className="h-14 align-top">
            <TableCell className="text-[17px] whitespace-normal">
              <p className={DATA_CLASS}>{email.email}</p>
              <OtherProfiles email={email} />
            </TableCell>
            <TableCell>
              <RoleBadges email={email} />
            </TableCell>
            <TableCell className="text-[17px]">
              {t(`origins.${email.origin}`)}
            </TableCell>
            <TableCell className="text-[17px] whitespace-normal">
              <EmailStatus email={email} />
            </TableCell>
            <TableCell>
              <ManageButton email={email} onClick={() => onManage(index)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EmailCard({
  email,
  onManage,
}: {
  email: MemberProfileEmailDTO
  onManage: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')

  return (
    <Card className="gap-3 px-4 py-4 shadow-none">
      <p className={`${DATA_CLASS} text-lg`}>{email.email}</p>
      <RoleBadges email={email} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.origin')}</dt>
        <dd>{t(`origins.${email.origin}`)}</dd>
        <dt className="text-muted-foreground">{t('columns.status')}</dt>
        <dd>
          <EmailStatus email={email} />
        </dd>
      </dl>
      <OtherProfiles email={email} />
      <ManageButton email={email} onClick={onManage} />
    </Card>
  )
}

/** Le role sur cette fiche, puis le role au bureau du compte (design 4a). */
function RoleBadges({email}: {email: MemberProfileEmailDTO}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={email.role === 'holder' ? 'default' : 'outline'}>
        {t(`roles.${email.role}`)}
      </Badge>
      {email.boardRole && <BoardRoleBadge role={email.boardRole} />}
    </span>
  )
}

/**
 * « Active » en texte, avec l'etat de son invitation en dessous (s42a) ;
 * l'attente en badge, avec son auteur et son echeance.
 */
function EmailStatus({email}: {email: MemberProfileEmailDTO}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')

  if (email.status === 'active') {
    return (
      <span className="flex flex-col gap-1">
        <span>{t('statuses.active')}</span>
        {email.invitation && (
          <span className="text-muted-foreground text-[15px]">
            {email.invitation.at
              ? t(`invitation.${email.invitation.state}`, {
                  date: dayOfInstant(email.invitation.at),
                })
              : t('invitation.never')}
          </span>
        )}
      </span>
    )
  }
  const date = email.expiresAt ? shortDayOfInstant(email.expiresAt) : ''
  return (
    <span className="flex flex-col gap-1">
      <Badge variant="outline">{t('statuses.pending')}</Badge>
      <span className="text-muted-foreground text-[15px]">
        {email.addedByName
          ? t('pendingBy', {name: email.addedByName, date})
          : t('pendingUntil', {date})}
      </span>
    </span>
  )
}

/** « Se connecte aussi a : » les autres fiches du compte de l'adresse (s53). */
function OtherProfiles({email}: {email: MemberProfileEmailDTO}) {
  const t = useTranslations('BureauMemberProfilesPage')

  if (email.otherProfiles.length === 0) return null
  return (
    <p className="text-muted-foreground text-[15px]">
      {t('detail.emails.alsoConnects')}{' '}
      {email.otherProfiles.map((other, index) => (
        <span key={other.id}>
          {index > 0 && ' · '}
          <Link
            href={memberProfilePathOf(other.id)}
            className="text-foreground underline underline-offset-4"
          >
            {t('emailShared.profile', {
              name: other.name,
              count: other.parcelNumbers.length,
              numbers: joinParcelNumbers(other.parcelNumbers),
            })}
          </Link>
        </span>
      ))}
    </p>
  )
}

function ManageButton({
  email,
  onClick,
}: {
  email: MemberProfileEmailDTO
  onClick: () => void
}) {
  const t = useTranslations('BureauMemberProfilesPage.detail.emails')

  return (
    <Button
      type="button"
      variant="link"
      className="h-11 px-0 text-base"
      aria-label={t('manageLabel', {email: email.email})}
      onClick={onClick}
    >
      {t('manage')}
    </Button>
  )
}
