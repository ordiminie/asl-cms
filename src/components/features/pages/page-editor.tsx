'use client'

import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState, useTransition} from 'react'

import {
  PageBlockUploadState,
  PagePublishState,
  PageSaveState,
  PageUnpublishState,
} from '@/app/[locale]/(bureau)/bureau/pages/[id]/actions'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {BlockPicker} from '@/components/ui/block-picker'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {PreviewBar, PreviewBarStatus} from '@/components/ui/preview-bar'
import {SortableList} from '@/components/ui/sortable-list'
import {
  PAGE_BLOCK_TYPES,
  PageBlockData,
  PageBlockTypeConst,
} from '@/services/types/domain/page-block-types'
import {PageWithBlocksDTO} from '@/services/types/domain/page-types'

import {EditorBlock} from './blocks/block-form-types'
import {CalloutBlockForm} from './blocks/callout-block-form'
import {GalleryBlockForm} from './blocks/gallery-block-form'
import {ImageBlockForm} from './blocks/image-block-form'
import {PdfBlockForm} from './blocks/pdf-block-form'
import {TextBlockForm} from './blocks/text-block-form'
import {UnknownBlockCard} from './blocks/unknown-block-card'

type PageEditorProps = {
  page: PageWithBlocksDTO
  saveAction: (input: {
    pageId: string
    previousSlug: string
    title: string
    slug: string
    blocks: {id?: string; type?: string; data: unknown}[]
  }) => Promise<PageSaveState>
  publishAction: (input: {
    pageId: string
    previousSlug: string
    title: string
    slug: string
    blocks: {id?: string; type?: string; data: unknown}[]
  }) => Promise<PagePublishState>
  unpublishAction: (input: {
    pageId: string
    slug: string
  }) => Promise<PageUnpublishState>
  uploadAction: (formData: FormData) => Promise<PageBlockUploadState>
}

const EMPTY_BLOCK: Record<string, PageBlockData> = {
  [PageBlockTypeConst.TEXT]: {type: 'text', markdown: ''},
  [PageBlockTypeConst.IMAGE]: {
    type: 'image',
    fileKey: null,
    alt: '',
    caption: '',
  },
  [PageBlockTypeConst.PDF]: {
    type: 'pdf',
    fileKey: null,
    title: '',
    fileName: '',
    fileSize: 0,
  },
  [PageBlockTypeConst.GALLERY]: {type: 'gallery', images: []},
  [PageBlockTypeConst.CALLOUT]: {type: 'callout', title: '', markdown: ''},
}

const toEditorBlocks = (page: PageWithBlocksDTO): EditorBlock[] =>
  [...page.blocks]
    .sort((left, right) => left.rank - right.rank)
    .map((block) => ({
      key: block.id,
      id: block.id,
      type: block.type,
      data: block.data,
    }))

const persistedStatus = (
  status: PageWithBlocksDTO['status']
): PreviewBarStatus =>
  status === 'published' ? 'live' : status === 'draft' ? 'draft' : 'unpublished'

/**
 * Editeur d'une page (ecran 2 du design s04).
 *
 * La liste de blocs est la **seule** source d'ordre : `SortableList` rend le
 * meme tableau que le deplacement vienne du clavier ou de la souris, et le
 * service renumerote les rangs sur la position dans ce tableau (critere 8).
 */
