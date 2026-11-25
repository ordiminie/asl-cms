'use client'

import {CircleCheck, Upload} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {Suspense, use} from 'react'

import {DetailCard} from '@/components/features/member-profile/member-profile-detail-card'
import {Alert, AlertDescription} from '@/components/ui/alert'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
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
import type {BureauMemberDocumentDTO} from '@/services/types/domain/member-document-types'
import {formatFileWeight} from '@/services/types/domain/water-analysis-types'

import {
  memberDocumentDownloadPathOf,
  type MemberDocumentNotice,
  newMemberDocumentPathOf,
} from './member-document-paths'
import {
  type RemoveMemberDocumentAction,
  RemoveMemberDocumentButton,
} from './remove-member-document-button'

const DATA_CLASS = 'font-mono font-medium tabular-nums'

type MemberDocumentsCardProps = {
  memberProfileId: string
  memberName: string
  /** Un compte est relie a la fiche : sinon, le dossier attend (2b). */
  hasAccount: boolean
  documents: BureauMemberDocumentDTO[]
  /** L'alerte d'arrivee, lue dans l'URL (2e). */
  notice?: MemberDocumentNotice
  removeAction: RemoveMemberDocumentAction
}

/**
 * La section « Documents » de la fiche, lue sans etre attendue : rien pour un
 * compte qui ne gere pas les documents nominatifs (section non rendue).
 */
export function MemberDocumentsSection({
  documentsPromise,
  ...props
}: Omit<MemberDocumentsCardProps, 'documents'> & {
  documentsPromise: Promise<BureauMemberDocumentDTO[] | undefined>
}) {
  return (
    <Suspense fallback={<Skeleton className="bg-muted h-48 w-full" />}>
      <MemberDocumentsFromPromise
        documentsPromise={documentsPromise}
        {...props}
      />
    </Suspense>
  )
}

function MemberDocumentsFromPromise({
  documentsPromise,
  ...props
}: Omit<MemberDocumentsCardProps, 'documents'> & {
  documentsPromise: Promise<BureauMemberDocumentDTO[] | undefined>
}) {
  const documents = use(documentsPromise)
  if (!documents) return null

  return <MemberDocumentsCard documents={documents} {...props} />
}

/**
 * Documents nominatifs d'une fiche (design s32, ecran 2) : du plus recent au
 * plus ancien, une seule action par ligne, « Retirer ». « Deposer un
 * document » en `outline` : la fiche garde son unique `default`.
 */
export function MemberDocumentsCard({
  memberProfileId,
  memberName,
  hasAccount,
  documents,
  notice,
  removeAction,
}: MemberDocumentsCardProps) {
  const t = useTranslations('BureauMemberDocuments')

  return (
    <DetailCard
      title={t('section.title')}
      action={
        <Button
          asChild
          variant="outline"
          className="h-14 w-full sm:h-11 sm:w-auto"
        >
          <Link href={newMemberDocumentPathOf(memberProfileId)}>
            <Upload aria-hidden="true" />
            {t('section.deposit')}
          </Link>
        </Button>
      }
    >
      {notice && <NoticeAlert notice={notice} documents={documents} />}
      <p className="text-muted-foreground text-[15px]">{t('section.intro')}</p>
      {!hasAccount && (
        <p className="text-muted-foreground text-[15px]">
          {t('section.noAccount')}
        </p>
      )}
      {documents.length === 0 ? (
        <p className="text-muted-foreground text-[17px]">
          {t('section.empty')}
        </p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table aria-label={t('section.caption', {name: memberName})}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('section.columns.title')}</TableHead>
                  <TableHead>{t('section.columns.category')}</TableHead>
                  <TableHead>{t('section.columns.documentDate')}</TableHead>
                  <TableHead>{t('section.columns.weight')}</TableHead>
                  <TableHead>{t('section.columns.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} className="h-14">
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
                        memberName={memberName}
                        origin="profile"
                        removeAction={removeAction}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-4 sm:hidden">
            {documents.map((document) => (
              <li key={document.id}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <DownloadLink document={document} />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('section.columns.category')}
                    </dt>
                    <dd>{document.categoryName}</dd>
                    <dt className="text-muted-foreground">
                      {t('section.columns.documentDate')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {isoToFrenchDate(document.documentDate)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('section.columns.weight')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {formatFileWeight(document.fileBytes)}
                    </dd>
                  </dl>
                  <RemoveMemberDocumentButton
                    documentId={document.id}
                    title={document.title}
                    memberName={memberName}
                    origin="profile"
                    removeAction={removeAction}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailCard>
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

/** 2e : succes du depot ou du retrait, ancre en tete de section. */
function NoticeAlert({
  notice,
  documents,
}: {
  notice: MemberDocumentNotice
  documents: BureauMemberDocumentDTO[]
}) {
  const t = useTranslations('BureauMemberDocuments.notice')
  const deposited =
    notice.kind === 'deposited'
      ? documents.find((document) => document.id === notice.documentId)
      : undefined
  let message = t('removed')
  if (notice.kind === 'deposited') {
    message = deposited
      ? t('deposited', {title: deposited.title})
      : t('depositedUntitled')
  }

  return (
    <Alert role="status" className="[&>svg]:size-5">
      <CircleCheck aria-hidden="true" className="text-primary" />
      <AlertDescription className="text-foreground text-base">
        {message}
      </AlertDescription>
    </Alert>
  )
}
