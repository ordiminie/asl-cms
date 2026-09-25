import {AlertTriangle} from 'lucide-react'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'

import {Badge} from '@/components/ui/badge'
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
import {
  type ContactMessageDTO,
  type ContactMessageListPageDTO,
  receivedAtPartsOf,
} from '@/services/types/domain/contact-message-types'

const LIST_PATH = '/bureau/messages'

const messagePathOf = (id: string) => `${LIST_PATH}/${id}`

/**
 * Liste des messages recus (ecran 2 du design s08) : triee par date
 * decroissante par le service, sans tri par colonne ni creation. Un tableau
 * en desktop, des cartes empilees sous 640 px (§3.5), les deux dans l'ordre
 * des colonnes.
 */
export function ContactMessageList({list}: {list: ContactMessageListPageDTO}) {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          {t('unread', {count: list.unreadCount})}
        </p>
      </div>

      {list.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <MessagesTable items={list.items} />
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.items.map((item) => (
              <li key={item.id}>
                <MessageCard item={item} />
              </li>
            ))}
          </ul>
          <Pagination page={list.page} totalPages={list.totalPages} />
        </>
      )}
    </div>
  )
}

function MessagesTable({items}: {items: ContactMessageDTO[]}) {
  return (
    <Table>
      <MessagesTableHeader />
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="h-14">
            <TableCell
              className={cn('px-4 text-[17px]', !item.read && 'font-semibold')}
            >
              {item.subject}
            </TableCell>
            <TableCell>
              <Sender item={item} />
            </TableCell>
            <TableCell>
              <ReceivedOn createdAt={item.createdAt} />
            </TableCell>
            <TableCell>
              <StatusBadges item={item} />
            </TableCell>
            <TableCell>
              <OpenMessage id={item.id} className="h-11" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MessageCard({item}: {item: ContactMessageDTO}) {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <Card
      data-testid="contact-message-card"
      className="gap-3 px-4 py-4 shadow-none"
    >
      <h2
        className={cn(
          'text-lg leading-snug',
          item.read ? 'font-medium' : 'font-semibold'
        )}
      >
        {item.subject}
      </h2>
      <StatusBadges item={item} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.from')}</dt>
        <dd>
          <Sender item={item} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.receivedAt')}</dt>
        <dd>
          <ReceivedOn createdAt={item.createdAt} />
        </dd>
      </dl>
      <OpenMessage id={item.id} className="h-14 w-full" />
    </Card>
  )
}

/** Le nom puis l'adresse en `meta` ; sans nom, l'adresse seule. */
function Sender({item}: {item: ContactMessageDTO}) {
  if (!item.senderName) {
    return <span className="break-all">{item.senderEmail}</span>
  }

  return (
    <>
      <div>{item.senderName}</div>
      <div className="text-muted-foreground text-[15px] break-all">
        {item.senderEmail}
      </div>
    </>
  )
}

function ReceivedOn({createdAt}: {createdAt: Date}) {
  const locale = useLocale()

  return (
    <span className="font-mono tabular-nums">
      {receivedAtPartsOf(createdAt, locale).shortDate}
    </span>
  )
}

/**
 * Les deux badges sur une seule ligne, `gap` 8 px, retour a la ligne permis
 * (§3.9) : l'etat de lecture a son point **et** son libelle ecrit.
 */
function StatusBadges({item}: {item: ContactMessageDTO}) {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 rounded-full',
            item.read ? 'bg-muted-foreground' : 'bg-primary'
          )}
        />
        {item.read ? t('status.read') : t('status.unread')}
      </Badge>
      {item.notificationFailed && (
        <Badge variant="outline" className="text-destructive-text gap-1.5">
          <AlertTriangle
            aria-hidden="true"
            className="size-4"
            strokeWidth={1.75}
          />
          {t('status.notificationFailed')}
        </Badge>
      )}
    </div>
  )
}

function OpenMessage({id, className}: {id: string; className?: string}) {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={messagePathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

function EmptyState() {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
      <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full sm:h-11 sm:w-auto"
      >
        <Link href="/contact">{t('emptyAction')}</Link>
      </Button>
    </Card>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste.
 */
function Pagination({page, totalPages}: {page: number; totalPages: number}) {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('title')}
    >
      <PageLink
        page={page - 1}
        disabled={page <= 1}
        label={t('pagination.previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('pagination.position', {page, total: totalPages})}
      </span>
      <PageLink
        page={page + 1}
        disabled={page >= totalPages}
        label={t('pagination.next')}
      />
    </nav>
  )
}

function PageLink({
  page,
  disabled,
  label,
}: {
  page: number
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
      <Link href={`${LIST_PATH}?page=${page}`}>{label}</Link>
    </Button>
  )
}

const MESSAGE_COLUMNS = [
  'subject',
  'from',
  'receivedAt',
  'status',
  'action',
] as const

const SKELETON_ROWS = 4

function MessagesTableHeader() {
  const t = useTranslations('BureauContactMessagesPage')

  return (
    <TableHeader>
      <TableRow>
        {MESSAGE_COLUMNS.map((column, index) => (
          <TableHead key={column} className={cn(index === 0 && 'px-4')}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/**
 * Chargement de la liste (ecran 2 du design s08) : l'en-tete du tableau est
 * deja en place, seules les lignes sont en `skeleton` (§3.2).
 */
export function ContactMessageListSkeleton() {
  const rows = Array.from({length: SKELETON_ROWS}, (_, index) => index)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Card className="hidden py-0 shadow-none sm:block">
        <CardContent className="px-0">
          <Table>
            <MessagesTableHeader />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row} className="h-14">
                  {MESSAGE_COLUMNS.map((column, index) => (
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
