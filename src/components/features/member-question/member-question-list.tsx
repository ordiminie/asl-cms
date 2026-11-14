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
import {receivedAtPartsOf} from '@/services/types/domain/contact-message-types'
import type {
  MemberQuestionDTO,
  MemberQuestionListPageDTO,
} from '@/services/types/domain/member-question-types'

import {
  MEMBER_QUESTION_CATEGORIES_PATH,
  MEMBER_QUESTIONS_PATH,
  memberQuestionPathOf,
} from './member-question-paths'

/**
 * « Questions des membres » (s23, ecran C1) : la plus recente d'abord, triee
 * par le service. Un tableau en desktop, des cartes empilees sous 640 px
 * (§3.5), les deux dans l'ordre des colonnes. L'identite du membre et le
 * sujet sont lus par jointure (critere 4) ; un sujet supprime garde son nom
 * (critere 5).
 */
export function MemberQuestionList({list}: {list: MemberQuestionListPageDTO}) {
  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <ListHeader />

      {list.items.length === 0 ? (
        <EmptyState hasOpenCategories={list.hasOpenCategories} />
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <QuestionsTable items={list.items} />
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.items.map((item) => (
              <li key={item.id}>
                <QuestionCard item={item} />
              </li>
            ))}
          </ul>
          <Pagination page={list.page} totalPages={list.totalPages} />
        </>
      )}
    </div>
  )
}

function ListHeader() {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full text-base sm:h-11 sm:w-auto"
      >
        <Link href={MEMBER_QUESTION_CATEGORIES_PATH}>
          {t('manageCategories')}
        </Link>
      </Button>
    </div>
  )
}

function QuestionsTable({items}: {items: MemberQuestionDTO[]}) {
  return (
    <Table>
      <QuestionsTableHeader />
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="h-14">
            <TableCell className="px-4 align-top">
              <ReceivedOn createdAt={item.createdAt} />
            </TableCell>
            <TableCell className="align-top">
              <Member item={item} />
            </TableCell>
            <TableCell className="align-top text-[17px]">
              <CategoryName item={item} />
            </TableCell>
            <TableCell className="max-w-80 align-top">
              <div className="flex flex-col gap-1">
                {item.notificationFailed && <NotificationFailedBadge />}
                <span className="truncate text-[17px]">{item.body}</span>
              </div>
            </TableCell>
            <TableCell className="align-top">
              <OpenQuestion id={item.id} className="h-11" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function QuestionCard({item}: {item: MemberQuestionDTO}) {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <Card
      data-testid="member-question-card"
      className="gap-3 px-4 py-4 shadow-none"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg leading-snug font-semibold">
          {item.memberName}
        </h2>
        {item.notificationFailed && <NotificationFailedBadge />}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.receivedAt')}</dt>
        <dd>
          <ReceivedOn createdAt={item.createdAt} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.category')}</dt>
        <dd>
          <CategoryName item={item} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.question')}</dt>
        <dd className="line-clamp-2">{item.body}</dd>
      </dl>
      <Button asChild variant="outline" className="h-14 w-full">
        <Link href={memberQuestionPathOf(item.id)}>{t('openCard')}</Link>
      </Button>
    </Card>
  )
}

/** Le nom en `body-strong`, l'adresse en `meta`, ou son absence dite. */
function Member({item}: {item: MemberQuestionDTO}) {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <>
      <div className="text-[17px] font-semibold">{item.memberName}</div>
      <div className="text-muted-foreground text-[15px] break-all">
        {item.memberEmail ?? t('noEmail')}
      </div>
    </>
  )
}

/** Le nom du sujet, suivi de « catégorie supprimée » s'il l'a ete. */
export function CategoryName({
  item,
}: {
  item: Pick<MemberQuestionDTO, 'categoryName' | 'categoryDeleted'>
}) {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <>
      {item.categoryName}
      {item.categoryDeleted && (
        <span className="text-muted-foreground text-[15px]">
          {' '}
          {t('categoryDeleted')}
        </span>
      )}
    </>
  )
}

export function NotificationFailedBadge() {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <Badge variant="destructive" className="self-start text-[15px]">
      {t('notificationFailed')}
    </Badge>
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

function OpenQuestion({id, className}: {id: string; className?: string}) {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={memberQuestionPathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

/** C3 : ce qui manque, et l'action quand aucun sujet n'est ouvert. */
function EmptyState({hasOpenCategories}: {hasOpenCategories: boolean}) {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
      <p className="text-muted-foreground text-[17px]">
        {hasOpenCategories ? t('empty') : t('emptyNoCategories')}
      </p>
      {!hasOpenCategories && (
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          <Link href={MEMBER_QUESTION_CATEGORIES_PATH}>{t('emptyAction')}</Link>
        </Button>
      )}
    </Card>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste.
 */
function Pagination({page, totalPages}: {page: number; totalPages: number}) {
  const t = useTranslations('BureauMemberQuestionsPage')

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
      <Link href={`${MEMBER_QUESTIONS_PATH}?page=${page}`}>{label}</Link>
    </Button>
  )
}

const QUESTION_COLUMNS = [
  'receivedAt',
  'member',
  'category',
  'question',
  'action',
] as const

const SKELETON_ROWS = 4

function QuestionsTableHeader() {
  const t = useTranslations('BureauMemberQuestionsPage')

  return (
    <TableHeader>
      <TableRow>
        {QUESTION_COLUMNS.map((column, index) => (
          <TableHead key={column} className={cn(index === 0 && 'px-4')}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/** Chargement (C3) : l'en-tete du tableau en place, les lignes en `skeleton`. */
export function MemberQuestionListSkeleton() {
  const rows = Array.from({length: SKELETON_ROWS}, (_, index) => index)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <ListHeader />
      <Card className="hidden py-0 shadow-none sm:block">
        <CardContent className="px-0">
          <Table>
            <QuestionsTableHeader />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row} className="h-14">
                  {QUESTION_COLUMNS.map((column, index) => (
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
