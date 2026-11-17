import {Info} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

import {Alert, AlertDescription} from '@/components/ui/alert'
import {Card} from '@/components/ui/card'
import {isoToFrenchDate} from '@/components/ui/date-field-format'
import {formatAmountCents} from '@/services/rules/member-invoice-rules'
import type {BoardInvoiceDTO} from '@/services/types/domain/member-invoice-types'

import {InvoiceStatusBadge} from './invoice-status-badge'
import {BackToProfile, InvoiceBreadcrumb} from './member-invoice-form'

const DATA_CLASS = 'font-mono font-medium tabular-nums'

/**
 * Une facture qui ne se corrige pas sur le site (s19, ecran 3d) : venue de
 * Pennylane, ou fournisseur qui ne permet pas la saisie. Des paires en
 * lecture, **aucun formulaire** ; pour Pennylane, l'alerte neutre le dit.
 */
export function MemberInvoiceReadOnly({
  memberProfile,
  invoice,
}: {
  memberProfile: {id: string; name: string}
  invoice: BoardInvoiceDTO
}) {
  const t = useTranslations('BureauMemberInvoices')
  const date = isoToFrenchDate(invoice.issuedOn)

  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <InvoiceBreadcrumb
        memberProfile={memberProfile}
        current={t('form.breadcrumbEdit', {date})}
      />
      <h1 className="font-serif text-[34px] leading-tight font-semibold">
        {t('form.readTitle', {date})}
      </h1>
      {invoice.source === 'pennylane' && (
        <Alert className="bg-muted [&>svg]:size-5">
          <Info aria-hidden="true" />
          <AlertDescription className="text-foreground text-[17px]">
            {t('readOnly.notice')}
          </AlertDescription>
        </Alert>
      )}
      <Card className="px-4 py-6 shadow-none sm:px-8">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[17px] sm:grid-cols-[auto_1fr]">
          <Pair label={t('form.parcel.label')}>
            {t('form.parcel.option', {number: invoice.parcelNumber})}
          </Pair>
          <Pair label={t('card.columns.subject')}>{invoice.subject}</Pair>
          <Pair label={t('form.amount.label')}>
            <span className={DATA_CLASS}>
              {t('card.amount', {
                amount: formatAmountCents(invoice.amountCents),
              })}
            </span>
          </Pair>
          <Pair label={t('form.issuedOn.label')}>
            <span className={DATA_CLASS}>{date}</span>
          </Pair>
          <Pair label={t('form.dueOn.label')}>
            <span className={DATA_CLASS}>{isoToFrenchDate(invoice.dueOn)}</span>
          </Pair>
          <Pair label={t('form.status.label')}>
            <InvoiceStatusBadge
              status={invoice.status}
              statusClass={invoice.statusClass}
            />
          </Pair>
          <Pair label={t('form.source')}>
            {t(`card.sources.${invoice.source}`)}
          </Pair>
        </dl>
      </Card>
      <BackToProfile memberProfileId={memberProfile.id} />
    </div>
  )
}

function Pair({label, children}: {label: string; children: ReactNode}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}
