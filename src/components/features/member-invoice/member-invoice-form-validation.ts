import {z} from 'zod'

import {frenchDateToIso} from '@/components/ui/date-field-format'
import {parseAmountToCents} from '@/services/rules/member-invoice-rules'
import {
  MEMBER_INVOICE_YEAR_MAX,
  MEMBER_INVOICE_YEAR_MIN,
} from '@/services/types/domain/member-invoice-types'

/**
 * Formulaire d'une facture saisie par le bureau (s19, ecran 3). Partage par le
 * client et par l'action serveur. Montant saisi en euros (« 412,50 »), dates
 * `jj/mm/aaaa`, statut choisi parmi ceux des reglages ; l'objet n'est pas
 * saisi, il est compose depuis le reglage du tenant et l'annee.
 */
type Translate = (key: string, values?: Record<string, string>) => string

export const memberInvoiceFormSchema = z.object({
  parcelId: z.string(),
  year: z.string(),
  amount: z.string(),
  issuedOn: z.string(),
  dueOn: z.string(),
  status: z.string(),
})

export type MemberInvoiceFormSchemaType = z.infer<
  typeof memberInvoiceFormSchema
>

export const MEMBER_INVOICE_FORM_FIELDS = [
  'parcelId',
  'year',
  'amount',
  'issuedOn',
  'dueOn',
  'status',
] as const satisfies readonly (keyof MemberInvoiceFormSchemaType)[]

export type MemberInvoiceFormField = (typeof MEMBER_INVOICE_FORM_FIELDS)[number]

const YEAR_PATTERN = /^\d{4}$/

const isYear = (value: string): boolean => {
  if (!YEAR_PATTERN.test(value.trim())) return false
  const year = Number(value)
  return year >= MEMBER_INVOICE_YEAR_MIN && year <= MEMBER_INVOICE_YEAR_MAX
}

const isDate = (value: string): boolean => frenchDateToIso(value) !== undefined

export function createMemberInvoiceFormSchema(t: Translate) {
  return memberInvoiceFormSchema
    .extend({
      parcelId: z.string().refine((value) => value.trim() !== '', {
        message: t('validation.parcelRequired'),
      }),
      year: z.string().refine(isYear, {message: t('validation.year')}),
      amount: z
        .string()
        .refine((value) => parseAmountToCents(value) !== undefined, {
          message: t('validation.amount'),
        }),
      issuedOn: z.string().refine(isDate, {message: t('validation.date')}),
      dueOn: z.string().refine(isDate, {message: t('validation.date')}),
      status: z.string().refine((value) => value.trim() !== '', {
        message: t('validation.statusRequired'),
      }),
    })
    .superRefine((values, ctx) => {
      const issuedOn = frenchDateToIso(values.issuedOn)
      const dueOn = frenchDateToIso(values.dueOn)
      if (issuedOn && dueOn && dueOn < issuedOn) {
        ctx.addIssue({
          code: 'custom',
          path: ['dueOn'],
          message: t('validation.dueBeforeIssue', {date: values.issuedOn}),
        })
      }
    })
}

/** Les champs valides, sous la forme que le service attend. */
export const toMemberInvoiceFields = (values: MemberInvoiceFormSchemaType) => ({
  parcelId: values.parcelId,
  year: Number(values.year),
  amountCents: parseAmountToCents(values.amount) ?? 0,
  issuedOn: frenchDateToIso(values.issuedOn) ?? '',
  dueOn: frenchDateToIso(values.dueOn) ?? '',
  status: values.status.trim(),
})

/** Resultat d'une saisie, rendu par la Server Action. Un refus n'ecrit rien. */
export type MemberInvoiceActionResult =
  | {status: 'saved'}
  | {
      status: 'invalid'
      errors: {field: MemberInvoiceFormField; message: string}[]
    }
  /** Facture Pennylane : la modification est refusee par le serveur (3d). */
  | {status: 'read_only'}
  | {status: 'error'; message: string}

export type MemberInvoiceFormAction = (
  prevState: MemberInvoiceActionResult | undefined,
  formData: FormData
) => Promise<MemberInvoiceActionResult>
