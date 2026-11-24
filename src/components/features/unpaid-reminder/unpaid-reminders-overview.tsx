import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Badge} from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {Card} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  UnpaidReminderMemberDTO,
  UnpaidReminderMembersPageDTO,
  UnpaidReminderRankDTO,
  UnpaidReminderScheduleDTO,
  UnpaidRemindersOverviewDTO,
} from '@/services/types/domain/unpaid-reminder-types'

import {settingsSectionPathOf} from '../association/association-settings-paths'
import {dayLabelOf, shortDayLabelOf} from '../campaigns/campaign-format'
import {CampaignPageLink} from '../campaigns/campaign-list'
import {
  campaignLettersCardPathOf,
  campaignPathOf,
} from '../campaigns/campaign-paths'
import {CampaignStateBadge} from '../campaigns/campaign-state-badges'
import {memberProfilePathOf} from '../member-profile/member-profile-paths'

/** La page de suivi des relances du bureau (s29). */
export const UNPAID_REMINDERS_PATH = '/bureau/relances'

/** La carte « Relances des impayes » des reglages : les liens du bandeau. */
const REMINDER_SETTINGS_PATH = settingsSectionPathOf('reminder')

const pagePathOf = (page: number): string =>
  page > 1 ? `${UNPAID_REMINDERS_PATH}?page=${page}` : UNPAID_REMINDERS_PATH

type ReadyOverview = Extract<UnpaidRemindersOverviewDTO, {status: 'ready'}>

/** Titre, phrase et fil d'Ariane, communs a tous les etats de l'ecran 1. */
function UnpaidRemindersFrame({children}: {children: ReactNode}) {
  const t = useTranslations('UnpaidRemindersBureau')

  return (
    <div className="flex w-full max-w-240 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList className="text-[15px]">
            <BreadcrumbItem>{t('breadcrumb.association')}</BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t('breadcrumb.current')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('title')}
        </h1>
        <p className="text-muted-foreground max-w-[68ch] text-[17px]">
          {t('intro')}
        </p>
      </div>
      {children}
    </div>
  )
}

function SettingsLink({label}: {label: string}) {
  return (
    <Link
      href={REMINDER_SETTINGS_PATH}
      className="text-link inline-flex min-h-11 items-center underline"
    >
      {label}
    </Link>
  )
}

/**
 * Le bandeau d'etat : activee, une annonce de l'avenir (`muted`, sans icone,
 * §3.13), les durees lues dans les reglages ; desactivee, `warning`.
 */
function StateBanner({overview}: {overview: ReadyOverview}) {
  const t = useTranslations('UnpaidRemindersBureau.banner')
  const [first, second, third] = overview.delaysWeeks ?? []

  if (overview.enabled) {
    return (
      <Alert role="status" className="bg-muted">
        <AlertDescription className="text-foreground text-[17px]">
          <p>{t('enabled', {first, second, third})}</p>
          <SettingsLink label={t('enabledLink')} />
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert
      role="status"
      className="border-warning-border bg-warning text-warning-foreground [&>svg]:size-5"
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-warning-foreground text-[17px]">
        <p>{t('disabled')}</p>
        <SettingsLink label={t('disabledLink')} />
      </AlertDescription>
    </Alert>
  )
}

function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[20px] leading-snug font-semibold">
      {children}
    </h2>
  )
}

