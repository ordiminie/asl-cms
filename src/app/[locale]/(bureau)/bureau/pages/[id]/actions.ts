'use server'

import {updateTag} from 'next/cache'
import {redirect} from 'next/navigation'
import {getTranslations} from 'next-intl/server'

import {pageTag} from '@/app/dal/page-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {requireActionAuth} from '@/app/dal/user-dal'
import {AuthorizationError} from '@/services/errors/authorization-error'
import {
  createPageService,
  publishPageService,
  unpublishPageService,
  updatePageService,
  uploadPageBlockFileService,
} from '@/services/facades/page-service-facade'
import {PageBlockPublicationIssue} from '@/services/types/domain/page-block-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

export type PageSaveState =
  | {status: 'saved'; page: PageWithBlocksDTO}
  | {status: 'slug-taken'}
  | {status: 'error'; message: string}

export type PagePublishState =
  | {status: 'published'; page: PageWithBlocksDTO}
  | {status: 'incomplete'; issues: PageBlockPublicationIssue[]}
  | {status: 'error'; message: string}

export type PageUnpublishState =
  | {status: 'unpublished'; page: PageWithBlocksDTO}
  | {status: 'error'; message: string}

export type PageBlockUploadState =
  | {status: 'uploaded'; key: string; fileName: string; fileSize: number}
  | {status: 'error'; message: string}

export type PageBlockInput = {id?: string; type?: string; data: unknown}

const failure = async (error: unknown): Promise<{message: string}> => {
  const t = await getTranslations('BureauPagesPage.errors')
  return {
    message: error instanceof AuthorizationError ? t('forbidden') : t('failed'),
  }
}

/**
 * Cree une page en brouillon et ouvre son editeur (ecran 1 -> ecran 2).
 *
 * Le slug par defaut est suffixe tant qu'il est pris : le bureau le renomme
 * ensuite dans le panneau « Parametres ». La boucle est bornee — au-dela,
 * l'echec remonte plutot que de tourner.
 */
export async function createPageAction(): Promise<void> {
  const tenant = await requireCurrentTenantDal()
  await requireActionAuth()

  const t = await getTranslations('BureauPagesPage')
  const baseSlug = t('newPage.slug')

  let createdSlug: string | undefined
  let createdId: string | undefined

  for (let attempt = 1; attempt <= 50 && !createdId; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    // La contrainte unique de la base tranche en dernier ressort : entre le
    // controle de disponibilite et l'insertion, un autre membre du bureau peut
    // avoir pris le meme slug. On reessaye avec le suivant plutot que de
    // renvoyer une panne pour un clic sur « Nouvelle page ».
    const result = await createPageService({
      organizationId: tenant.id,
      title: t('newPage.title'),
      slug,
      blocks: [],
    }).catch((error: unknown) => {
      if (error instanceof AuthorizationError) throw error
      return undefined
    })

    if (result?.status === 'saved') {
      createdId = result.page.id
      createdSlug = result.page.slug
    }
  }

  if (createdId && createdSlug) {
    updateTag(pageTag(tenant.id, createdSlug))
    redirect(`/bureau/pages/${createdId}`)
  }

  throw new Error('Impossible de trouver un slug libre pour une page')
}

/**
 * Enregistre le brouillon d'une page. N'exige jamais les champs
 * « obligatoires pour publier » : un brouillon incomplet s'enregistre.
 *
 * L'invalidation du cache vient **apres** le succes, et porte sur l'ancien et
 * le nouveau slug — un renommage laisserait sinon l'ancienne adresse servir la
 * page en cache.
 */
export async function savePageDraftAction(input: {
  pageId: string
  previousSlug: string
  title: string
  slug: string
  blocks: PageBlockInput[]
}): Promise<PageSaveState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await updatePageService({
      organizationId: tenant.id,
      pageId: input.pageId,
      title: input.title,
      slug: input.slug,
      blocks: input.blocks,
    })

    if (result.status === 'rejected') {
      return {status: 'slug-taken'}
    }

    updateTag(pageTag(tenant.id, input.previousSlug))
    updateTag(pageTag(tenant.id, result.page.slug))
    return {status: 'saved', page: result.page}
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/** Publie la page apres avoir enregistre l'etat courant de l'editeur. */
export async function publishPageAction(input: {
  pageId: string
  previousSlug: string
  title: string
  slug: string
  blocks: PageBlockInput[]
}): Promise<PagePublishState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const saved = await updatePageService({
      organizationId: tenant.id,
      pageId: input.pageId,
      title: input.title,
      slug: input.slug,
      blocks: input.blocks,
    })
    if (saved.status === 'rejected') {
      const t = await getTranslations('BureauPagesPage.errors')
      return {status: 'error', message: t('slugTaken')}
    }

    const published = await publishPageService({
      organizationId: tenant.id,
      pageId: input.pageId,
    })
    if (published.status === 'rejected') {
      return {status: 'incomplete', issues: published.issues}
    }

    updateTag(pageTag(tenant.id, input.previousSlug))
    updateTag(pageTag(tenant.id, published.page.slug))
    return {
      status: 'published',
      page: {...saved.page, status: published.page.status},
    }
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/** Retire la page du site public sans rien supprimer (critere 3). */
export async function unpublishPageAction(input: {
  pageId: string
  slug: string
}): Promise<PageUnpublishState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const result = await unpublishPageService({
      organizationId: tenant.id,
      pageId: input.pageId,
    })

    updateTag(pageTag(tenant.id, input.slug))
    return {
      status: 'unpublished',
      page: {...result.page, blocks: []},
    }
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}

/** Depose le fichier d'un bloc et rend sa cle de stockage. */
export async function uploadPageBlockFileAction(
  formData: FormData
): Promise<PageBlockUploadState> {
  const tenant = await requireCurrentTenantDal()

  try {
    await requireActionAuth()

    const file = formData.get('file')
    if (!(file instanceof File)) {
      const t = await getTranslations('BureauPagesPage.errors')
      return {status: 'error', message: t('invalidData')}
    }

    const result = await uploadPageBlockFileService({
      organizationId: tenant.id,
      pageId: String(formData.get('pageId')),
      blockId: String(formData.get('blockId')),
      kind: formData.get('kind') === 'document' ? 'document' : 'image',
      file,
    })

    if (result.status === 'rejected') {
      const t = await getTranslations('BureauPagesPage.errors')
      return {
        status: 'error',
        message: result.reason === 'size' ? t('fileTooLarge') : t('fileFormat'),
      }
    }

    return {
      status: 'uploaded',
      key: result.key,
      fileName: result.fileName,
      fileSize: result.fileSize,
    }
  } catch (error) {
    return {status: 'error', ...(await failure(error))}
  }
}
