import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {cn} from '@/lib/utils'
import type {
  CampaignDTO,
  CampaignListPageDTO,
} from '@/services/types/domain/campaign-types'

import {sentAtPartsOf} from './campaign-format'
import {
  campaignPathOf,
  campaignsListPathOf,
  NEW_CAMPAIGN_PATH,
} from './campaign-paths'
import {CampaignStateBadge} from './campaign-state-badges'

type CampaignListProps = {list: CampaignListPageDTO}

/**
 * L'archive des campagnes (ecran 1 du design s25, ecran 3 de s26) : la plus
 * recente d'abord, 25 par page. Un tableau en desktop, des cartes empilees
 * sous 640 px (§3.5), la meme pagination serveur. Une campagne que tous n'ont
 * pas encore recue montre « n sur N » ; l'etat se lit sur son badge.
 */
export function CampaignList({list}: CampaignListProps) {
  const t = useTranslations('CampaignsBureau')
  const isEmpty = list.total === 0

  return (
    <CampaignListFrame showWrite={!isEmpty}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <Table>
                <CampaignsTableHeader />
                <TableBody>
                  {list.items.map((campaign) => (
                    <CampaignRow key={campaign.id} campaign={campaign} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.items.map((campaign) => (
              <li key={campaign.id}>
                <CampaignCard campaign={campaign} />
              </li>
            ))}
          </ul>
          {list.totalPages > 1 && (
            <Pagination list={list} label={t('pagination.label')} />
          )}
        </>
      )}
    </CampaignListFrame>
  )
}

function CampaignListFrame({
  showWrite,
  children,
}: {
  showWrite: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('CampaignsBureau')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[34px] leading-tight font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-[15px]">
            {t('description')}
          </p>
        </div>
        {showWrite && (
          <Button asChild className="h-14 w-full sm:h-11 sm:w-auto">
            <Link href={NEW_CAMPAIGN_PATH}>{t('write')}</Link>
          </Button>
        )}
      </div>
      {children}
    </div>
  )
}

function useSentAtLabel() {
  const t = useTranslations('CampaignsBureau')
  return (campaign: CampaignDTO) =>
    t('sentAt', sentAtPartsOf(campaign.createdAt))
}

function useRecipientsLabel() {
  const t = useTranslations('CampaignsBureau')
  return (campaign: CampaignDTO) =>
    campaign.recipientCounts.received === campaign.recipientCount
      ? String(campaign.recipientCount)
      : t('receivedOutOf', {
          received: campaign.recipientCounts.received,
          total: campaign.recipientCount,
        })
}

