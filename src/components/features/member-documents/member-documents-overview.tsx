'use client'

import {CircleCheck, Upload} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useId} from 'react'

import {memberProfilePathOf} from '@/components/features/member-profile/member-profile-paths'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import type {
  BureauMemberDocumentDTO,
  BureauMemberDocumentPageDTO,
} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {MemberDocumentParcels} from './member-document-parcels'
import {
  MEMBER_DOCUMENT_BATCH_PATH,
  MEMBER_DOCUMENT_CATEGORIES_PATH,
  MEMBER_DOCUMENTS_PATH,
  memberDocumentDownloadPathOf,
  memberDocumentsListPathOf,
} from './member-document-paths'
import {
  type RemoveMemberDocumentAction,
  RemoveMemberDocumentButton,
} from './remove-member-document-button'

const DATA_CLASS = 'font-mono font-medium tabular-nums'
const ALL_CATEGORIES = 'all'

type MemberDocumentsOverviewProps = {
  list: BureauMemberDocumentPageDTO
  categories: PublicCategoryDTO[]
  search?: string
  categoryId?: string
  /** Un document vient d'etre retire : le dire une fois. */
  notice?: {kind: 'removed'}
  removeAction: RemoveMemberDocumentAction
}

/**
 * « Documents nominatifs » du bureau (design s32, ecran 4, critere 6) : tous
 * ceux de l'association, aucun d'une autre. Recherche par fiche et filtre de
 * categorie avec decompte ; tableau du dernier depose au premier, pagine par
 * le serveur. Une seule action par ligne, « Retirer ».
 */
