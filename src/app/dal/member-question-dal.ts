import 'server-only'

import {cache} from 'react'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {NotFoundError} from '@/services/errors/not-found-error'
import {ValidationParsedZodError} from '@/services/errors/validation-error'
import {
  canManageMemberQuestionsService,
  getMemberQuestionService,
  getMemberQuestionsPageService,
  getMyQuestionIdentityService,
  listMyQuestionCategoriesService,
} from '@/services/facades/member-question-service-facade'
import type {PublicCategoryDTO} from '@/services/types/domain/association-category-types'
import {
  MemberQuestionDTO,
  MemberQuestionListPageDTO,
  MyQuestionIdentityDTO,
} from '@/services/types/domain/member-question-types'

/**
 * Questions des membres au bureau (s23). **Aucun `'use cache'`** : donnees
 * par utilisateur (cote membre) ou d'administration (cote bureau), streamees
 * derriere un `<Suspense>`. `cache()` dedoublonne dans la requete.
 */

/** Les sujets ouverts aux questions, sur l'association du domaine appele. */
export const getMyQuestionCategoriesDal = cache(
  async (): Promise<PublicCategoryDTO[] | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return listMyQuestionCategoriesService(tenant.id)
  }
)

/** Ce que le bureau recevra du membre connecte : nom et email de sa fiche. */
export const getMyQuestionIdentityDal = cache(
  async (): Promise<MyQuestionIdentityDTO | undefined> => {
    const tenant = await requireCurrentTenantDal()
    return getMyQuestionIdentityService(tenant.id)
  }
)

/** Une page de la file du bureau, pour l'association du domaine appele. */
export const getMemberQuestionsForBureauDal = cache(
  async (
    organizationId: string,
    page: number
  ): Promise<MemberQuestionListPageDTO> =>
    getMemberQuestionsPageService(organizationId, page)
)

/**
 * Une question du bureau. L'absence, ou un identifiant malforme, devient
 * `undefined`, que l'appelant traduit en 404 : un refus ou une panne remonte.
 */
export const getMemberQuestionForBureauDal = cache(
  async (
    organizationId: string,
    questionId: string
  ): Promise<MemberQuestionDTO | undefined> =>
    getMemberQuestionService(organizationId, questionId).catch(
      (error: unknown) => {
        if (
          error instanceof NotFoundError ||
          error instanceof ValidationParsedZodError
        )
          return undefined
        throw error
      }
    )
)

/**
 * L'utilisateur connecte consulte-t-il les questions de l'association du
 * domaine appele ? Donnee par utilisateur : jamais cachee au-dela de la
 * requete.
 */
export const canManageCurrentMemberQuestionsDal = cache(
  async (): Promise<boolean> => {
    const tenant = await requireCurrentTenantDal()
    return canManageMemberQuestionsService(tenant.id)
  }
)
