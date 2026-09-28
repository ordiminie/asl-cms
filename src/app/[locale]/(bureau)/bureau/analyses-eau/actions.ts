'use server'

import {updateTag} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {waterAnalysisListTag} from '@/app/dal/water-analysis-dal'
import type {WaterAnalysisFormState} from '@/components/features/water-analysis/water-analysis-form'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  deleteWaterAnalysisService,
  publishWaterAnalysisService,
  updateWaterAnalysisService,
} from '@/services/facades/water-analysis-service-facade'
import {calendarDayOf} from '@/services/types/domain/water-analysis-types'

/**
 * Server Actions des ecrans « Analyses d'eau » du bureau (s09, ADR 026),
 * partagees par la liste, la publication et la correction.
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant la facade
 * — le service reverifie l'autorisation de son cote — puis invalide la liste
 * publique **apres** le succes seulement. Un refus est rendu comme un
 * resultat, jamais leve. Le retour a la liste se fait par `redirect()`
 * **hors du `try`** : il leve `NEXT_REDIRECT`, qu'un `catch` avalerait.
 */

const LIST_PATH = '/bureau/analyses-eau'

const failure = async (
  error: unknown,
  failedKey: 'failed' | 'deleteFailed' = 'failed'
): Promise<WaterAnalysisFormState> => {
  const t = await getTranslations('BureauWaterAnalysisPage.errors')
  return {
    status: 'error',
    message:
      error instanceof AuthorizationError ? t('forbidden') : t(failedKey),
  }
}

const textOf = (formData: FormData, key: string): string => {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

/** Un champ de fichier laisse vide arrive comme un fichier sans octet. */
const fileOf = (formData: FormData, key: string): File | undefined => {
  const value = formData.get(key)
  return value instanceof File && value.size > 0 ? value : undefined
}

/**
 * Le jour calendaire courant, a Paris : c'est l'action qui lit l'horloge, le
 * service le recoit en argument et reste testable.
 */
const today = (): string => calendarDayOf(new Date())

/** Publie une analyse : les champs et les deux fichiers du meme envoi. */
export async function publishWaterAnalysisAction(
  _state: WaterAnalysisFormState,
  formData: FormData
): Promise<WaterAnalysisFormState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await publishWaterAnalysisService({
      organizationId: tenant.id,
      sampledOn: textOf(formData, 'sampledOn'),
      content: textOf(formData, 'content'),
      poster: fileOf(formData, 'poster'),
      report: fileOf(formData, 'report'),
      today: today(),
    })
    if (result.status === 'rejected') return result

    updateTag(waterAnalysisListTag(tenant.id))
  } catch (error) {
    return failure(error)
  }

  redirect(`${LIST_PATH}?statut=publiee`)
}

/**
 * Corrige une analyse en ligne. Un fichier absent de l'envoi laisse celui en
 * place.
 */
export async function updateWaterAnalysisAction(
  _state: WaterAnalysisFormState,
  formData: FormData
): Promise<WaterAnalysisFormState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await updateWaterAnalysisService({
      organizationId: tenant.id,
      analysisId: textOf(formData, 'analysisId'),
      sampledOn: textOf(formData, 'sampledOn'),
      content: textOf(formData, 'content'),
      poster: fileOf(formData, 'poster'),
      report: fileOf(formData, 'report'),
      today: today(),
    })
    if (result.status === 'rejected') return result

    updateTag(waterAnalysisListTag(tenant.id))
  } catch (error) {
    return failure(error)
  }

  redirect(`${LIST_PATH}?statut=enregistree`)
}

/** Supprime une analyse, son affiche et son PDF avec elle. Irreversible. */
export async function deleteWaterAnalysisAction(
  analysisId: string
): Promise<WaterAnalysisFormState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await deleteWaterAnalysisService({organizationId: tenant.id, analysisId})

    updateTag(waterAnalysisListTag(tenant.id))
  } catch (error) {
    return failure(error, 'deleteFailed')
  }

  redirect(`${LIST_PATH}?statut=supprimee`)
}
