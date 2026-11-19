'use client'

import {CircleCheck} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, Suspense, use} from 'react'

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
import {formatAmountCents} from '@/services/rules/member-invoice-rules'
import type {
  BoardInvoiceDTO,
  BoardMemberInvoicesDTO,
} from '@/services/types/domain/member-invoice-types'

import {syncTimePartsOf} from './billing-sync-format'
import {InvoiceStatusBadge} from './invoice-status-badge'
import {
  memberInvoicePathOf,
  newMemberInvoicePathOf,
} from './member-invoice-paths'

const DATA_CLASS = 'font-mono font-medium tabular-nums'

const mono = (chunks: ReactNode) => <span className={DATA_CLASS}>{chunks}</span>

type MemberInvoicesCardProps = {
  memberProfileId: string
  memberName: string
  invoices: BoardMemberInvoicesDTO
  /** Une facture vient d'etre enregistree : le dire une fois (3c). */
  saved: boolean
}

/**
 * La carte « Factures » de la fiche, lue sans etre attendue : rien pour un
 * compte qui ne gere pas les factures (ecran 2, carte absente).
 */
export function MemberInvoicesSection({
  invoicesPromise,
  ...props
}: Omit<MemberInvoicesCardProps, 'invoices'> & {
  invoicesPromise: Promise<BoardMemberInvoicesDTO | undefined>
}) {
  return (
    <Suspense fallback={<Skeleton className="bg-muted h-48 w-full" />}>
      <MemberInvoicesFromPromise invoicesPromise={invoicesPromise} {...props} />
    </Suspense>
  )
}

function MemberInvoicesFromPromise({
  invoicesPromise,
  ...props
}: Omit<MemberInvoicesCardProps, 'invoices'> & {
  invoicesPromise: Promise<BoardMemberInvoicesDTO | undefined>
}) {
  const invoices = use(invoicesPromise)
  if (!invoices) return null

  return <MemberInvoicesCard invoices={invoices} {...props} />
}

/**
 * Factures d'une fiche (s19, ecran 2) : source ecrite, statut brut. Une seule
 * action par ligne, « Modifier », pour une facture **saisie sur le site** ;
 * une facture Pennylane se lit, sans action. « Ajouter une facture » et
 * « Modifier » n'existent que si le fournisseur de l'association permet la
 * saisie.
 */
export function MemberInvoicesCard({
  memberProfileId,
  memberName,
  invoices,
  saved,
}: MemberInvoicesCardProps) {
  const t = useTranslations('BureauMemberInvoices.card')
  const editable = (invoice: BoardInvoiceDTO) =>
    invoices.canWrite && invoice.source === 'site'

  return (
    <DetailCard title={t('title')}>
      {saved && (
        <Alert role="status" className="[&>svg]:size-5">
          <CircleCheck aria-hidden="true" className="text-primary" />
          <AlertDescription className="text-foreground text-base">
            {t('saved', {name: memberName})}
          </AlertDescription>
        </Alert>
      )}
      {invoices.syncedFromPennylane && (
        <p className="text-muted-foreground text-[15px]">
          {invoices.syncedAt
            ? t('pennylane.readOnlySince', syncTimePartsOf(invoices.syncedAt))
            : t('pennylane.readOnlyNever')}
        </p>
      )}
      {invoices.invoices.length === 0 ? (
        <p className="text-muted-foreground text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table aria-label={t('caption', {name: memberName})}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.issuedOn')}</TableHead>
                  <TableHead>{t('columns.subject')}</TableHead>
                  <TableHead className="text-right">
                    {t('columns.amount')}
                  </TableHead>
                  <TableHead>{t('columns.dueOn')}</TableHead>
                  <TableHead>{t('columns.status')}</TableHead>
                  <TableHead>{t('columns.source')}</TableHead>
                  <TableHead>{t('columns.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="h-14">
                    <TableCell className={DATA_CLASS}>
                      {isoToFrenchDate(invoice.issuedOn)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="flex flex-col">
                        <span>{invoice.subject}</span>
                        {invoice.parcelNumber && (
                          <span className="text-muted-foreground text-[15px]">
                            {t.rich('parcel', {
                              number: invoice.parcelNumber,
                              mono,
                            })}
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className={`${DATA_CLASS} text-right`}>
                      {t('amount', {
                        amount: formatAmountCents(invoice.amountCents),
                      })}
                    </TableCell>
                    <TableCell className={DATA_CLASS}>
                      {isoToFrenchDate(invoice.dueOn)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge
                        status={invoice.status}
                        statusClass={invoice.statusClass}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <InvoiceSource
                        invoice={invoice}
                        readOnly={!editable(invoice)}
                      />
                    </TableCell>
                    <TableCell>
                      {editable(invoice) && (
                        <EditLink
                          memberProfileId={memberProfileId}
                          invoice={invoice}
                          className="h-11"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col gap-4 sm:hidden">
            {invoices.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Card className="gap-3 px-4 py-4 shadow-none">
                  <p className="text-[17px] font-semibold">{invoice.subject}</p>
                  <InvoiceStatusBadge
                    status={invoice.status}
                    statusClass={invoice.statusClass}
                  />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
                    <dt className="text-muted-foreground">
                      {t('columns.issuedOn')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {isoToFrenchDate(invoice.issuedOn)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('columns.amount')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {t('amount', {
                        amount: formatAmountCents(invoice.amountCents),
                      })}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('columns.dueOn')}
                    </dt>
                    <dd className={DATA_CLASS}>
                      {isoToFrenchDate(invoice.dueOn)}
                    </dd>
                    <dt className="text-muted-foreground">
                      {t('columns.source')}
                    </dt>
                    <dd>
                      <InvoiceSource
                        invoice={invoice}
                        readOnly={!editable(invoice)}
                      />
                    </dd>
                  </dl>
                  {editable(invoice) && (
                    <EditLink
                      memberProfileId={memberProfileId}
                      invoice={invoice}
                      className="h-14 w-full"
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      {invoices.canWrite && (
        <Button
          asChild
          className="h-14 w-full text-base sm:h-12 sm:w-auto sm:self-start"
        >
          <Link href={newMemberInvoicePathOf(memberProfileId)}>{t('add')}</Link>
        </Button>
      )}
    </DetailCard>
  )
}

/**
 * La source, en mots, avec « Lecture seule » quand la facture ne se corrige
 * pas ici : Pennylane, ou une facture du site sous un fournisseur en lecture
 * seule (s20).
 */
function InvoiceSource({
  invoice,
  readOnly,
}: {
  invoice: BoardInvoiceDTO
  readOnly: boolean
}) {
  const t = useTranslations('BureauMemberInvoices.card')

  return (
    <span className="flex flex-col">
      <span>{t(`sources.${invoice.source}`)}</span>
      {readOnly && (
        <span className="text-muted-foreground text-[15px]">
          {t('readOnly')}
        </span>
      )}
    </span>
  )
}

function EditLink({
  memberProfileId,
  invoice,
  className,
}: {
  memberProfileId: string
  invoice: BoardInvoiceDTO
  className: string
}) {
  const t = useTranslations('BureauMemberInvoices.card')

  return (
    <Button asChild variant="outline" className={className}>
      <Link
        href={memberInvoicePathOf(memberProfileId, invoice.id)}
        aria-label={t('editLabel', {date: isoToFrenchDate(invoice.issuedOn)})}
      >
        {t('edit')}
      </Link>
    </Button>
  )
}
