import {Upload} from 'lucide-react'
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

import {
  BoardRoleBadge,
  IncompleteBadge,
  MailOnlyBadge,
} from './member-profile-badges'
import {postalAddressLineOf} from './member-profile-format'
import {
  MEMBER_CONTACT_IMPORT_PATH,
  MEMBER_PROFILES_PATH,
  memberProfilePathOf,
  memberProfilesListPathOf,
  NEW_MEMBER_PROFILE_PATH,
} from './member-profile-paths'
import {
  GroupFilter,
  type MemberProfileGroupSelection,
  MemberProfileSelectionProvider,
  PageSelectCheckbox,
  RowSelectCheckbox,
  SelectionBar,
} from './member-profile-selection'

type MemberProfileListProps = {
  list: MemberProfilePageDTO
  search?: string
  /**
   * Filtre « Groupe » et selection des fiches (s27), pour qui compose les
   * groupes de destinataires ; absent, la liste reste celle de s12.
   */
  groupSelection?: MemberProfileGroupSelection
  /**
   * La presidence met a jour les coordonnees depuis le fichier de l'annee
   * (s56, ecran 0) : bouton d'entree, masque au Bureau.
   */
  canImportContacts?: boolean
}

/**
 * Liste des proprietaires (ecran 1 du design s12) : triee par nom par le
 * service, 25 fiches par page. Un tableau en desktop, des cartes empilees sous
 * 640 px (§3.5), la meme pagination serveur. La recherche voyage dans l'URL.
 */
export function MemberProfileList({
  list,
  search,
  groupSelection,
  canImportContacts,
}: MemberProfileListProps) {
  const content = (
    <MemberProfileListContent
      list={list}
      search={search}
      groupSelection={groupSelection}
      canImportContacts={canImportContacts}
    />
  )
  if (!groupSelection) return content
  return (
    <MemberProfileSelectionProvider
      key={list.items.map((item) => item.id).join(',')}
      pageIds={list.items.map((item) => item.id)}
    >
      {content}
    </MemberProfileSelectionProvider>
  )
}

function MemberProfileListContent({
  list,
  search,
  groupSelection,
  canImportContacts,
}: MemberProfileListProps) {
  const t = useTranslations('BureauMemberProfilesPage')
  const groupId = groupSelection?.groupId
  const selectable = groupSelection !== undefined

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
        <div className="flex flex-col gap-3 sm:flex-row">
          {canImportContacts && (
            <Button
              asChild
              variant="outline"
              className="h-14 w-full sm:h-11 sm:w-auto"
            >
              <Link href={MEMBER_CONTACT_IMPORT_PATH}>
                <Upload aria-hidden="true" />
                {t('importContacts')}
              </Link>
            </Button>
          )}
          <Button asChild className="h-14 w-full sm:h-11 sm:w-auto">
            <Link href={NEW_MEMBER_PROFILE_PATH}>{t('add')}</Link>
          </Button>
        </div>
      </div>

      {list.profileCount === 0 && !search ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <SearchForm search={search} groupId={groupId} />
            {groupSelection && (
              <GroupFilter
                groups={groupSelection.groups}
                groupId={groupId}
                search={search}
              />
            )}
          </div>
          {groupSelection && <SelectionBar {...groupSelection} />}
          {list.items.length === 0 ? (
            <p className="text-muted-foreground text-[17px]">
              {groupId && !search
                ? t('recipientGroups.emptyGroup')
                : t('noResult', {search: search ?? ''})}
            </p>
          ) : (
            <>
              <Card className="hidden py-0 shadow-none sm:block">
                <CardContent className="px-0">
                  <ProfilesTable items={list.items} selectable={selectable} />
                </CardContent>
              </Card>
              <ul className="flex flex-col gap-4 sm:hidden">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <ProfileCard item={item} selectable={selectable} />
                  </li>
                ))}
              </ul>
              <Pagination list={list} search={search} groupId={groupId} />
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
function SearchForm({search, groupId}: {search?: string; groupId?: string}) {
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
      {groupId && <input type="hidden" name="groupe" value={groupId} />}
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

function ProfilesTable({
  items,
  selectable,
}: {
  items: MemberProfileListItemDTO[]
  selectable: boolean
}) {
  return (
    <Table>
      <ProfilesTableHeader selectable={selectable} />
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} className="h-14">
            {selectable && (
              <TableCell className="w-12 pl-4">
                <RowSelectCheckbox id={item.id} name={item.name} />
              </TableCell>
            )}
            <TableCell className="px-4 text-[17px] font-semibold">
              <span className="flex flex-wrap items-center gap-2">
                {item.name}
                {item.boardRole && <BoardRoleBadge role={item.boardRole} />}
              </span>
            </TableCell>
            <TableCell>
              <CurrentParcels numbers={item.currentParcelNumbers} />
            </TableCell>
            <TableCell className="text-[17px] break-all">
              {item.email ?? <MailOnlyBadge />}
              <ContactMeta
                accountProfileCount={item.accountProfileCount}
                otherEmailCount={item.otherEmailCount}
              />
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

function ProfileCard({
  item,
  selectable,
}: {
  item: MemberProfileListItemDTO
  selectable: boolean
}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <Card
      data-testid="member-profile-card"
      className="gap-3 px-4 py-4 shadow-none"
    >
      <h2 className="flex items-center gap-3 text-lg leading-snug font-semibold">
        {selectable && <RowSelectCheckbox id={item.id} name={item.name} />}
        {item.name}
      </h2>
      {(item.boardRole || item.mailOnly) && (
        <div className="flex flex-wrap items-center gap-2">
          {item.boardRole && <BoardRoleBadge role={item.boardRole} />}
          {item.mailOnly && <MailOnlyBadge />}
          {item.mailOnly && item.incomplete && <IncompleteBadge />}
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
          <ContactMeta
            accountProfileCount={item.accountProfileCount}
            otherEmailCount={item.otherEmailCount}
          />
        </dd>
      </dl>
      <OpenProfile id={item.id} className="h-14 w-full" />
    </Card>
  )
}

/**
 * La ligne `meta` sous l'adresse titulaire : « Compte de {n} terrains »,
 * seulement a partir de deux (s53, etat 4a), puis « + {n} autres adresses »
 * quand la fiche en porte d'autres actives (s54, etat 5a), separes par « · ».
 */
function ContactMeta({
  accountProfileCount,
  otherEmailCount,
}: {
  accountProfileCount: number
  otherEmailCount: number
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const parts = [
    accountProfileCount >= 2 &&
      t('accountProfiles', {count: accountProfileCount}),
    otherEmailCount > 0 && t('otherEmails', {count: otherEmailCount}),
  ].filter((part): part is string => Boolean(part))

  if (parts.length === 0) return null
  return (
    <span className="text-muted-foreground block text-[15px] break-normal">
      {parts.join(' · ')}
    </span>
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
  groupId,
}: {
  list: MemberProfilePageDTO
  search?: string
  groupId?: string
}) {
  const t = useTranslations('BureauMemberProfilesPage')
  const from = (list.page - 1) * list.pageSize + 1

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('title')}
    >
      <PageLink
        href={memberProfilesListPathOf({page: list.page - 1, search, groupId})}
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
        href={memberProfilesListPathOf({page: list.page + 1, search, groupId})}
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

function ProfilesTableHeader({selectable = false}: {selectable?: boolean}) {
  const t = useTranslations('BureauMemberProfilesPage')

  return (
    <TableHeader>
      <TableRow>
        {selectable && (
          <TableHead className="w-12 pl-4">
            <PageSelectCheckbox />
          </TableHead>
        )}
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