/** L'etat d'un rang : celui de sa campagne, sinon son jour prevu (§3.13). */
function RankStateBadge({rank}: {rank: UnpaidReminderRankDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.schedule')

  if (rank.status === 'created') {
    return <CampaignStateBadge state={rank.displayState} />
  }
  if (rank.status === 'not_scheduled') {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[15px]">
        {t('notScheduled')}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-[15px]">
      {rank.status === 'scheduled'
        ? t('scheduled', {date: shortDayLabelOf(rank.day)})
        : t('upcoming')}
    </Badge>
  )
}

/** Une ligne du plan ecrit : le rang, son jour, son etat, ses liens. */
function RankLine({rank}: {rank: UnpaidReminderRankDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.schedule')

  return (
    <li className="border-border flex flex-col gap-1 border-l-2 pl-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[17px] font-semibold">
          {t('rank', {rank: rank.rank, date: dayLabelOf(rank.day)})}
        </span>
        <RankStateBadge rank={rank} />
      </div>
      {rank.status === 'created' && (
        <>
          <p className="text-muted-foreground font-mono text-[15px] tabular-nums">
            {rank.deferredUntil
              ? t('deferred', {
                  received: rank.receivedCount,
                  deferred: rank.deferredCount,
                  date: shortDayLabelOf(rank.deferredUntil),
                })
              : t('meta', {
                  recipients: rank.recipientCount,
                  letters: rank.letterCount,
                })}
          </p>
          <div className="flex flex-wrap gap-x-4">
            <Link
              href={campaignPathOf(rank.campaignId)}
              className="text-link inline-flex min-h-11 items-center underline"
            >
              {t('viewSend')}
            </Link>
            {rank.letterCount > 0 && (
              <Link
                href={campaignLettersCardPathOf(rank.campaignId)}
                className="text-link inline-flex min-h-11 items-center underline"
              >
                {t('letters', {count: rank.letterCount})}
              </Link>
            )}
          </div>
        </>
      )}
    </li>
  )
}

/** Le calendrier d'une echeance (§3.13 : plan ecrit, ni calendrier ni frise). */
function ScheduleCard({schedule}: {schedule: UnpaidReminderScheduleDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.schedule')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>
        {t('title', {date: dayLabelOf(schedule.dueOn)})}
      </CardHeading>
      <ul className="flex flex-col gap-4">
        {schedule.ranks.map((rank) => (
          <RankLine key={rank.rank} rank={rank} />
        ))}
      </ul>
    </Card>
  )
}

/** Le compteur (§3.13) : impayes, par email, par courrier. */
function Counter({counts}: {counts: ReadyOverview['counts']}) {
  const t = useTranslations('UnpaidRemindersBureau.counter')
  const pairs: [string, number][] = [
    [t('unpaid'), counts.unpaid],
    [t('byEmail'), counts.byEmail],
    [t('byLetter'), counts.byLetter],
  ]

  return (
    <dl
      data-testid="unpaid-counter"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4"
    >
      {pairs.map(([term, value]) => (
        <div
          key={term}
          className="flex flex-row justify-between gap-1 sm:flex-col"
        >
          <dt className="text-muted-foreground text-[15px]">{term}</dt>
          <dd className="font-mono text-[17px] font-medium tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MemberLink({member}: {member: UnpaidReminderMemberDTO}) {
  return (
    <Link href={memberProfilePathOf(member.id)} className="underline">
      {member.name}
    </Link>
  )
}

/** La colonne Facture : une ligne par facture, son echeance en `meta`. */
function Invoices({member}: {member: UnpaidReminderMemberDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.table')

  return (
    <ul className="flex flex-col gap-1">
      {member.invoices.map((invoice, index) => (
        <li key={`${invoice.issuedOn}-${invoice.parcelNumber ?? index}`}>
          <span className="font-mono tabular-nums">
            {dayLabelOf(invoice.issuedOn)}
          </span>
          <span className="text-muted-foreground block text-[15px]">
            {t('due', {date: dayLabelOf(invoice.dueOn)})}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** La colonne Relances : « 2 sur 3 », puis les dates ; « Aucune » avant. */
function Reminders({
  member,
  rankCount,
}: {
  member: UnpaidReminderMemberDTO
  rankCount: number
}) {
  const t = useTranslations('UnpaidRemindersBureau.table')

  if (member.reminders.length === 0) {
    return <span className="text-muted-foreground">{t('noReminder')}</span>
  }
  return (
    <>
      <span className="font-mono tabular-nums">
        {t('remindersCount', {
          count: member.reminders.length,
          total: rankCount,
        })}
      </span>
      <span className="text-muted-foreground block font-mono text-[15px] tabular-nums">
        {member.reminders
          .map((reminder) => shortDayLabelOf(reminder.day))
          .join(' · ')}
      </span>
    </>
  )
}

/** La colonne Envoi : « Email », ou le badge « Courrier » (critere 10). */
function Channel({member}: {member: UnpaidReminderMemberDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.table.channels')

  if (member.channel === 'letter') {
    return (
      <Badge variant="outline" className="text-[15px]">
        {t('letter')}
      </Badge>
    )
  }
  return <span>{t('email')}</span>
}

function MembersTable({
  members,
  rankCount,
}: {
  members: readonly UnpaidReminderMemberDTO[]
  rankCount: number
}) {
  const t = useTranslations('UnpaidRemindersBureau.table.columns')

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('member')}</TableHead>
            <TableHead>{t('parcel')}</TableHead>
            <TableHead>{t('invoice')}</TableHead>
            <TableHead>{t('reminders')}</TableHead>
            <TableHead>{t('channel')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id} className="align-top">
              <TableCell className="min-w-48 text-[17px] font-semibold whitespace-normal">
                <MemberLink member={member} />
              </TableCell>
              <TableCell className="font-mono text-[17px] whitespace-normal tabular-nums">
                {member.parcelNumbers.join(', ')}
              </TableCell>
              <TableCell className="text-[17px]">
                <Invoices member={member} />
              </TableCell>
              <TableCell className="text-[17px]">
                <Reminders member={member} rankCount={rankCount} />
              </TableCell>
              <TableCell className="text-[17px]">
                <Channel member={member} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Sous 640 px : cartes empilees (§3.5), le nom en tete. */
function MembersCards({
  members,
  rankCount,
}: {
  members: readonly UnpaidReminderMemberDTO[]
  rankCount: number
}) {
  const t = useTranslations('UnpaidRemindersBureau.table.columns')

  return (
    <ul className="flex flex-col gap-3 sm:hidden">
      {members.map((member) => (
        <li
          key={member.id}
          data-testid="unpaid-member-card"
          className="border-border flex flex-col gap-2 rounded-lg border p-4"
        >
          <h3 className="text-lg leading-snug font-semibold">
            <MemberLink member={member} />
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
            <dt className="text-muted-foreground">{t('parcel')}</dt>
            <dd className="font-mono tabular-nums">
              {member.parcelNumbers.join(', ')}
            </dd>
            <dt className="text-muted-foreground">{t('invoice')}</dt>
            <dd>
              <Invoices member={member} />
            </dd>
            <dt className="text-muted-foreground">{t('reminders')}</dt>
            <dd>
              <Reminders member={member} rankCount={rankCount} />
            </dd>
            <dt className="text-muted-foreground">{t('channel')}</dt>
            <dd>
              <Channel member={member} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}

/** Pagination ecrite (§3.13), a 25 lignes. */
function MembersPagination({page}: {page: UnpaidReminderMembersPageDTO}) {
  const t = useTranslations('UnpaidRemindersBureau.pagination')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('label')}
    >
      <CampaignPageLink
        href={pagePathOf(page.page - 1)}
        disabled={page.page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('position', {
          page: page.page,
          total: page.totalPages,
          count: page.total,
        })}
      </span>
      <CampaignPageLink
        href={pagePathOf(page.page + 1)}
        disabled={page.page >= page.totalPages}
        label={t('next')}
      />
    </nav>
  )
}

/** Le tableau « Impayes » et son compteur ; vide, la file se dit (1c). */
function MembersCard({overview}: {overview: ReadyOverview}) {
  const t = useTranslations('UnpaidRemindersBureau.table')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      {overview.members.total === 0 ? (
        <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <Counter counts={overview.counts} />
          <MembersTable
            members={overview.members.items}
            rankCount={overview.rankCount}
          />
          <MembersCards
            members={overview.members.items}
            rankCount={overview.rankCount}
          />
          <MembersPagination page={overview.members} />
        </>
      )}
    </Card>
  )
}

function DestructiveAlert({message}: {message: string}) {
  return (
    <Alert variant="destructive" className="border-2 [&>svg]:size-5">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="text-[17px]">
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Le suivi des relances (s29, ecran 1). **Aucune action par ligne** : le
 * courrier se genere par rang, depuis la carte de sa campagne (critere 10).
 */
export function UnpaidRemindersOverview({
  overview,
}: {
  overview: UnpaidRemindersOverviewDTO
}) {
  const t = useTranslations('UnpaidRemindersBureau')

  if (overview.status === 'unavailable') {
    return (
      <UnpaidRemindersFrame>
        <DestructiveAlert message={t('banner.unavailable')} />
      </UnpaidRemindersFrame>
    )
  }
  return (
    <UnpaidRemindersFrame>
      <StateBanner overview={overview} />
      {overview.schedules.map((schedule) => (
        <ScheduleCard key={schedule.dueOn} schedule={schedule} />
      ))}
      <MembersCard overview={overview} />
      <p className="text-muted-foreground text-[15px]">{t('footer')}</p>
    </UnpaidRemindersFrame>
  )
}

/** La lecture de la page a echoue : rien n'est perdu, la page se recharge. */
export function UnpaidRemindersError() {
  const t = useTranslations('UnpaidRemindersBureau.banner')

  return (
    <UnpaidRemindersFrame>
      <DestructiveAlert message={t('loadFailed')} />
    </UnpaidRemindersFrame>
  )
}

const SKELETON_ROWS = 3

/** Chargement (1d) : compteur, calendrier et trois lignes en `skeleton`. */
export function UnpaidRemindersSkeleton() {
  const t = useTranslations('UnpaidRemindersBureau')

  return (
    <UnpaidRemindersFrame>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('schedule.loadingTitle')}</CardHeading>
        {Array.from({length: SKELETON_ROWS}, (_, index) => (
          <Skeleton key={index} className="h-10 w-3/5" />
        ))}
      </Card>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('table.title')}</CardHeading>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          {Array.from({length: 3}, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
        {Array.from({length: SKELETON_ROWS}, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </Card>
    </UnpaidRemindersFrame>
  )
}
