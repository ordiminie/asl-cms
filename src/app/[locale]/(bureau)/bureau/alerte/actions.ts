'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {siteAlertTag} from '@/app/dal/site-alert-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {SiteAlertActionResult} from '@/components/features/association/site-alert-form'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {isValidationParsedZodError} from '@/services/errors/validation-error'
import {
  getSiteAlertService,
  saveSiteAlertService,
} from '@/services/facades/site-alert-service-facade'
import {
  SITE_ALERT_MAX_LENGTH,
  SITE_ALERT_MESSAGE_REQUIRED,
  SITE_ALERT_MESSAGE_TOO_LONG,
} from '@/services/types/domain/site-alert-types'

/**
 * Server Actions de l'ecran « Bandeau d'alerte » (s07, ecran 1).
 *
 * Chacune rejoue le controle de session (`requireActionAuth`) avant d'appeler
 * la facade — le service reverifie l'autorisation de son cote — puis invalide
 * `siteAlertTag` **apres** le succes seulement : c'est ce qui met a jour le
 * bandeau sur toutes les pages sans redeploiement (critere 2). Un refus est
 * rendu comme un resultat traduit, jamais leve : l'ecran l'ecrit dans la page.
 */

const failure = async (error: unknown): Promise<SiteAlertActionResult> => {
  const t = await getTranslations('BureauAlertPage.errors')

  if (isValidationParsedZodError(error)) {
    const reasons = error.zodErrorFields?.issues.map((issue) => issue.message)
    if (reasons?.includes(SITE_ALERT_MESSAGE_REQUIRED)) {
      return {status: 'invalid', message: t('messageRequired')}
    }
    if (reasons?.includes(SITE_ALERT_MESSAGE_TOO_LONG)) {
      return {
        status: 'invalid',
        message: t('messageTooLong', {max: SITE_ALERT_MAX_LENGTH}),
      }
    }
  }

  return {
    status: 'error',
    message: error instanceof AuthorizationError ? t('forbidden') : t('failed'),
  }
}

/**
 * Enregistre le message et l'etat d'affichage en un seul geste : « Afficher le
 * bandeau sur le site » comme « Enregistrer le message ».
 */
export async function saveSiteAlertAction(
  message: string,
  active: boolean
): Promise<SiteAlertActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    await saveSiteAlertService({organizationId: tenant.id, message, active})

    updateTag(siteAlertTag(tenant.id))
    return {status: 'saved', active}
  } catch (error) {
    return failure(error)
  }
}

/**
 * Retire le bandeau de toutes les pages, sans confirmation : le message
 * enregistre est conserve, seul l'etat d'affichage change.
 */
export async function removeSiteAlertAction(): Promise<SiteAlertActionResult> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const current = await getSiteAlertService(tenant.id)
    await saveSiteAlertService({
      organizationId: tenant.id,
      message: current.message,
      active: false,
    })

    updateTag(siteAlertTag(tenant.id))
    return {status: 'saved', active: false}
  } catch (error) {
    return failure(error)
  }
}
