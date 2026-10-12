'use server'

import {updateTag} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {homePageTag} from '@/app/dal/home-page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import type {HomePageActionResult} from '@/components/features/association/home-page-form'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {setHomePageService} from '@/services/facades/home-page-service-facade'

/**
 * Server Action de l'ecran « Page d'accueil » (s44, ecran 1).
 *
 * Rejoue le controle de session (`requireActionAuth`) avant d'appeler la
 * facade — le service reverifie l'autorisation et l'appartenance de la page
 * a l'association — puis invalide `homePageTag` **apres** le succes
 * seulement : c'est ce qui change `/` a la requete suivante, sans
 * redeploiement (critere 5). Un refus est rendu comme un resultat traduit,
 * jamais leve : l'ecran l'ecrit dans la page.
 */
export async function saveHomePageAction(
  pageId: string | null
): Promise<HomePageActionResult> {
  const tenant = await requireCurrentTenantDal()
  const t = await getTranslations('BureauHomePage.errors')

  try {
    await requireActionAuth()

    const result = await setHomePageService({
      organizationId: tenant.id,
      pageId,
    })
    if (result.status === 'not_published') {
      return {status: 'not_published', message: t('notPublished')}
    }

    updateTag(homePageTag(tenant.id))
    return {status: 'saved'}
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof AuthorizationError ? t('forbidden') : t('failed'),
    }
  }
}
