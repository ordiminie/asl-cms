'use client'

import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {type ReactNode, useId, useState} from 'react'

import {InvoiceStatusBadge} from '@/components/features/member-invoice/invoice-status-badge'
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
  MyInvoicesDTO,
} from '@/services/types/domain/member-space-types'

/** Lignes par page : 25 en tableau, 10 en cartes sous 640 px (§3.5). */
const TABLE_PAGE_SIZE = 25
const CARD_PAGE_SIZE = 10
const LOADING_LINES = [0, 1, 2]

const mono = (chunks: ReactNode) => (
  <span className="font-mono font-medium tabular-nums">{chunks}</span>
)

/**
 * « Mes factures » (s19, ecran 1) : une seule liste pour tous les terrains du
 * compte, emission decroissante. Le statut s'ecrit tel que fourni ; aucune
 * action par ligne, aucun identifiant dans l'ecran. Composant client pour la
 * seule pagination, au-dela de 25 lignes (10 cartes sous 640 px).
 */
export function MyInvoicesCard({invoices}: {invoices: MyInvoicesDTO}) {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <MyInvoicesSection>
      {invoices.invoices.length === 0 ? (
        <p className="text-[17px]">{t('empty')}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-[15px]">
            {t('intro', {count: invoices.landCount})}
          </p>
          <PagedInvoices invoices={invoices.invoices} />
        </>
      )}
    </MyInvoicesSection>
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

function PagedInvoices({invoices}: {invoices: MyInvoiceDTO[]}) {
  const t = useTranslations('MemberSpacePage.invoices')
  const [tablePage, setTablePage] = useState(1)
  const [cardPage, setCardPage] = useState(1)

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
                      status={invoice.status}
                      statusClass={invoice.statusClass}
                    />
                  </TableCell>
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
              <InvoiceCard invoice={invoice} />
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

/** Le terrain facture : parcelle, compteur, et le nom de la fiche s'il differe. */
function InvoiceLand({invoice}: {invoice: MyInvoiceDTO}) {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <span className="flex flex-col">
      <span>{t.rich('parcel', {number: invoice.parcelNumber, mono})}</span>
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

/** Une facture sous 640 px (§3.5) : l'objet, le badge, puis les paires. */
function InvoiceCard({invoice}: {invoice: MyInvoiceDTO}) {
  const t = useTranslations('MemberSpacePage.invoices')

  return (
    <div
      data-testid="my-invoice-card"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="text-[17px] font-semibold">{invoice.subject}</p>
      <InvoiceStatusBadge
        status={invoice.status}
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
