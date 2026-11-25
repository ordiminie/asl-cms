'use client'

import {Download, FileText} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState} from 'react'

import {PARCEL_LIST} from '@/components/features/member-documents/member-document-parcels'
import {memberDocumentDownloadPathOf} from '@/components/features/member-documents/member-document-paths'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {Skeleton} from '@/components/ui/skeleton'
import type {MyMemberDocumentDTO} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

const LOADING_LINES = [0, 1, 2]
const PAGE_SIZE = 25

const data = (chunks: ReactNode) => (
  <span className="font-mono tabular-nums">{chunks}</span>
)
const mono = (chunks: ReactNode) => (
  <span className="font-mono font-medium tabular-nums">{chunks}</span>
)

/**
 * « Mes documents » (design s32, ecran 1) : les documents nominatifs de
 * **toutes** les fiches du compte, en une seule liste par date du document
 * decroissante. Chaque ligne dit son terrain, meme pour un seul terrain
 * (critere 3). Une seule action, « Telecharger », vers la route
 * authentifiee **par identifiant** (ADR 073 §5).
 */
export function MyMemberDocumentsCard({
  documents,
  landCount,
}: {
  documents: MyMemberDocumentDTO[]
  /** Le nombre de terrains (fiches) du compte, pour la phrase d'intro. */
  landCount: number
}) {
  const t = useTranslations('MemberSpacePage.memberDocuments')
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(documents.length / PAGE_SIZE))
  const shown = documents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <MyMemberDocumentsSection landCount={landCount} footer>
      {documents.length === 0 ? (
        <p className="text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <ul className="divide-y" aria-label={t('caption')}>
            {shown.map((document) => (
              <DocumentLine key={document.id} document={document} />
            ))}
          </ul>
          {totalPages > 1 && (
            <nav className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-14 sm:h-11"
                disabled={page <= 1}
                aria-disabled={page <= 1 || undefined}
                onClick={() => setPage(page - 1)}
              >
                {t('previous')}
              </Button>
              <span className="text-muted-foreground text-[15px]">
                {t('page', {page, total: totalPages})}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-14 sm:h-11"
                disabled={page >= totalPages}
                aria-disabled={page >= totalPages || undefined}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </MyMemberDocumentsSection>
  )
}

/** 1c : trois lignes en `skeleton` ; le reste de l'espace n'attend pas. */
export function MyMemberDocumentsCardLoading() {
  return (
    <MyMemberDocumentsSection busy landCount={1}>
      {LOADING_LINES.map((line) => (
        <Skeleton key={line} className="bg-muted h-14 w-full" />
      ))}
    </MyMemberDocumentsSection>
  )
}

/** Le terrain en mots, pour le nom accessible du bouton. */
const landLabelOf = (
  document: MyMemberDocumentDTO,
  t: ReturnType<typeof useTranslations>
): string =>
  t('downloadLand', {
    count: document.parcelNumbers.length,
    numbers: PARCEL_LIST.format(document.parcelNumbers),
  })

function DocumentLine({document}: {document: MyMemberDocumentDTO}) {
  const t = useTranslations('MemberSpacePage.memberDocuments')
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
          <span className="text-[17px] [overflow-wrap:anywhere]">
            {document.title}
          </span>
          <span className="text-muted-foreground text-[15px]">
            {t.rich('meta', {
              category: document.categoryName,
              date: isoToFrenchDate(document.documentDate),
              weight,
              data,
            })}
          </span>
          <DocumentLand document={document} />
        </div>
      </div>
      <Button
        asChild
        variant="outline"
        className="h-14 w-full text-base sm:h-12 sm:w-auto"
      >
        <a
          href={memberDocumentDownloadPathOf(document.id)}
          aria-label={t('downloadLabel', {
            title: document.title,
            land: landLabelOf(document, t),
            weight,
          })}
        >
          <Download aria-hidden="true" className="size-5" />
          {t('download')}
        </a>
      </Button>
    </li>
  )
}

/**
 * Le terrain d'un document, avec les cles de « Mes factures » : les parcelles
 * de la fiche a la date du document, le compteur, et le nom de la fiche
 * quand il n'est pas celui du compte.
 */
function DocumentLand({document}: {document: MyMemberDocumentDTO}) {
  const t = useTranslations('MemberSpacePage.memberDocuments')
  const [single] = document.parcelNumbers

  return (
    <>
      <span className="text-muted-foreground text-[15px]">
        {document.parcelNumbers.length === 0 ? (
          t('landMissing')
        ) : (
          <>
            {t('land')}
            {document.parcelNumbers.length === 1
              ? t.rich('parcel', {number: single, mono})
              : t.rich('parcels', {
                  numbers: PARCEL_LIST.format(document.parcelNumbers),
                  mono,
                })}
            {document.meterNumber && (
              <>
                {' · '}
                {t.rich('meter', {number: document.meterNumber, mono})}
              </>
            )}
          </>
        )}
      </span>
      {document.holderName && (
        <span className="text-muted-foreground text-[15px]">
          {t('holder', {name: document.holderName})}
        </span>
      )}
    </>
  )
}

function MyMemberDocumentsSection({
  busy = false,
  footer = false,
  landCount,
  children,
}: {
  busy?: boolean
  footer?: boolean
  landCount: number
  children: ReactNode
}) {
  const t = useTranslations('MemberSpacePage.memberDocuments')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-serif text-xl font-semibold">
            {t('title')}
          </h2>
          <p className="text-muted-foreground text-[15px]">
            {t('description', {count: landCount})}
          </p>
        </div>
        {children}
        {footer && (
          <p className="border-t pt-4 text-[17px]">
            {t.rich('footer', {
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
