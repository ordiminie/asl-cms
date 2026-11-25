import {CircleAlert, CircleCheck, FileText, Plus} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {Skeleton} from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {DocumentTemplateListItemDTO} from '@/services/types/domain/document-template-types'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

import {
  DOCUMENT_LOT_PATH,
  documentTemplatePathOf,
  NEW_DOCUMENT_TEMPLATE_PATH,
} from './document-template-paths'

type DocumentTemplateListProps = {
  templates: DocumentTemplateListItemDTO[]
  /** Un modele vient d'etre supprime : l'alerte de succes, sans son nom. */
  deleted?: boolean
}

const PAGE_CLASS = 'flex w-full flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8'

const dayOf = (instant: Date): string => isoToFrenchDate(calendarDayOf(instant))

/**
 * « Modeles de documents » (ecran 1 de s36) : le tableau Nom · Variables ·
 * Modifie le · « Modifier » en bureau, des cartes empilees sous 640 px
 * (§3.5). Seul `default` : « Creer un modele ». La suppression vit dans
 * l'editeur.
 */
export function DocumentTemplateList({
  templates,
  deleted = false,
}: DocumentTemplateListProps) {
  const t = useTranslations('DocumentTemplatesBureau.list')

  return (
    <div className={PAGE_CLASS}>
      <ListHeader hasTemplates={templates.length > 0} />

      {deleted && (
        <Alert role="status">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertTitle className="text-[15px] whitespace-normal">
            {t('deletedTitle')}
          </AlertTitle>
          <AlertDescription className="text-foreground">
            {t('deletedDescription')}
          </AlertDescription>
        </Alert>
      )}

      {templates.length === 0 ? (
        <Card className="items-start gap-3 px-4 py-6 shadow-none sm:px-6">
          <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
          <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
            <Link href={NEW_DOCUMENT_TEMPLATE_PATH}>{t('createFirst')}</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="hidden py-0 shadow-none sm:block">
            <CardContent className="px-0">
              <Table>
                <TemplatesTableHeader />
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} className="h-14">
                      <TableCell className="px-4 text-[17px] font-semibold whitespace-normal">
                        {template.name}
                      </TableCell>
                      <TableCell className="font-mono text-[15px]">
                        <VariablesOf template={template} />
                      </TableCell>
                      <TableCell className="font-mono text-[15px] tabular-nums">
                        {dayOf(template.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <EditTemplate id={template.id} className="h-11" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <ul className="flex flex-col gap-4 sm:hidden">
            {templates.map((template) => (
              <li key={template.id}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <h2 className="text-lg leading-snug font-semibold">
                    {template.name}
                  </h2>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('columns.variables')}
                    </dt>
                    <dd className="font-mono text-[15px]">
                      <VariablesOf template={template} />
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('columns.updatedAt')}
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {dayOf(template.updatedAt)}
                    </dd>
                  </dl>
                  <EditTemplate id={template.id} className="h-14 w-full" />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function ListHeader({hasTemplates}: {hasTemplates: boolean}) {
  const t = useTranslations('DocumentTemplatesBureau.list')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-[34px] leading-tight font-semibold">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-[15px]">{t('intro')}</p>
      </div>
      {hasTemplates && (
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <Button asChild className="h-14 w-full sm:h-12 sm:w-auto">
            <Link href={NEW_DOCUMENT_TEMPLATE_PATH}>
              <Plus aria-hidden="true" />
              {t('create')}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-14 w-full sm:h-12 sm:w-auto"
          >
            <Link href={DOCUMENT_LOT_PATH}>
              <FileText aria-hidden="true" />
              {t('lot')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

function VariablesOf({template}: {template: DocumentTemplateListItemDTO}) {
  const t = useTranslations('DocumentTemplatesBureau.list')

  if (template.variables.length === 0) {
    return (
      <span className="text-muted-foreground font-sans">{t('noVariable')}</span>
    )
  }
  return <>{template.variables.map((name) => `{${name}}`).join(' ')}</>
}

function EditTemplate({id, className}: {id: string; className?: string}) {
  const t = useTranslations('DocumentTemplatesBureau.list')

  return (
    <Button asChild variant="outline" className={className}>
      <Link href={documentTemplatePathOf(id)}>{t('edit')}</Link>
    </Button>
  )
}

const TEMPLATE_COLUMNS = ['name', 'variables', 'updatedAt', 'action'] as const

function TemplatesTableHeader() {
  const t = useTranslations('DocumentTemplatesBureau.list')

  return (
    <TableHeader>
      <TableRow>
        {TEMPLATE_COLUMNS.map((column, index) => (
          <TableHead key={column} className={index === 0 ? 'px-4' : undefined}>
            {t(`columns.${column}`)}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

/** 1d : la lecture a echoue ; rien n'est perdu. */
export function DocumentTemplateListError() {
  const t = useTranslations('DocumentTemplatesBureau.list')

  return (
    <div className={PAGE_CLASS}>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('title')}
      </h1>
      <Alert role="alert" variant="destructive" className="border-2">
        <CircleAlert strokeWidth={1.75} />
        <AlertTitle className="text-destructive-text line-clamp-none text-base font-bold">
          {t('failedTitle')}
        </AlertTitle>
        <AlertDescription className="text-foreground">
          {t('failedDescription')}
        </AlertDescription>
      </Alert>
    </div>
  )
}

/** 1c : l'en-tete est en place, les lignes en `skeleton`. */
export function DocumentTemplateListSkeleton() {
  return (
    <div className={PAGE_CLASS} aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Card className="gap-3 px-4 py-6 shadow-none sm:px-6">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-6 w-full" />
        ))}
      </Card>
    </div>
  )
}
