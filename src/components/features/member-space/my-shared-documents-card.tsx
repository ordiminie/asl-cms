import {Download, FileText} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId} from 'react'

import {sharedDocumentDateOf} from '@/components/features/shared-document/shared-document-format'
import {sharedDocumentDownloadPathOf} from '@/components/features/shared-document/shared-document-paths'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Skeleton} from '@/components/ui/skeleton'
import type {SharedDocumentDTO} from '@/services/types/domain/shared-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

const LOADING_LINES = [0, 1, 2]

type CategoryGroup = {name: string; documents: SharedDocumentDTO[]}

/**
 * Les documents ranges par categorie : categories dans l'ordre alphabetique
 * francais, documents du plus recent au plus ancien dans chacune.
 */
const groupByCategory = (documents: SharedDocumentDTO[]): CategoryGroup[] => {
  const groups = new Map<string, SharedDocumentDTO[]>()
  for (const document of documents) {
    groups.set(document.categoryName, [
      ...(groups.get(document.categoryName) ?? []),
      document,
    ])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr'))
    .map(([name, items]) => ({
      name,
      documents: [...items].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
    }))
}

/**
 * « Documents de l'association » (s31, ecran 1) : les documents partages par
 * le bureau, groupes par categorie. Une seule action par ligne,
 * « Telecharger », vers la route authentifiee **par identifiant** — jamais un
 * chemin de stockage (ADR 069).
 */
export function MySharedDocumentsCard({
  documents,
}: {
  documents: SharedDocumentDTO[]
}) {
  const t = useTranslations('MemberSpacePage.documents')

  return (
    <MySharedDocumentsSection
      footer={documents.length === 0 ? 'emptyFooter' : 'footer'}
    >
      {documents.length === 0 ? (
        <p className="text-[17px]">{t('empty')}</p>
      ) : (
        groupByCategory(documents).map((group) => (
          <CategoryDocuments key={group.name} group={group} />
        ))
      )}
    </MySharedDocumentsSection>
  )
}

/** 1c : trois lignes en `skeleton` ; le reste de l'espace n'attend pas. */
export function MySharedDocumentsCardLoading() {
  return (
    <MySharedDocumentsSection busy>
      {LOADING_LINES.map((line) => (
        <Skeleton key={line} className="bg-muted h-14 w-full" />
      ))}
    </MySharedDocumentsSection>
  )
}

function CategoryDocuments({group}: {group: CategoryGroup}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3 id={titleId} className="text-[17px] font-semibold">
        {group.name}
      </h3>
      <ul className="divide-y">
        {group.documents.map((document) => (
          <DocumentLine key={document.id} document={document} />
        ))}
      </ul>
    </section>
  )
}

function DocumentLine({document}: {document: SharedDocumentDTO}) {
  const t = useTranslations('MemberSpacePage.documents')
  const weight = formatFileWeight(document.fileBytes)

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <FileText
          aria-hidden="true"
          className="text-primary mt-1 size-5 shrink-0"
          strokeWidth={1.75}
        />
        <div className="flex flex-col gap-1">
          <span className="text-[17px]">{document.title}</span>
          <span className="text-muted-foreground text-[15px]">
            {t.rich('meta', {
              date: sharedDocumentDateOf(document.createdAt),
              weight,
              data: (chunks) => (
                <span className="font-mono tabular-nums">{chunks}</span>
              ),
            })}
          </span>
        </div>
      </div>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full text-base sm:h-12 sm:w-auto"
      >
        <a
          href={sharedDocumentDownloadPathOf(document.id)}
          aria-label={t('downloadLabel', {title: document.title, weight})}
        >
          <Download aria-hidden="true" className="size-5" />
          {t('download')}
        </a>
      </Button>
    </li>
  )
}

function MySharedDocumentsSection({
  busy = false,
  footer,
  children,
}: {
  busy?: boolean
  footer?: 'footer' | 'emptyFooter'
  children: ReactNode
}) {
  const t = useTranslations('MemberSpacePage.documents')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {t('title')}
          </h2>
          <p className="text-muted-foreground text-[15px]">
            {t('description')}
          </p>
        </div>
        {children}
        {footer && (
          <p className="border-t pt-4 text-[17px]">
            {t.rich(footer, {
              contact: (chunks) => (
                <Link
                  href="/contact"
                  className="text-primary font-semibold underline underline-offset-4"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </Card>
    </section>
  )
}
