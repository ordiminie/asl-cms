import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
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
import {joinParcelNumbers} from '@/services/rules/campaign-rules'
import type {
  MemberInvitationAddressDTO,
  MemberInvitationAddressesPageDTO,
  MemberInvitationOverviewDTO,
  MemberInvitationProfileRefDTO,
  MemberInvitationsPageDTO,
} from '@/services/types/domain/member-invitation-campaign-types'

import {sentAtPartsOf} from '../campaigns/campaign-format'
import {CampaignPageLink} from '../campaigns/campaign-list'
import {memberProfilePathOf} from '../member-profile/member-profile-paths'
import {memberInvitationsPagePathOf} from './member-invitation-paths'
import {
  LaunchCard,
  type LaunchMemberInvitationsAction,
  ReminderCard,
  type RemindNeverSignedInAction,
} from './member-invitation-sending-cards'

const strong = (chunks: ReactNode) => <strong>{chunks}</strong>

/** Titre, phrase et fil d'Ariane, communs a tous les etats des ecrans 1 et 2. */
function MemberInvitationsFrame({children}: {children: ReactNode}) {
  const t = useTranslations('MemberInvitationsBureau')

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

function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[20px] leading-snug font-semibold">
      {children}
    </h2>
  )
}

/** Un compteur (§3.13) : une paire par colonne en bureau, par ligne en mobile. */
function Counter({pairs}: {pairs: [string, number][]}) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
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

/** La carte « Suivi » (ecran 2) : en adresses, puis la couverture en fiches. */
function TrackingCard({overview}: {overview: MemberInvitationOverviewDTO}) {
  const t = useTranslations('MemberInvitationsBureau.tracking')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <Counter
        pairs={[
          [t('invited'), overview.invited],
          [t('signedIn'), overview.signedIn],
          [t('neverSignedIn'), overview.neverSignedIn],
          [t('pending'), overview.pending],
        ]}
      />
      <p className="text-muted-foreground text-[15px]">{t('note')}</p>
      <h3 className="text-[17px] font-semibold">{t('coverageTitle')}</h3>
      <Counter
        pairs={[
          [t('byEmail'), overview.coverage.byEmail],
          [t('byLetter'), overview.coverage.byLetter],
          [t('neither'), overview.coverage.neither],
        ]}
      />
    </Card>
  )
}

