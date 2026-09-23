'use server'

import {updateTag} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {newsItemTag, newsListTag} from '@/app/dal/news-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createNewsDraftService,
  publishNewsService,
  unpublishNewsService,
  updateNewsService,
  uploadNewsImageService,
} from '@/services/facades/news-service-facade'
import {NewsDTO, NewsPublicationError} from '@/services/types/domain/news-types'

export type NewsSaveState =
  | {status: 'saved'; news: NewsDTO}
  | {status: 'incomplete'; issues: NewsPublicationError[]}
  | {status: 'error'; message: string}

export type NewsPublishState =
  | {status: 'published'; news: NewsDTO}
  | {status: 'incomplete'; issues: NewsPublicationError[]}
  | {status: 'error'; message: string}

export type NewsUnpublishState =
  {status: 'unpublished'; news: NewsDTO} | {status: 'error'; message: string}

export type NewsImageUploadState =
  | {status: 'uploaded'; key: string; fileName: string}
  | {status: 'error'; message: string}

export type NewsInput = {
  newsId: string
  title: string
  publishedOn: string
  content: string
  imageAlt: string
  /** Cle du dernier depot, ou `null` si l'image a ete retiree. */
  imageKey: string | null
}

const failure = async (error: unknown): Promise<{message: string}> => {
  const t = await getTranslations('BureauNewsPage.errors')
  return {
    message: error instanceof AuthorizationError ? t('forbidden') : t('failed'),
  }
}

/**
 * Invalide la liste publique **et** la fiche, toujours apres le succes : une
 * modification deplace ou change une ligne de la liste, y compris un
 * changement de date. L'adresse ne bouge jamais (ADR 023), donc un seul tag de
 * fiche suffit — contrairement aux pages, ou le slug peut changer.
 */
const invalidate = (organizationId: string, slug: string | null): void => {
  updateTag(newsListTag(organizationId))
  if (slug) updateTag(newsItemTag(organizationId, slug))
}

/**
 * Cree une actualite en brouillon et ouvre son editeur. La date du jour est
 * **proposee par le formulaire** : le service ne lit pas l'horloge, et la date
 * vue par le bureau est celle de son propre fuseau.
 */
export async function createNewsAction(publishedOn: string): Promise<void> {
  const tenant = await requireCurrentTenantDal()
  await requireActionAuth()

  const created = await createNewsDraftService({
    organizationId: tenant.id,
    publishedOn,
  })

  updateTag(newsListTag(tenant.id))
  redirect(`/bureau/actualites/${created.news.id}`)
}

/**
 * Enregistre une actualite. Un brouillon incomplet s'enregistre ; une
 * actualite **deja publiee** doit rester complete, puisque l'enregistrer la
 * republie aussitot. Un refus n'ecrit rien : rien a invalider.
 */
export async function saveNewsDraftAction(
  input: NewsInput
): Promise<NewsSaveState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await updateNewsService({
      organizationId: tenant.id,
      ...input,
    })
    if (result.status === 'rejected') {
      return {status: 'incomplete', issues: result.issues}
    }

    invalidate(tenant.id, result.news.slug)
    return {status: 'saved', news: result.news}
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/**
 * Publie l'actualite apres avoir enregistre l'etat courant du formulaire.
 *
 * **Deux ecritures, donc deux invalidations**, chacune apres son ecriture :
 *
 * - apres l'enregistrement, car le bouton principal de l'editeur appelle cette
 *   action meme sur une actualite deja publiee, et un refus de publication
 *   (titre ou texte alternatif manquant) laisserait sinon le site public servir
 *   l'ancien contenu jusqu'a l'expiration du cache ;
 * - apres le passage en `published`, car `updateTag` expire immediatement :
 *   invalider avant l'ecriture du statut laisse une requete de visiteur recacher
 *   l'etat non publie, que plus rien n'invaliderait.
 */
export async function publishNewsAction(
  input: NewsInput
): Promise<NewsPublishState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const saved = await updateNewsService({
      organizationId: tenant.id,
      ...input,
    })
    if (saved.status === 'rejected') {
      return {status: 'incomplete', issues: saved.issues}
    }

    invalidate(tenant.id, saved.news.slug)

    const published = await publishNewsService({
      organizationId: tenant.id,
      newsId: input.newsId,
    })
    if (published.status === 'rejected') {
      return {status: 'incomplete', issues: published.issues}
    }

    invalidate(tenant.id, published.news.slug)

    return {
      status: 'published',
      news: {...saved.news, status: published.news.status},
    }
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/** Retire l'actualite du site public sans rien supprimer. */
export async function unpublishNewsAction(input: {
  newsId: string
}): Promise<NewsUnpublishState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await unpublishNewsService({
      organizationId: tenant.id,
      newsId: input.newsId,
    })

    invalidate(tenant.id, result.news.slug)
    return {status: 'unpublished', news: result.news}
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/**
 * Depose l'image de l'actualite et rend sa cle de stockage.
 *
 * **Rien a invalider** : le depot pose le fichier, il n'ecrit pas la ligne. La
 * cle revient au formulaire, qui la garde jusqu'a l'enregistrement — sinon une
 * actualite deja publiee servirait la nouvelle image avec l'ancien texte
 * alternatif, ou sans aucun.
 */
export async function uploadNewsImageAction(
  formData: FormData
): Promise<NewsImageUploadState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const file = formData.get('file')
    if (!(file instanceof File)) {
      const t = await getTranslations('BureauNewsPage.errors')
      return {status: 'error', message: t('invalidData')}
    }

    const result = await uploadNewsImageService({
      organizationId: tenant.id,
      newsId: String(formData.get('newsId')),
      file,
    })

    if (result.status === 'rejected') {
      const t = await getTranslations('BureauNewsPage.errors')
      return {
        status: 'error',
        message: result.reason === 'size' ? t('fileTooLarge') : t('fileFormat'),
      }
    }

    return {status: 'uploaded', key: result.key, fileName: result.fileName}
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}
