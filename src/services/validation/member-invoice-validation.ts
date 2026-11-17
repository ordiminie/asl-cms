import {z} from 'zod'

import {MAX_AMOUNT_CENTS} from '../rules/member-invoice-rules'
import {
  MEMBER_INVOICE_STATUS_MAX_LENGTH,
  MEMBER_INVOICE_YEAR_MAX,
  MEMBER_INVOICE_YEAR_MIN,
} from '../types/domain/member-invoice-types'
import {ownershipDateSchema} from './parcel-ownership-validation'

/**
 * Validation des factures saisies par le bureau (s19, ADR 059). Dates ISO
 * d'un jour qui existe ; montant en centimes entiers positifs ; echeance au
 * plus tot le jour de l'emission.
 */

const uuid = z.string().uuid()

const invoiceFieldsSchema = z.object({
  organizationId: uuid,
  parcelId: uuid,
  year: z
    .number()
    .int()
    .min(MEMBER_INVOICE_YEAR_MIN)
    .max(MEMBER_INVOICE_YEAR_MAX),
  issuedOn: ownershipDateSchema,
  dueOn: ownershipDateSchema,
  amountCents: z.number().int().positive().max(MAX_AMOUNT_CENTS),
  status: z.string().trim().min(1).max(MEMBER_INVOICE_STATUS_MAX_LENGTH),
})

const dueNotBeforeIssue = (fields: {issuedOn: string; dueOn: string}) =>
  fields.dueOn >= fields.issuedOn

export const createMemberInvoiceServiceSchema = invoiceFieldsSchema
  .extend({memberProfileId: uuid})
  .refine(dueNotBeforeIssue, {path: ['dueOn']})

export const updateMemberInvoiceServiceSchema = invoiceFieldsSchema
  .extend({invoiceId: uuid})
  .refine(dueNotBeforeIssue, {path: ['dueOn']})

export const memberInvoicesServiceSchema = z.object({
  organizationId: uuid,
  memberProfileId: uuid,
})

export const memberInvoiceServiceSchema = memberInvoicesServiceSchema.extend({
  invoiceId: uuid,
})

export const memberInvoiceOrganizationIdSchema = uuid