function ProfileLinks({
  profiles,
}: {
  profiles: readonly MemberInvitationProfileRefDTO[]
}) {
  const t = useTranslations('MemberInvitationsBureau.addresses')

  return (
    <ul className="flex flex-col gap-1">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <Link
            href={memberProfilePathOf(profile.id)}
            className="font-semibold underline"
          >
            {profile.name}
          </Link>
          <span className="text-muted-foreground block text-[15px]">
            {t('parcels', {
              count: profile.parcelNumbers.length,
              numbers: joinParcelNumbers(profile.parcelNumbers),
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AddressCell({address}: {address: MemberInvitationAddressDTO}) {
  const t = useTranslations('MemberInvitationsBureau.addresses')

  return (
    <>
      <span className="font-mono break-all">{address.email}</span>
      {address.profiles.length > 1 && (
        <span className="text-muted-foreground block text-[15px]">
          {t('shared', {count: address.profiles.length})}
        </span>
      )}
    </>
  )
}

/** L'etat d'une adresse : invitee, jamais invitee, ou en attente (s54). */
function InvitationCell({address}: {address: MemberInvitationAddressDTO}) {
  const t = useTranslations('MemberInvitationsBureau.addresses')

  if (address.pending) {
    return (
      <>
        <Badge
          variant="outline"
          className="border-warning-border bg-warning text-warning-foreground text-[15px]"
        >
          {t('pendingBadge')}
        </Badge>
        <span className="text-muted-foreground block text-[15px]">
          {t('pendingMeta')}
        </span>
      </>
    )
  }
  if (address.lastInvitedAt) {
    return (
      <span>
        {t('invitedOn', {date: sentAtPartsOf(address.lastInvitedAt).date})}
      </span>
    )
  }
  return (
    <>
      <span>{t('neverInvited')}</span>
      <span className="text-muted-foreground block text-[15px]">
        {t('addedOn', {date: sentAtPartsOf(address.addedAt).date})}
      </span>
    </>
  )
}

function AddressesTable({
  items,
}: {
  items: readonly MemberInvitationAddressDTO[]
}) {
  const t = useTranslations('MemberInvitationsBureau.addresses.columns')

  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('address')}</TableHead>
            <TableHead>{t('profile')}</TableHead>
            <TableHead>{t('invitation')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((address) => (
            <TableRow key={address.email} className="align-top">
              <TableCell className="min-w-48 text-[17px] whitespace-normal">
                <AddressCell address={address} />
              </TableCell>
              <TableCell className="text-[17px] whitespace-normal">
                <ProfileLinks profiles={address.profiles} />
              </TableCell>
              <TableCell className="text-[17px] whitespace-normal">
                <InvitationCell address={address} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Sous 640 px : cartes empilees (§3.5), l'adresse en tete. */
function AddressesCards({
  items,
}: {
  items: readonly MemberInvitationAddressDTO[]
}) {
  const t = useTranslations('MemberInvitationsBureau.addresses.columns')

  return (
    <ul className="flex flex-col gap-3 sm:hidden">
      {items.map((address) => (
        <li
          key={address.email}
          className="border-border flex flex-col gap-2 rounded-lg border p-4 text-[17px]"
        >
          <AddressCell address={address} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">{t('profile')}</dt>
            <dd>
              <ProfileLinks profiles={address.profiles} />
            </dd>
            <dt className="text-muted-foreground">{t('invitation')}</dt>
            <dd>
              <InvitationCell address={address} />
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}

function AddressesPagination({page}: {page: MemberInvitationAddressesPageDTO}) {
  const t = useTranslations('MemberInvitationsBureau.addresses.pagination')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('label')}
    >
      <CampaignPageLink
        href={memberInvitationsPagePathOf(page.page - 1)}
        disabled={page.page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('position', {page: page.page, total: page.totalPages})}
      </span>
      <CampaignPageLink
        href={memberInvitationsPagePathOf(page.page + 1)}
        disabled={page.page >= page.totalPages}
        label={t('next')}
      />
    </nav>
  )
}

/**
 * La carte « Adresses jamais connectees » (ecran 2) : une ligne par adresse,
 * toutes ses fiches, un seul etat. **Aucune action par ligne** : relancer est
 * un acte de masse, inviter une personne se fait depuis sa fiche (s42a).
 */
function AddressesCard({page}: {page: MemberInvitationAddressesPageDTO}) {
  const t = useTranslations('MemberInvitationsBureau.addresses')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      {page.total === 0 ? (
        <Alert role="note" className="bg-muted">
          <AlertDescription className="text-foreground text-[17px]">
            <p>{t('empty')}</p>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-muted-foreground text-[15px]" aria-live="polite">
            {t('summary', {total: page.total, pending: page.pendingCount})}
          </p>
          <AddressesTable items={page.items} />
          <AddressesCards items={page.items} />
          {page.totalPages > 1 && <AddressesPagination page={page} />}
        </>
      )}
    </Card>
  )
}

/**
 * Les fiches qui n'ont recu ni email ni courrier (2c, Q3) : rendue seulement
 * pour un lancement facultatif qui en compte au moins une.
 */
function RefusedCard({
  profiles,
}: {
  profiles: readonly MemberInvitationProfileRefDTO[]
}) {
  const t = useTranslations('MemberInvitationsBureau.refused')

  return (
    <Card className="gap-4 px-4 py-6 shadow-none sm:px-6">
      <CardHeading>{t('title')}</CardHeading>
      <Alert role="note" className="bg-muted">
        <AlertDescription className="text-foreground text-[17px]">
          <p>{t.rich('description', {strong, count: profiles.length})}</p>
        </AlertDescription>
      </Alert>
      <div className="border-border border-l-2 pl-3">
        <ProfileLinks profiles={profiles} />
      </div>
    </Card>
  )
}

/**
 * La page « Invitations des membres » (s42b, ecrans 1 et 2) : le lancement,
 * la relance une fois le lancement parti, le suivi par adresse.
 */
export function MemberInvitationsOverview({
  page,
  launchAction,
  remindAction,
}: {
  page: MemberInvitationsPageDTO
  launchAction: LaunchMemberInvitationsAction
  remindAction: RemindNeverSignedInAction
}) {
  const refused =
    page.launch?.campaign.nature === 'facultative' &&
    page.overview.refusedProfiles.length > 0

  return (
    <MemberInvitationsFrame>
      <LaunchCard
        launch={page.launch}
        counts={page.launchCounts}
        plan={page.plan}
        linkDays={page.linkDays}
        launchAction={launchAction}
      />
      {page.launch && (
        <ReminderCard
          launch={page.launch}
          reminders={page.reminders}
          counts={page.reminderCounts}
          plan={page.plan}
          remindAction={remindAction}
        />
      )}
      <TrackingCard overview={page.overview} />
      <AddressesCard page={page.overview.addresses} />
      {refused && <RefusedCard profiles={page.overview.refusedProfiles} />}
    </MemberInvitationsFrame>
  )
}

/** Lecture impossible (1l) : une alerte, jamais un decompte a zero. */
export function MemberInvitationsError() {
  const t = useTranslations('MemberInvitationsBureau.loadFailed')

  return (
    <MemberInvitationsFrame>
      <Alert variant="destructive" className="border-2 [&>svg]:size-5">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle className="text-[17px] whitespace-normal">
          {t('title')}
        </AlertTitle>
        <AlertDescription className="text-[15px]">
          <p>{t('description')}</p>
        </AlertDescription>
      </Alert>
    </MemberInvitationsFrame>
  )
}

const SKELETON_ROWS = 3

/** Chargement (1k, 2e) : decomptes, compteur et trois lignes en `skeleton`. */
export function MemberInvitationsSkeleton() {
  const t = useTranslations('MemberInvitationsBureau')

  return (
    <MemberInvitationsFrame>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('launch.title')}</CardHeading>
        {Array.from({length: SKELETON_ROWS}, (_, index) => (
          <Skeleton key={index} className="h-7 w-full" />
        ))}
      </Card>
      <Card aria-busy="true" className="gap-4 px-4 py-6 shadow-none sm:px-6">
        <CardHeading>{t('tracking.title')}</CardHeading>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-4">
          {Array.from({length: 4}, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
        {Array.from({length: SKELETON_ROWS}, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </Card>
    </MemberInvitationsFrame>
  )
}