function CampaignRow({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau')
  const sentAt = useSentAtLabel()
  const recipients = useRecipientsLabel()

  return (
    <TableRow className="h-14">
      <TableCell className="px-4 text-[17px] font-semibold whitespace-normal">
        {campaign.subject}
      </TableCell>
      <TableCell className="text-[17px] tabular-nums">
        {sentAt(campaign)}
      </TableCell>
      <TableCell className="text-[17px]">
        {campaign.authorName ?? t('unknownAuthor')}
      </TableCell>
      <TableCell className="text-[17px]">
        {t(`templateNames.${campaign.templateId ?? 'free'}`)}
      </TableCell>
      <TableCell className="font-mono text-[17px] tabular-nums">
        {recipients(campaign)}
      </TableCell>
      <TableCell>
        <CampaignStateBadge state={campaign.displayState} />
      </TableCell>
      <TableCell>
        <OpenCampaign id={campaign.id} className="h-11" />
      </TableCell>
    </TableRow>
  )
}

function CampaignCard({campaign}: {campaign: CampaignDTO}) {
  const t = useTranslations('CampaignsBureau')
  const sentAt = useSentAtLabel()
  const recipients = useRecipientsLabel()

  return (
    <Card data-testid="campaign-card" className="gap-3 px-4 py-4 shadow-none">
      <h2 className="text-lg leading-snug font-semibold">{campaign.subject}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.sentAt')}</dt>
        <dd className="tabular-nums">{sentAt(campaign)}</dd>
        <dt className="text-muted-foreground">{t('columns.author')}</dt>
        <dd>{campaign.authorName ?? t('unknownAuthor')}</dd>
        <dt className="text-muted-foreground">{t('columns.template')}</dt>
        <dd>{t(`templateNames.${campaign.templateId ?? 'free'}`)}</dd>
        <dt className="text-muted-foreground">{t('columns.recipients')}</dt>
        <dd className="font-mono tabular-nums">{recipients(campaign)}</dd>
        <dt className="text-muted-foreground">{t('columns.state')}</dt>
        <dd>
          <CampaignStateBadge state={campaign.displayState} />
        </dd>
      </dl>
      <OpenCampaign id={campaign.id} className="h-14 w-full" />
    </Card>
  )
}

function OpenCampaign({id, className}: {id: string; className?: string}) {
  const t = useTranslations('CampaignsBureau')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={campaignPathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

function EmptyState() {
  const t = useTranslations('CampaignsBureau')

  return (
    <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
      <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      <Button asChild className="h-14 w-full sm:h-11 sm:w-auto">
        <Link href={NEW_CAMPAIGN_PATH}>{t('writeFirst')}</Link>
      </Button>
    </Card>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste.
 */
function Pagination({list, label}: {list: CampaignListPageDTO; label: string}) {
  const t = useTranslations('CampaignsBureau.pagination')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={label}
    >
      <CampaignPageLink
        href={campaignsListPathOf(list.page - 1)}
        disabled={list.page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('position', {page: list.page, total: list.totalPages})}
      </span>
      <CampaignPageLink
        href={campaignsListPathOf(list.page + 1)}
        disabled={list.page >= list.totalPages}
        label={t('next')}
      />
    </nav>
  )
}

/** Un lien de page ; desactive, il reste un bouton annonce (`aria-disabled`). */
export function CampaignPageLink({
  href,
  disabled,
  label,
}: {
  href: string
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-14 sm:h-11"
        disabled
        aria-disabled="true"
      >
        {label}
      </Button>
    )
  }

  return (
    <Button asChild variant="outline" className="h-14 sm:h-11">
      <Link href={href}>{label}</Link>
    </Button>
  )
}

const CAMPAIGN_COLUMNS = [
  'subject',
  'sentAt',
  'author',
  'template',
  'recipients',
  'state',
  'action',
] as const

const SKELETON_ROWS = 4

function CampaignsTableHeader() {
  const t = useTranslations('CampaignsBureau.columns')

  return (
    <TableHeader>
      <TableRow>
        {CAMPAIGN_COLUMNS.map((column, index) => (
          <TableHead key={column} className={cn(index === 0 && 'px-4')}>
            {t(column)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/** Chargement de l'archive (etat c) : l'en-tete en place, les lignes en `skeleton`. */
export function CampaignListSkeleton() {
  const rows = Array.from({length: SKELETON_ROWS}, (_, index) => index)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Card className="hidden py-0 shadow-none sm:block">
        <CardContent className="px-0">
          <Table>
            <CampaignsTableHeader />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row} className="h-14">
                  {CAMPAIGN_COLUMNS.map((column, index) => (
                    <TableCell
                      key={column}
                      className={cn(index === 0 && 'px-4')}
                    >
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4 sm:hidden">
        {rows.map((row) => (
          <Skeleton key={row} className="h-32 w-full" />
        ))}
      </div>
    </div>
  )
}

/** L'archive n'a pas pu etre lue (etat d) : rien n'est perdu. */
export function CampaignListError() {
  const t = useTranslations('CampaignsBureau')

  return (
    <CampaignListFrame showWrite>
      <Alert variant="destructive" className="border-2">
        <AlertTriangle aria-hidden="true" />
        <AlertDescription className="text-[17px]">
          {t('loadFailed')}
        </AlertDescription>
      </Alert>
    </CampaignListFrame>
  )
}