export function MemberDocumentsOverview({
  list,
  categories,
  search,
  categoryId,
  notice,
  removeAction,
}: MemberDocumentsOverviewProps) {
  const t = useTranslations('BureauMemberDocuments')
  const filtered = Boolean(search || categoryId)
  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize))
  const categoryName = categories.find(({id}) => id === categoryId)?.name

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8">
      {notice && (
        <Alert role="status" className="[&>svg]:size-5">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t('notice.removed')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-pretty">
          {t('overview.title')}
        </h1>
        <p className="text-muted-foreground text-[17px]">
          {t('overview.intro')}
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={MEMBER_DOCUMENT_CATEGORIES_PATH}
          className="text-[17px] underline underline-offset-4"
        >
          {t('overview.manageCategories')}
        </Link>
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={MEMBER_DOCUMENT_BATCH_PATH}>
            <Upload aria-hidden="true" />
            {t('overview.batch')}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <SearchForm search={search} categoryId={categoryId} />
        <CategoryFilter
          categories={categories}
          counts={list.countsByCategory}
          search={search}
          categoryId={categoryId}
        />
      </div>
      <p aria-live="polite" className="text-muted-foreground text-[15px]">
        {t('overview.summary', {
          count: list.total,
          search: search ?? 'none',
          category: categoryName ?? 'none',
        })}
      </p>

      {list.documents.length === 0 ? (
        <EmptyState filtered={filtered} />
      ) : (
        <>
          <div className="hidden sm:block">
            <Table aria-label={t('overview.caption')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('overview.columns.profile')}</TableHead>
                  <TableHead>{t('overview.columns.title')}</TableHead>
                  <TableHead>{t('overview.columns.category')}</TableHead>
                  <TableHead>{t('overview.columns.documentDate')}</TableHead>
                  <TableHead>{t('overview.columns.weight')}</TableHead>
                  <TableHead>{t('overview.columns.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.documents.map((document) => (
                  <TableRow key={document.id} className="h-14">
                    <TableCell className="whitespace-normal">
                      <ProfileCell
                        document={document}
                        parcelNumbers={
                          list.parcelNumbersByProfile[document.memberProfileId]
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <DownloadLink document={document} />
                    </TableCell>
                    <TableCell>{document.categoryName}</TableCell>
                    <TableCell className={DATA_CLASS}>
                      {isoToFrenchDate(document.documentDate)}
                    </TableCell>
                    <TableCell className={DATA_CLASS}>
                      {formatFileWeight(document.fileBytes)}
                    </TableCell>
                    <TableCell>
                      <RemoveMemberDocumentButton
                        documentId={document.id}
                        title={document.title}
                        memberName={document.memberProfileName}
                        origin="overview"
                        removeAction={removeAction}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-4 sm:hidden">
            {list.documents.map((document) => (
              <li key={document.id}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <DownloadLink document={document} />
                  <ProfileCell
                    document={document}
                    parcelNumbers={
                      list.parcelNumbersByProfile[document.memberProfileId]
                    }
                  />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('overview.columns.category')}
                    </dt>
                    <dd>{document.categoryName}</dd>
                    <dt className="text-muted-foreground">
                      {t('overview.columns.documentDate')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {isoToFrenchDate(document.documentDate)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('overview.columns.weight')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {formatFileWeight(document.fileBytes)}
                    </dd>
                  </dl>
                  <RemoveMemberDocumentButton
                    documentId={document.id}
                    title={document.title}
                    memberName={document.memberProfileName}
                    origin="overview"
                    removeAction={removeAction}
                  />
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            page={list.page}
            totalPages={totalPages}
            search={search}
            categoryId={categoryId}
          />
        </>
      )}
    </div>
  )
}

/**
 * Recherche par nom de fiche : un formulaire `GET` qui pose `q` dans l'URL,
 * garde la categorie et revient a la premiere page.
 */
function SearchForm({
  search,
  categoryId,
}: {
  search?: string
  categoryId?: string
}) {
  const t = useTranslations('BureauMemberDocuments.overview')
  const fieldId = useId()

  return (
    <form
      action={MEMBER_DOCUMENTS_PATH}
      method="get"
      role="search"
      className="flex flex-1 flex-col gap-2"
    >
      <Label htmlFor={fieldId} className="text-[17px]">
        {t('searchLabel')}
      </Label>
      {categoryId && (
        <input type="hidden" name="categorie" value={categoryId} />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={fieldId}
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
          {t('apply')}
        </Button>
      </div>
    </form>
  )
}

/** Le filtre « Categorie » avec le decompte dans chaque option (§3.13). */
function CategoryFilter({
  categories,
  counts,
  search,
  categoryId,
}: {
  categories: PublicCategoryDTO[]
  counts: Record<string, number>
  search?: string
  categoryId?: string
}) {
  const t = useTranslations('BureauMemberDocuments.overview')
  const router = useRouter()
  const fieldId = useId()
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId} className="text-[17px]">
        {t('categoryLabel')}
      </Label>
      <Select
        value={categoryId ?? ALL_CATEGORIES}
        onValueChange={(value) =>
          router.push(
            memberDocumentsListPathOf({
              search,
              categoryId: value === ALL_CATEGORIES ? undefined : value,
            })
          )
        }
      >
        <SelectTrigger id={fieldId} className="h-14 w-full sm:h-11 sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>
            {t('allCategories', {count: total})}
          </SelectItem>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {t('categoryOption', {
                name: category.name,
                count: counts[category.id] ?? 0,
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** La fiche : lien vers elle, puis ses parcelles actuelles. */
function ProfileCell({
  document,
  parcelNumbers = [],
}: {
  document: BureauMemberDocumentDTO
  parcelNumbers?: string[]
}) {
  return (
    <span className="flex flex-col">
      <Link
        href={memberProfilePathOf(document.memberProfileId)}
        className="text-[17px] font-semibold underline underline-offset-4"
      >
        {document.memberProfileName}
      </Link>
      <span className="text-muted-foreground text-[15px]">
        <MemberDocumentParcels parcelNumbers={parcelNumbers} />
      </span>
    </span>
  )
}

/** Le titre, lien de telechargement par la route authentifiee. */
function DownloadLink({document}: {document: BureauMemberDocumentDTO}) {
  const t = useTranslations('BureauMemberDocuments')
  const weight = formatFileWeight(document.fileBytes)

  return (
    <a
      href={memberDocumentDownloadPathOf(document.id)}
      aria-label={t('downloadLabel', {title: document.title, weight})}
      className="text-[17px] font-medium [overflow-wrap:anywhere] underline underline-offset-4"
    >
      {document.title}
    </a>
  )
}

function EmptyState({filtered}: {filtered: boolean}) {
  const t = useTranslations('BureauMemberDocuments.overview')

  if (!filtered) {
    return <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
  }
  return (
    <p className="text-muted-foreground flex flex-col gap-2 text-[17px]">
      <span>{t('noMatch')}</span>
      <Link
        href={MEMBER_DOCUMENTS_PATH}
        className="text-foreground underline underline-offset-4"
      >
        <span aria-hidden="true">→ </span>
        {t('clearFilters')}
      </Link>
    </p>
  )
}

/**
 * Pagination ecrite. Un controle desactive reste **annonce** (§3.13). Les
 * filtres sont conserves.
 */
function Pagination({
  page,
  totalPages,
  search,
  categoryId,
}: {
  page: number
  totalPages: number
  search?: string
  categoryId?: string
}) {
  const t = useTranslations('BureauMemberDocuments.overview')

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label={t('paginationLabel')}
    >
      <PageLink
        href={memberDocumentsListPathOf({page: page - 1, search, categoryId})}
        disabled={page <= 1}
        label={t('previous')}
      />
      <span className="text-muted-foreground text-[15px]">
        {t('page', {page, total: totalPages})}
      </span>
      <PageLink
        href={memberDocumentsListPathOf({page: page + 1, search, categoryId})}
        disabled={page >= totalPages}
        label={t('next')}
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
