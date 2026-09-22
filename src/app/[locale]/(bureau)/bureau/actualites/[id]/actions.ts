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
  {status: 'saved'; news: NewsDTO} | {status: 'error'; message: string}

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
  removeImage: boolean
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
 * Enregistre une actualite. N'exige jamais les champs « obligatoires pour
 * publier » : un brouillon incomplet s'enregistre.
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

    invalidate(tenant.id, result.news.slug)
    return {status: 'saved', news: result.news}
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/**
 * Publie l'actualite apres avoir enregistre l'etat courant du formulaire.
 *
 * L'invalidation suit **l'enregistrement**, pas le verdict de publication : le
 * bouton principal de l'editeur appelle cette action meme sur une actualite
 * deja publiee, et un refus de publication (titre ou texte alternatif manquant)
 * laisserait alors le site public servir l'ancien contenu jusqu'a l'expiration
 * du cache.
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

    invalidate(tenant.id, saved.news.slug)

    const published = await publishNewsService({
      organizationId: tenant.id,
      newsId: input.newsId,
    })
    if (published.status === 'rejected') {
      return {status: 'incomplete', issues: published.issues}
    }

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

/** Depose l'image de l'actualite et rend sa cle de stockage. */
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
