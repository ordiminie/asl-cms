import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
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
  MemberProfileListItemDTO,
  MemberProfilePageDTO,
} from '@/services/types/domain/member-profile-types'

import {IncompleteBadge, MailOnlyBadge} from './member-profile-badges'
import {postalAddressLineOf} from './member-profile-format'
import {
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  memberProfilesListPathOf,
  NEW_MEMBER_PROFILE_PATH,
} from './member-profile-paths'

type MemberProfileListProps = {
  list: MemberProfilePageDTO
  search?: string
}

/**
 * Liste des proprietaires (ecran 1 du design s12) : triee par nom par le
 * service, 25 fiches par page. Un tableau en desktop, des cartes empilees sous
 * 640 px (§3.5), la meme pagination serveur. La recherche voyage dans l'URL.
 */
export function MemberProfileList({list, search}: MemberProfileListProps) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-[34px] leading-tight font-semibold">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-[15px]">
            {t('counts', {
              count: list.profileCount,
              incomplete: list.incompleteCount,
            })}
          </p>
        </div>
        <Button asChild className="h-14 w-full sm:h-11 sm:w-auto">
          <Link href={NEW_MEMBER_PROFILE_PATH}>{t('add')}</Link>
        </Button>
      </div>

      {list.profileCount === 0 && !search ? (
        <EmptyState />
      ) : (
        <>
          <SearchForm search={search} />
          {list.items.length === 0 ? (
            <p className="text-muted-foreground text-[17px]">
              {t('noResult', {search: search ?? ''})}
            </p>
          ) : (
            <>
              <Card className="hidden py-0 shadow-none sm:block">
                <CardContent className="px-0">
                  <ProfilesTable items={list.items} />
                </CardContent>
              </Card>
              <ul className="flex flex-col gap-4 sm:hidden">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <ProfileCard item={item} />
                  </li>
                ))}
              </ul>
              <Pagination list={list} search={search} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Recherche ecrite, sans loupe (gap 5) : un formulaire `GET` qui pose `q` dans
 * l'URL et revient a la premiere page.
 */
function SearchForm({search}: {search?: string}) {
  const t = useTranslations('BureauMemberProfilesPage.search')

  return (
    <form
      action={MEMBER_PROFILES_PATH}
      method="get"
      role="search"
      className="flex flex-col gap-2"
    >
      <Label htmlFor="member-profile-search" className="text-[17px]">
        {t('label')}
      </Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="member-profile-search"
          type="search"
          name="q"
          defaultValue={search ?? ''}
          className="h-14 text-[18px] sm:h-11 sm:max-w-md sm:text-[17px]"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          {t('submit')}
        </Button>
      </div>
    </form>
  )
}

function ProfilesTable({items}: {items: MemberProfileListItemDTO[]}) {
  return (
    <Table>
      <ProfilesTableHeader />
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="h-14">
            <TableCell className="px-4 text-[17px] font-semibold">
              {item.name}
            </TableCell>
            <TableCell>
              <CurrentParcels numbers={item.currentParcelNumbers} />
            </TableCell>
            <TableCell className="text-[17px] break-all">
              {item.email ?? <MailOnlyBadge />}
            </TableCell>
            <TableCell>{item.incomplete && <IncompleteBadge />}</TableCell>
            <TableCell>
              <OpenProfile id={item.id} className="h-11" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function ProfileCard({item}: {item: MemberProfileListItemDTO}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <Card
      data-testid="member-profile-card"
      className="gap-3 px-4 py-4 shadow-none"
    >
      <h2 className="text-lg leading-snug font-semibold">{item.name}</h2>
      {item.mailOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <MailOnlyBadge />
          {item.incomplete && <IncompleteBadge />}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.parcels')}</dt>
        <dd>
          <CurrentParcels numbers={item.currentParcelNumbers} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.contact')}</dt>
        <dd className="break-words">
          {item.email ?? postalAddressLineOf(item) ?? (
            <span className="text-muted-foreground">{t('noAddress')}</span>
          )}
        </dd>
      </dl>
      <OpenProfile id={item.id} className="h-14 w-full" />
    </Card>
  )
}

/** Les numeros des parcelles actuelles, sur une seule ligne (critere 5). */
function CurrentParcels({numbers}: {numbers: string[]}) {
  const t = useTranslations('BureauMemberProfilesPage')

  if (numbers.length === 0) {
    return (
      <span className="text-muted-foreground text-[17px]">
        {t('noCurrentParcel')}
      </span>
    )
  }

  return (
    <span className="font-mono text-[17px] font-medium tabular-nums">
      {numbers.join(', ')}
    </span>
  )
}

function OpenProfile({id, className}: {id: string; className?: string}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={memberProfilePathOf(id)}>{t('open')}</Link>
    </Button>
  )
}

function EmptyState() {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
      <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full sm:h-11 sm:w-auto"
      >
        <Link href={NEW_MEMBER_PROFILE_PATH}>{t('add')}</Link>
      </Button>
    </Card>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** : le bureau doit
 * pouvoir lire qu'il est au bout de la liste. La recherche est conservee.
 */
function Pagination({
  list,
  search,
}: {
  list: MemberProfilePageDTO
  search?: string
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const from = (list.page - 1) * list.pageSize + 1

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('title')}
    >
      <PageLink
        href={memberProfilesListPathOf({page: list.page - 1, search})}
        disabled={list.page <= 1}
        label={t('pagination.previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('pagination.position', {
          page: list.page,
          total: list.totalPages,
          from,
          to: from + list.items.length - 1,
        })}
      </span>
      <PageLink
        href={memberProfilesListPathOf({page: list.page + 1, search})}
        disabled={list.page >= list.totalPages}
        label={t('pagination.next')}
      />
    </nav>
  )
}

function PageLink({
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

const PROFILE_COLUMNS = [
  'name',
  'parcels',
  'contact',
  'state',
  'action',
] as const

const SKELETON_ROWS = 4

function ProfilesTableHeader() {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <TableHeader>
      <TableRow>
        {PROFILE_COLUMNS.map((column, index) => (
          <TableHead key={column} className={cn(index === 0 && 'px-4')}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/**
 * Chargement de la liste (etat `1c`) : l'en-tete du tableau est deja en
 * place, seules les lignes sont en `skeleton` (§3.2).
 */
export function MemberProfileListSkeleton() {
  const rows = Array.from({length: SKELETON_ROWS}, (_, index) => index)

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-10 w-64" />
      <Card className="hidden py-0 shadow-none sm:block">
        <CardContent className="px-0">
          <Table>
            <ProfilesTableHeader />
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row} className="h-14">
                  {PROFILE_COLUMNS.map((column, index) => (
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
