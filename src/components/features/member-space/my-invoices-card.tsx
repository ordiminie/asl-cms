'use client'

import {Download, ExternalLink, Info} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState, useTransition} from 'react'

import {syncTimePartsOf} from '@/components/features/member-invoice/billing-sync-format'
import {InvoiceStatusBadge} from '@/components/features/member-invoice/invoice-status-badge'
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
  MyInvoiceDTO,
  MyInvoicePdfAction,
  MyInvoicesDTO,
} from '@/services/types/domain/member-space-types'

/** Lignes par page : 25 en tableau, 10 en cartes sous 640 px (§3.5). */
const TABLE_PAGE_SIZE = 25
const CARD_PAGE_SIZE = 10
const LOADING_LINES = [0, 1, 2]

const mono = (chunks: ReactNode) => (
  <span className="font-mono font-medium tabular-nums">{chunks}</span>
)

const openInSameTab = (url: string) => {
  window.location.assign(url)
}

/** Ce que les lignes partagent pour la colonne « Facture » (s20). */
type PdfColumn = {
  openPdfAction: MyInvoicePdfAction
  navigate: (url: string) => void
  /** Au clic : l'alerte d'un echec precedent s'efface. */
  onOpen: () => void
  onFailure: () => void
}

/**
 * « Mes factures » (s19, ecran 1 ; s20) : une seule liste pour tous les
 * terrains du compte, emission decroissante. Le statut s'ecrit par son
 * libelle, sinon tel que fourni ; aucun identifiant de fiche dans l'ecran.
 * Sous Pennylane : colonne « Facture » (le PDF est demande **au clic**,
 * jamais rendu dans la page), date de mise a jour, etats 1d, 1e et 1f.
 * Le reglement (s21) : colonne « Reglement » des qu'une facture est impayee,
 * un lien sortant « Payer » (nouvel onglet) ou « Par virement », et une
 * phrase unique qui renvoie au bureau. Aucun formulaire de paiement : le
 * lien est deja garde par le service, la carte ne relit rien d'autre.
 * Composant client pour la pagination et le bouton PDF.
 */
export function MyInvoicesCard({
  invoices,
  openPdfAction,
  navigate = openInSameTab,
}: {
  invoices: MyInvoicesDTO
  openPdfAction: MyInvoicePdfAction
  /** Ouverture de l'adresse du PDF ; injectable pour les tests. */
  navigate?: (url: string) => void
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const [pdfFailed, setPdfFailed] = useState(false)
  const pdfColumn: PdfColumn | undefined = invoices.syncedFromPennylane
    ? {
        openPdfAction,
        navigate,
        onOpen: () => setPdfFailed(false),
        onFailure: () => setPdfFailed(true),
      }
    : undefined
  const empty = invoices.invoices.length === 0
  const byTransfer = invoices.invoices.some(
    ({payment}) => payment?.kind === 'transfer'
  )

  return (
    <MyInvoicesSection>
      {invoices.lastSyncFailed && (
        <SyncFailedNotice syncedAt={invoices.syncedAt} />
      )}
      {invoices.unlinked && <p className="text-[17px]">{t('unlinked')}</p>}
      {pdfFailed && (
        <Alert role="alert" className="[&>svg]:size-5">
          <Info aria-hidden="true" />
          <AlertDescription className="text-foreground text-base">
            {t('pdf.failed')}
          </AlertDescription>
        </Alert>
      )}
      {empty ? (
        !invoices.unlinked && <p className="text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-[15px]">
            {t('intro', {count: invoices.landCount})}
          </p>
          {byTransfer && <TransferNotice />}
          <PagedInvoices invoices={invoices.invoices} pdfColumn={pdfColumn} />
        </>
      )}
      {invoices.syncedFromPennylane &&
        invoices.syncedAt &&
        !invoices.lastSyncFailed && (
          <p className="text-muted-foreground text-[14px]">
            {t('syncedAt', syncTimePartsOf(invoices.syncedAt))}
          </p>
        )}
    </MyInvoicesSection>
  )
}

/** 1d : la derniere mise a jour a echoue ; les factures sont celles d'avant. */
function SyncFailedNotice({syncedAt}: {syncedAt: string | null}) {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <Alert role="status" className="bg-muted [&>svg]:size-5">
      <Info aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        {syncedAt
          ? t('syncFailed', syncTimePartsOf(syncedAt))
          : t('syncFailedNever')}
      </AlertDescription>
    </Alert>
  )
}

