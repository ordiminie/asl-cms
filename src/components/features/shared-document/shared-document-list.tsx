import {CircleCheck, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {BureauSharedDocumentDTO} from '@/services/types/domain/shared-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {RemoveSharedDocumentButton} from './remove-shared-document-button'
import type {SharedDocumentFormState} from './shared-document-form-validation'
import {sharedDocumentDateOf} from './shared-document-format'
import {
  NEW_SHARED_DOCUMENT_PATH,
  SHARED_DOCUMENT_CATEGORIES_PATH,
  sharedDocumentDownloadPathOf,
} from './shared-document-paths'

/** Ce que la liste confirme apres un depot ou un retrait (2d). */
export type SharedDocumentNotice =
  {kind: 'published'; documentId?: string} | {kind: 'deleted'}

/**
 * « Documents » du bureau (design s31, ecran 2) : du plus recent au plus
 * ancien, le titre telecharge par la route authentifiee (jamais un chemin de
 * stockage), une seule action par ligne — « Retirer ». Sous 640 px, le
 * tableau devient une pile de cartes.
 */
export function SharedDocumentList({
  documents,
  notice,
  deleteAction,
}: {
  documents: BureauSharedDocumentDTO[]
  notice?: SharedDocumentNotice
  deleteAction: (documentId: string) => Promise<SharedDocumentFormState>
}) {
  const t = useTranslations('BureauSharedDocumentsPage')
  const published =
    notice?.kind === 'published'
      ? documents.find((item) => item.id === notice.documentId)
      : undefined

  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[17px]">{t('intro')}</p>
      </div>

      {notice && (
        <Alert role="status">
          <CircleCheck className="text-primary" />
          <AlertDescription>
            {notice.kind === 'deleted'
              ? t('notice.deleted')
              : published
                ? t('notice.published', {title: published.title})
                : t('notice.publishedUntitled')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild variant="link" className="h-14 sm:h-12">
          <Link href={SHARED_DOCUMENT_CATEGORIES_PATH}>
            {t('manageCategories')}
          </Link>
        </Button>
        <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
          <Link href={NEW_SHARED_DOCUMENT_PATH}>
            <Upload aria-hidden="true" />
            {t('newAction')}
          </Link>
        </Button>
      </div>

      <Card className="border-0 shadow-none sm:border">
        <CardContent className="flex flex-col gap-6 px-0 sm:px-6">
          {documents.length === 0 ? (
            <p className="text-[17px]">{t('empty')}</p>
          ) : (
            <Table>
              <TableHeader className="max-sm:sr-only">
                <TableRow>
                  <TableHead>{t('columns.title')}</TableHead>
                  <TableHead>{t('columns.category')}</TableHead>
                  <TableHead>{t('columns.createdAt')}</TableHead>
                  <TableHead>{t('columns.weight')}</TableHead>
                  <TableHead>{t('columns.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((item) => {
                  const weight = formatFileWeight(item.fileBytes)
                  return (
                    <TableRow
                      key={item.id}
                      className="max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:rounded-lg max-sm:border max-sm:p-4"
                    >
                      <TableCell className="text-[17px] font-semibold whitespace-normal max-sm:p-0">
                        <a
                          href={sharedDocumentDownloadPathOf(item.id)}
                          aria-label={t('downloadLabel', {
                            title: item.title,
                            weight,
                          })}
                          className="underline underline-offset-4"
                        >
                          {item.title}
                        </a>
                      </TableCell>
                      <PairCell label={t('columns.category')}>
                        {item.categoryName}
                      </PairCell>
                      <PairCell label={t('columns.createdAt')} data>
                        {sharedDocumentDateOf(item.createdAt)}
                      </PairCell>
                      <PairCell label={t('columns.weight')} data>
                        {weight}
                      </PairCell>
                      <TableCell className="max-sm:p-0">
                        <RemoveSharedDocumentButton
                          documentId={item.id}
                          title={item.title}
                          deleteAction={deleteAction}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Une cellule, lue en paire « libelle valeur » sous 640 px. */
function PairCell({
  label,
  data = false,
  children,
}: {
  label: string
  data?: boolean
  children: React.ReactNode
}) {
  return (
    <TableCell
      className={`text-[17px] max-sm:flex max-sm:items-center max-sm:justify-between max-sm:p-0 ${data ? 'font-mono tabular-nums' : ''}`}
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground font-sans text-[15px] sm:hidden"
      >
        {label}
      </span>
      {children}
    </TableCell>
  )
}