export function PageEditor({
  page,
  saveAction,
  publishAction,
  unpublishAction,
  uploadAction,
}: PageEditorProps) {
  const t = useTranslations('BureauPagesPage.editor')
  const tTypes = useTranslations('PageBlocks.types')

  const [savedPage, setSavedPage] = useState(page)
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    toEditorBlocks(page)
  )
  const [isDirty, setIsDirty] = useState(false)
  const [slugError, setSlugError] = useState<string>()
  const [barError, setBarError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const status: PreviewBarStatus = barError
    ? 'error'
    : isPending
      ? 'publishing'
      : isDirty
        ? 'dirty'
        : persistedStatus(savedPage.status)

  const blockPayload = () =>
    blocks.map((block) => ({
      id: block.id,
      type: block.type,
      data: block.data,
    }))

  const applySaved = (next: PageWithBlocksDTO) => {
    setSavedPage(next)
    setBlocks(toEditorBlocks(next))
    setTitle(next.title)
    setSlug(next.slug)
    setIsDirty(false)
  }

  const save = () => {
    setSlugError(undefined)
    setBarError(undefined)
    startTransition(async () => {
      const result = await saveAction({
        pageId: page.id,
        previousSlug: savedPage.slug,
        title,
        slug,
        blocks: blockPayload(),
      })

      if (result.status === 'saved') applySaved(result.page)
      else if (result.status === 'slug-taken') setSlugError(t('slugTaken'))
      else setBarError(result.message)
    })
  }

  const publish = () => {
    setSlugError(undefined)
    setBarError(undefined)
    startTransition(async () => {
      const result = await publishAction({
        pageId: page.id,
        previousSlug: savedPage.slug,
        title,
        slug,
        blocks: blockPayload(),
      })

      if (result.status === 'published') applySaved(result.page)
      else if (result.status === 'incomplete') {
        setBarError(
          t('incomplete', {
            positions: result.issues.map((issue) => issue.rank + 1).join(', '),
          })
        )
      } else setBarError(result.message)
    })
  }

  const unpublish = () => {
    setBarError(undefined)
    startTransition(async () => {
      const result = await unpublishAction({
        pageId: page.id,
        slug: savedPage.slug,
      })

      if (result.status === 'unpublished') {
        setSavedPage((current) => ({...current, status: 'unpublished'}))
      } else setBarError(result.message)
    })
  }

  const upload = async (file: File, kind: 'image' | 'document') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pageId', page.id)
    formData.append('blockId', crypto.randomUUID())
    formData.append('kind', kind)

    const result = await uploadAction(formData)
    if (result.status === 'error') {
      setBarError(result.message)
      return undefined
    }

    setIsDirty(true)
    return {
      key: result.key,
      fileName: result.fileName,
      fileSize: result.fileSize,
    }
  }

  const insertBlock = (type: string, insertAt: number) => {
    const created: EditorBlock = {
      key: crypto.randomUUID(),
      type,
      data: EMPTY_BLOCK[type],
    }
    setBlocks((current) => [
      ...current.slice(0, insertAt),
      created,
      ...current.slice(insertAt),
    ])
    setIsDirty(true)
  }

  const updateBlock = (key: string, data: PageBlockData) => {
    setBlocks((current) =>
      current.map((block) => (block.key === key ? {...block, data} : block))
    )
    setIsDirty(true)
  }

  const removeBlock = (key: string) => {
    setBlocks((current) => current.filter((block) => block.key !== key))
    setIsDirty(true)
  }

  const pickerTypes = PAGE_BLOCK_TYPES.map((type) => ({
    value: type,
    label: tTypes(`${type}.label`),
    description: tTypes(`${type}.description`),
  }))

  return (
    <div className="flex w-full flex-col">
      <PreviewBar
        status={status}
        title={savedPage.title}
        errorMessage={barError}
        back={
          <Button asChild variant="outline" className="h-11">
            <Link href="/bureau/pages">{t('back')}</Link>
          </Button>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={isPending}
              onClick={save}
            >
              {t('saveDraft')}
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href={`/${savedPage.slug}`} target="_blank">
                {t('preview')}
              </Link>
            </Button>
            {savedPage.status === 'published' ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="h-11">
                    {t('unpublish')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('unpublishConfirmTitle', {title: savedPage.title})}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('unpublishConfirmHelp')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={unpublish}>
                      {t('unpublishConfirmAction')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : undefined}
            <Button
              type="button"
              className="h-11"
              disabled={isPending}
              onClick={publish}
            >
              {t('publish')}
            </Button>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-8 px-4 pt-6 pb-12 sm:px-6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <BlockPicker
            types={pickerTypes}
            insertAt={0}
            onInsert={insertBlock}
            trigger="separator"
          />

          <SortableList
            items={blocks}
            getId={(block) => block.key}
            getLabel={(block) => blockLabel(block, tTypes)}
            onReorder={(next) => {
              setBlocks(next)
              setIsDirty(true)
            }}
            renderItem={(block, meta) => (
              <div className="flex flex-col gap-4">
                <BlockBody
                  block={block}
                  onChange={(data) => updateBlock(block.key, data)}
                  onUpload={upload}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => removeBlock(block.key)}
                  >
                    {t('removeBlock')}
                  </Button>
                </div>
                {meta.index < meta.total - 1 && (
                  <BlockPicker
                    types={pickerTypes}
                    insertAt={meta.index + 1}
                    onInsert={insertBlock}
                    trigger="separator"
                  />
                )}
              </div>
            )}
          />

          <BlockPicker
            types={pickerTypes}
            insertAt={blocks.length}
            onInsert={insertBlock}
            trigger="append"
          />
        </div>

        <aside className="flex w-full flex-col gap-4 xl:w-[296px]">
          <h2 className="font-serif text-[22px] font-semibold">
            {t('settingsTitle')}
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="page-title">{t('titleLabel')}</Label>
            <Input
              id="page-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setIsDirty(true)
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="page-slug">{t('slugLabel')}</Label>
            <Input
              id="page-slug"
              value={slug}
              aria-invalid={slugError ? true : undefined}
              aria-describedby={slugError ? 'page-slug-error' : undefined}
              onChange={(event) => {
                setSlug(event.target.value)
                setIsDirty(true)
              }}
            />
            {slugError ? (
              <p
                id="page-slug-error"
                className="text-destructive text-[14px]"
                role="alert"
              >
                {slugError}
              </p>
            ) : (
              <p className="text-muted-foreground text-[14px]">
                {t('slugHelp', {slug})}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

const blockLabel = (
  block: EditorBlock,
  tTypes: (key: string) => string
): string =>
  (PAGE_BLOCK_TYPES as readonly string[]).includes(block.type)
    ? tTypes(`${block.type}.label`)
    : block.type

function BlockBody({
  block,
  onChange,
  onUpload,
}: {
  block: EditorBlock
  onChange: (data: PageBlockData) => void
  onUpload: (
    file: File,
    kind: 'image' | 'document'
  ) => Promise<{key: string; fileName: string; fileSize: number} | undefined>
}) {
  const data = block.data as PageBlockData

  switch (block.type) {
    case PageBlockTypeConst.TEXT: {
      return (
        <TextBlockForm
          data={data as Extract<PageBlockData, {type: 'text'}>}
          onChange={onChange}
          onUpload={onUpload}
        />
      )
    }
    case PageBlockTypeConst.IMAGE: {
      return (
        <ImageBlockForm
          data={data as Extract<PageBlockData, {type: 'image'}>}
          onChange={onChange}
          onUpload={onUpload}
        />
      )
    }
    case PageBlockTypeConst.PDF: {
      return (
        <PdfBlockForm
          data={data as Extract<PageBlockData, {type: 'pdf'}>}
          onChange={onChange}
          onUpload={onUpload}
        />
      )
    }
    case PageBlockTypeConst.GALLERY: {
      return (
        <GalleryBlockForm
          data={data as Extract<PageBlockData, {type: 'gallery'}>}
          onChange={onChange}
          onUpload={onUpload}
        />
      )
    }
    case PageBlockTypeConst.CALLOUT: {
      return (
        <CalloutBlockForm
          data={data as Extract<PageBlockData, {type: 'callout'}>}
          onChange={onChange}
          onUpload={onUpload}
        />
      )
    }
    default: {
      return <UnknownBlockCard type={block.type} />
    }
  }
}