/** 1b (s21) : une facture impayee se regle par virement ; renvoi au bureau. */
function TransferNotice() {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <Alert role="note" className="bg-muted [&>svg]:size-5">
      <Info aria-hidden="true" />
      <AlertDescription className="text-foreground text-base">
        <p>
          {t.rich('payment.notice', {
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
      </AlertDescription>
    </Alert>
  )
}

/** Chargement (1c) : trois lignes en `skeleton`. */
export function MyInvoicesCardLoading() {
  return (
    <MyInvoicesSection busy>
      {LOADING_LINES.map((line) => (
        <Skeleton key={line} className="bg-muted h-14 w-full" />
      ))}
    </MyInvoicesSection>
  )
}

function MyInvoicesSection({
  busy = false,
  children,
}: {
  busy?: boolean
  children: ReactNode
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} aria-busy={busy || undefined}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <h2 id={titleId} className="font-serif text-xl font-semibold">
          {t('title')}
        </h2>
        {children}
        {!busy && (
          <p className="border-t pt-4 text-[17px]">
            {t('mistake')}{' '}
            <Link
              href="/contact"
              className="text-primary font-semibold underline underline-offset-4"
            >
              {t('contact')}
            </Link>
          </p>
        )}
      </Card>
    </section>
  )
}

const pageOf = <T,>(rows: readonly T[], page: number, size: number): T[] =>
  rows.slice((page - 1) * size, page * size)

function PagedInvoices({
  invoices,
  pdfColumn,
}: {
  invoices: MyInvoiceDTO[]
  pdfColumn?: PdfColumn
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const [tablePage, setTablePage] = useState(1)
  const [cardPage, setCardPage] = useState(1)
  const paymentColumn = invoices.some(({payment}) => payment !== null)

  return (
    <>
      <div className="hidden flex-col gap-3 sm:flex">
        <Table aria-label={t('caption')}>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>{t('columns.issuedOn')}</TableHead>
              <TableHead>{t('columns.subject')}</TableHead>
              <TableHead>{t('columns.land')}</TableHead>
              <TableHead className="text-right">
                {t('columns.amount')}
              </TableHead>
              <TableHead>{t('columns.dueOn')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              {paymentColumn && <TableHead>{t('columns.payment')}</TableHead>}
              {pdfColumn && <TableHead>{t('columns.invoice')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageOf(invoices, tablePage, TABLE_PAGE_SIZE).map(
              (invoice, index) => (
                <TableRow key={index} className="h-14">
                  <TableCell className="font-mono tabular-nums">
                    {isoToFrenchDate(invoice.issuedOn)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {invoice.subject}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <InvoiceLand invoice={invoice} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {t('amount', {
                      amount: formatAmountCents(invoice.amountCents),
                    })}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {isoToFrenchDate(invoice.dueOn)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge
                      status={invoice.statusLabel}
                      statusClass={invoice.statusClass}
                    />
                  </TableCell>
                  {paymentColumn && (
                    <TableCell>
                      <InvoicePayment invoice={invoice} className="h-11" />
                    </TableCell>
                  )}
                  {pdfColumn && (
                    <TableCell>
                      <InvoicePdf
                        invoice={invoice}
                        column={pdfColumn}
                        className="h-11"
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
        <Pager
          page={tablePage}
          pageSize={TABLE_PAGE_SIZE}
          total={invoices.length}
          onPage={setTablePage}
        />
      </div>
      <div className="flex flex-col gap-3 sm:hidden">
        <ul className="flex flex-col gap-3">
          {pageOf(invoices, cardPage, CARD_PAGE_SIZE).map((invoice, index) => (
            <li key={index}>
              <InvoiceCard invoice={invoice} pdfColumn={pdfColumn} />
            </li>
          ))}
        </ul>
        <Pager
          page={cardPage}
          pageSize={CARD_PAGE_SIZE}
          total={invoices.length}
          onPage={setCardPage}
        />
      </div>
    </>
  )
}

const PARCEL_LIST = new Intl.ListFormat('fr', {
  style: 'long',
  type: 'conjunction',
})

/**
 * Le terrain facture : « Parcelle 27 », « Parcelles 12 et 13 » (s20), le
 * compteur, et le nom de la fiche s'il differe du compte.
 */
function InvoiceLand({invoice}: {invoice: MyInvoiceDTO}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const [single] = invoice.parcelNumbers

  return (
    <span className="flex flex-col">
      <span>
        {invoice.parcelNumbers.length === 0
          ? t('landMissing')
          : invoice.parcelNumbers.length === 1
            ? t.rich('parcel', {number: single, mono})
            : t.rich('parcels', {
                numbers: PARCEL_LIST.format(invoice.parcelNumbers),
                mono,
              })}
      </span>
      <span className="text-muted-foreground text-[15px]">
        {invoice.meterNumber
          ? t.rich('meter', {number: invoice.meterNumber, mono})
          : t('meterMissing')}
      </span>
      {invoice.holderName && (
        <span className="text-muted-foreground text-[15px]">
          {t('holder', {name: invoice.holderName})}
        </span>
      )}
    </span>
  )
}

/** Le terrain en mots, pour le nom accessible du bouton PDF. */
const landLabelOf = (
  invoice: MyInvoiceDTO,
  t: ReturnType<typeof useTranslations>
): string =>
  invoice.parcelNumbers.length === 0
    ? t('landMissing')
    : t('pdf.land', {
        count: invoice.parcelNumbers.length,
        numbers: PARCEL_LIST.format(invoice.parcelNumbers),
      })

/**
 * La colonne « Facture » (s20, criteres 7 et 8) : un bouton quand la source
 * fournit un PDF, sinon la mention ecrite, sans bouton. L'adresse est
 * demandee a l'action au clic, puis ouverte dans le meme onglet.
 */
function InvoicePdf({
  invoice,
  column,
  className,
  mobile = false,
}: {
  invoice: MyInvoiceDTO
  column: PdfColumn
  className: string
  mobile?: boolean
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const [pending, startTransition] = useTransition()
  const {pdfRef} = invoice

  if (!invoice.hasPdf || !pdfRef) {
    return (
      <span className="text-muted-foreground text-[15px]">
        {t('pdf.unavailable')}
      </span>
    )
  }

  const open = () => {
    column.onOpen()
    startTransition(async () => {
      const result = await column.openPdfAction(pdfRef)
      if (result.status === 'ready') {
        column.navigate(result.url)
      } else {
        column.onFailure()
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={pending}
      aria-label={t('pdf.label', {
        year: invoice.issuedOn.slice(0, 4),
        land: landLabelOf(invoice, t),
      })}
      onClick={open}
    >
      <Download aria-hidden="true" />
      {mobile ? t('pdf.buttonMobile') : t('pdf.button')}
    </Button>
  )
}

/**
 * Le reglement d'une facture (s21, criteres 1, 3 et 5) : un lien sortant vers
 * la page de paiement du fournisseur, dans un nouvel onglet annonce ; la
 * mention du virement, sans bouton ; rien pour une facture qui n'est pas
 * impayee.
 */
function InvoicePayment({
  invoice,
  className,
  mobile = false,
}: {
  invoice: MyInvoiceDTO
  className: string
  mobile?: boolean
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const {payment} = invoice

  if (!payment) return null
  if (payment.kind === 'transfer') {
    return (
      <span className="text-muted-foreground text-[15px]">
        {mobile ? t('payment.transferMobile') : t('payment.transfer')}
      </span>
    )
  }
  return (
    <Button asChild className={className}>
      <a
        href={payment.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('payment.label', {
          year: invoice.issuedOn.slice(0, 4),
          land: landLabelOf(invoice, t),
        })}
      >
        <ExternalLink aria-hidden="true" />
        {mobile ? t('payment.buttonMobile') : t('payment.button')}
      </a>
    </Button>
  )
}

/** Une facture sous 640 px (§3.5) : l'objet, le badge, puis les paires. */
function InvoiceCard({
  invoice,
  pdfColumn,
}: {
  invoice: MyInvoiceDTO
  pdfColumn?: PdfColumn
}) {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <div
      data-testid="my-invoice-card"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-[17px] font-semibold">{invoice.subject}</p>
      <InvoiceStatusBadge
        status={invoice.statusLabel}
        statusClass={invoice.statusClass}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[17px]">
        <dt className="text-muted-foreground">{t('columns.issuedOn')}</dt>
        <dd className="font-mono tabular-nums">
          {isoToFrenchDate(invoice.issuedOn)}
        </dd>
        <dt className="text-muted-foreground">{t('columns.land')}</dt>
        <dd>
          <InvoiceLand invoice={invoice} />
        </dd>
        <dt className="text-muted-foreground">{t('columns.amount')}</dt>
        <dd className="font-mono font-semibold tabular-nums">
          {t('amount', {amount: formatAmountCents(invoice.amountCents)})}
        </dd>
        <dt className="text-muted-foreground">{t('columns.dueOn')}</dt>
        <dd className="font-mono tabular-nums">
          {isoToFrenchDate(invoice.dueOn)}
        </dd>
      </dl>
      <InvoicePayment
        invoice={invoice}
        className="h-14 w-full text-base"
        mobile
      />
      {pdfColumn && (
        <InvoicePdf
          invoice={invoice}
          column={pdfColumn}
          className="h-14 w-full text-base"
          mobile
        />
      )}
    </div>
  )
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const position = t('page', {page, total: pages})

  return (
    <nav className="flex flex-col gap-3" aria-label={position}>
      <p className="text-muted-foreground flex justify-between text-[14px]">
        <span>{t('range', {from, to, total})}</span>
        <span>{position}</span>
      </p>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-14 sm:h-12"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t('previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-14 sm:h-12"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </nav>
  )
}
