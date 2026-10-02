import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageMemberProfilesService,
  getMemberProfilePageService,
  getMemberProfileService,
} from '@/services/facades/member-profile-service-facade'
import {
  getMemberParcelsService,
  getSaleContextService,
} from '@/services/facades/parcel-ownership-service-facade'
import {
  MemberProfileDTO,
  MemberProfilePageDTO,
} from '@/services/types/domain/member-profile-types'
import {
  MemberParcelsDTO,
  SaleContextDTO,
} from '@/services/types/domain/parcel-ownership-types'

/**
 * Fiches des proprietaires et leurs parcelles (s12). **Aucun `'use cache'`** :
 * ce sont des donnees personnelles d'administration, qui se streament derriere
 * un `<Suspense>`. Le service ouvre lui-meme le scope du tenant
 * (`withTenant`) pour l'association passee, celle du domaine appele (patron
 * `incident-report-dal.ts`).
 */
export const getMemberProfilesPageForBureauDal = cache(
  async (
    organizationId: string,
    page: number,
    search?: string
  ): Promise<MemberProfilePageDTO> =>
    getMemberProfilePageService({organizationId, page, search})
)

/**
 * L'utilisateur connecte peut-il gerer les fiches des proprietaires de
 * l'association du domaine appele ? Donnee par utilisateur : jamais cachee
 * au-dela de la requete.
 */
export const canManageCurrentMemberProfilesDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageMemberProfilesService(tenant.id)
  }
)

/**
 * Une fiche du bureau. L'absence, ou un identifiant malforme qui ne peut
 * designer aucune fiche, devient `undefined`, que l'appelant traduit en 404 :
 * un refus ou une panne remonte. Une fiche d'une autre association est
 * absente : la RLS ne la rend pas.
 */
export const getMemberProfileForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<MemberProfileDTO | undefined> =>
    getMemberProfileService(organizationId, memberProfileId).catch(
      (error: unknown) => {
        if (error instanceof ValidationParsedZodError) return undefined
        throw error
      }
    )
)

/** Les parcelles actuelles et anciennes d'une fiche. */
export const getMemberParcelsForBureauDal = cache(
  async (
    organizationId: string,
    memberProfileId: string
  ): Promise<MemberParcelsDTO> =>
    getMemberParcelsService(organizationId, memberProfileId)
)

/**
 * Le contexte de l'ecran de vente : la parcelle, le vendeur et les periodes
 * de la parcelle. `undefined` — que la page traduit en 404 — quand la fiche ne
 * possede pas la parcelle, ou pour un identifiant malforme.
 */
export const getSaleContextForBureauDal = cache(
  async (
    organizationId: string,
    sellerId: string,
    parcelId: string
  ): Promise<SaleContextDTO | undefined> =>
    getSaleContextService(organizationId, sellerId, parcelId).catch(
      (error: unknown) => {
        if (error instanceof ValidationParsedZodError) return undefined
        throw error
      }
    )
)
