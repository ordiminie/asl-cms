import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageMemberInvoicesService,
  getMemberInvoiceService,
  listMemberInvoicesService,
} from '@/services/facades/member-invoice-service-facade'
import type {
  BoardInvoiceDTO,
  BoardMemberInvoicesDTO,
} from '@/services/types/domain/member-invoice-types'

/**
 * Factures des membres dans le back-office (s19). **Jamais de `'use cache'`** :
 * donnee personnelle (ADR 038), streamee derriere un `<Suspense>`. `cache()`
 * deduplique dans la requete. Le service ouvre le scope du tenant passe,
 * celui du domaine appele.
 */

/** Le compte connecte gere-t-il les factures de l'association du domaine ? */
export const canManageCurrentMemberInvoicesDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageMemberInvoicesService(tenant.id)
  }
)

/**
 * Les factures d'une fiche ; rien pour un compte qui ne gere pas les
 * factures : la carte n'est alors pas rendue (ecran 2).
 */
export const getMemberInvoicesForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<BoardMemberInvoicesDTO | undefined> => {
    if (!(await canManageMemberInvoicesService(organizationId))) {
      return undefined
    }
    return listMemberInvoicesService(organizationId, memberProfileId)
  }
)

/**
 * Une facture de la fiche, ou rien (identifiant forge, autre fiche). Un
 * identifiant malforme, qui ne peut designer aucune facture, devient aussi
 * `undefined`, que la page traduit en 404 : un refus ou une panne remonte.
 */
export const getMemberInvoiceForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string,
    invoiceId: string
  ): Promise<BoardInvoiceDTO | undefined> =>
    getMemberInvoiceService(organizationId, memberProfileId, invoiceId).catch(
      (error: unknown) => {
        if (error instanceof ValidationParsedZodError) return undefined
        throw error
      }
    )
)
