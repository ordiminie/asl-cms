import {z} from 'zod'

/**
 * Schemas a **liste blanche** des reponses de l'API Pennylane v2 (s20, ADR
 * 062 §9). Zod retire tout champ hors liste : les moyens de paiement que
 * `/customers` expose (`billing_iban`, `mandates`...) ne sortent jamais de ce
 * module, ni l'adresse du PDF d'une facture, reduite a sa presence. Un champ
 * ajoute ici passe par la revue (critere 10).
 */

const identifierSchema = z.union([z.number().int(), z.string().min(1)])

/** Une chaine vide ou absente vaut « non renseigne ». */
const optionalTextSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  })

/**
 * Vrai pour une adresse absolue en `https` seulement (revue m4) : l'adresse
 * du PDF est ouverte telle quelle dans le navigateur du membre.
 */
export const isHttpsUrl = (value: string): boolean => {
  if (!URL.canParse(value)) return false
  return new URL(value).protocol === 'https:'
}

/** L'adresse du PDF : hors `https`, elle vaut « pas de PDF », jamais une erreur. */
const fileUrlSchema = optionalTextSchema.transform((value) =>
  value !== null && isHttpsUrl(value) ? value : null
)

export const pennylaneCustomerSchema = z.object({
  id: identifierSchema,
  name: z.string().nullish(),
  reference: optionalTextSchema,
  external_reference: optionalTextSchema,
})

export const pennylaneInvoiceSchema = z.object({
  id: identifierSchema,
  invoice_number: optionalTextSchema,
  status: z.string(),
  draft: z.boolean(),
  date: optionalTextSchema,
  deadline: optionalTextSchema,
  amount: z.string(),
  currency: z.string(),
  customer: z.object({id: identifierSchema}).nullish(),
  public_file_url: fileUrlSchema,
  pdf_invoice_free_text: optionalTextSchema,
})

export const pennylanePageSchema = z.object({
  items: z.array(z.unknown()),
  next_cursor: z.string().nullish(),
})

/** Un client Pennylane tel que le module le rend. */
export type PennylaneCustomer = {
  id: string
  /**
   * La cle de rapprochement (ADR 062 §2) : l'« Identifiant Client » importe
   * sur la fiche. Jamais `id`, jamais `reference`.
   */
  externalReference: string | null
  name: string
  /** La « Reference Client », non unique : affichee, jamais une cle. */
  reference: string | null
}

/**
 * Une facture Pennylane telle que le module la rend. `amount` reste la chaine
 * decimale de l'API ; `freeText` sert au controle du terrain et n'est jamais
 * stocke ni montre au membre (ADR 062 §4).
 */
export type PennylaneInvoice = {
  id: string
  invoiceNumber: string | null
  status: string
  draft: boolean
  date: string | null
  deadline: string | null
  amount: string
  currency: string
  customerId: string | null
  hasPdf: boolean
  freeText: string | null
}

export const toPennylaneCustomer = (
  raw: z.infer<typeof pennylaneCustomerSchema>
): PennylaneCustomer => ({
  id: String(raw.id),
  externalReference: raw.external_reference,
  name: raw.name ?? '',
  reference: raw.reference,
})

export const toPennylaneInvoice = (
  raw: z.infer<typeof pennylaneInvoiceSchema>
): PennylaneInvoice => ({
  id: String(raw.id),
  invoiceNumber: raw.invoice_number,
  status: raw.status,
  draft: raw.draft,
  date: raw.date,
  deadline: raw.deadline,
  amount: raw.amount,
  currency: raw.currency,
  customerId: raw.customer ? String(raw.customer.id) : null,
  hasPdf: raw.public_file_url !== null,
  freeText: raw.pdf_invoice_free_text,
})
