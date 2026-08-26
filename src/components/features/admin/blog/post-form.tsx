'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Plus, Save, X} from 'lucide-react'
import {useParams, useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useFieldArray, useForm, useWatch} from 'react-hook-form'
import {toast} from 'sonner'

import {
  createPostAction,
  deleteFileAction,
  updatePostCompleteAction,
  uploadFileAction,
} from '@/app/[locale]/admin/blog/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {MarkdownEditor} from '@/components/ui/markdown-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Textarea} from '@/components/ui/textarea'
import {generateSlug} from '@/lib/helper/blog'
import {
  FileListResponse,
  FileResponse,
} from '@/services/types/domain/file-types'
import {
  CategoryDTO,
  Hashtag,
  POST_STATUS,
  PostData,
  SupportedLanguage,
} from '@/services/types/domain/post-types'

import {FileDropzone} from './file-dropzone'
import {
  LANGUAGE_OPTIONS,
  PostFormData,
  postFormSchema,
} from './post-form-validation'

type PostFormValues = PostFormData

interface PostFormProps {
  mode: 'create' | 'edit'
  post?: PostData
  categories: CategoryDTO[]
  hashtags: Hashtag[]
  files?: FileListResponse
}

// Fonction pour mapper les champs d'erreur du service vers les chemins RHF
function mapErrorFieldToFormPath(field: string): string {
  // Si le chemin contient déjà un index (ex: "1.title"), on le convertit vers RHF
  const pathParts = field.split('.')

  // Si c'est un champ de traduction individuel sans index
  const translationFields = [
    'title',
    'slug',
    'description',
    'content',
    'metaTitle',
    'metaDescription',
    'metaKeywords',
  ]

  if (translationFields.includes(field)) {
    // Pointer vers la première traduction par défaut
    return `translations.0.${field}`
  }

  // Si le chemin a déjà la structure index.field (ex: "0.title")
  if (
    pathParts.length === 2 &&
    !isNaN(Number(pathParts[0])) &&
    translationFields.includes(pathParts[1])
  ) {
    return `translations.${pathParts[0]}.${pathParts[1]}`
  }

  // Les autres champs restent inchangés
  return field
}

export function PostForm({
  mode,
  post,
  categories,
  hashtags,
  files = [],
}: PostFormProps) {
  const t = useTranslations('AdminBlog')
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const params = useParams()
  const currentLocale = params.locale as SupportedLanguage
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newHashtagInput, setNewHashtagInput] = useState('')
  const [hashtagSelectValue, setHashtagSelectValue] = useState('')
  //const [fileList, setFileList] = useState<FileResponse[]>(files)

  // Préparation des valeurs par défaut
  const defaultValues: PostFormValues = {
    status: (post?.status as 'draft' | 'published' | 'archived') || 'draft',
    categoryId: post?.categoryId || undefined,
    translations: post?.postTranslations?.length
      ? post.postTranslations
          .map((t) => ({
            language: t.language as SupportedLanguage,
            title: t.title,
            slug: t.slug,
            description: t.description || '',
            content: t.content || '',
            metaTitle: t.metaTitle || '',
            metaDescription: t.metaDescription || '',
            metaKeywords: t.metaKeywords || '',
          }))
          .sort((a, b) => {
            // Trier selon l'ordre défini dans LANGUAGE_OPTIONS
            const aIndex = LANGUAGE_OPTIONS.findIndex(
              (lang) => lang.value === a.language
            )
            const bIndex = LANGUAGE_OPTIONS.findIndex(
              (lang) => lang.value === b.language
            )
            return aIndex - bIndex
          })
      : [
          {
            language: currentLocale,
            title: '',
            slug: '',
            description: '',
            content: '',
            metaTitle: '',
            metaDescription: '',
            metaKeywords: '',
          },
        ],
    hashtags:
      post?.postHashtags
        ?.map((ph) => ph.hashtag?.id)
        .filter((id): id is string => Boolean(id)) || [],
    newHashtags: [],
  }

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  })

  const {
    fields: translationFields,
    append: appendTranslation,
    remove: removeTranslation,
  } = useFieldArray({
    control: form.control,
    name: 'translations',
  })

  const watchedHashtags =
    useWatch({control: form.control, name: 'hashtags'}) || []
  const watchedNewHashtags =
    useWatch({control: form.control, name: 'newHashtags'}) || []

  const addTranslation = () => {
    const usedLanguages = form.getValues('translations').map((t) => t.language)
    const availableLanguages = LANGUAGE_OPTIONS.filter(
      (lang) => !usedLanguages.includes(lang.value)
    )

    if (availableLanguages.length > 0) {
      // Ajouter la nouvelle traduction
      appendTranslation({
        language: availableLanguages[0].value,
        title: '',
        slug: '',
        description: '',
        content: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
      })

      // Réorganiser l'ordre des traductions selon LANGUAGE_OPTIONS
      setTimeout(() => {
        const currentTranslations = form.getValues('translations')
        const sortedTranslations = [...currentTranslations].sort((a, b) => {
          const aIndex = LANGUAGE_OPTIONS.findIndex(
            (lang) => lang.value === a.language
          )
          const bIndex = LANGUAGE_OPTIONS.findIndex(
            (lang) => lang.value === b.language
          )
          return aIndex - bIndex
        })

        // Réassigner les traductions triées
        form.setValue('translations', sortedTranslations)
      }, 0)
    }
  }

  const addNewHashtag = () => {
    // Nettoyer l'input : enlever #, espaces, et caractères non autorisés
    const cleanInput = newHashtagInput
      .trim()
      .replace(/^#/, '') // Enlever # du début si présent
      .replace(/[^a-zA-Z0-9_]/g, '') // Ne garder que lettres, chiffres et underscores
      .toLowerCase() // Convertir en minuscules pour uniformité

    if (cleanInput && cleanInput.length >= 2) {
      const currentNewHashtags = form.getValues('newHashtags') || []
      const currentHashtags = form.getValues('hashtags') || []

      // Vérifier que le hashtag n'existe pas déjà
      const existsInExisting = hashtags.some(
        (h) => h.name.toLowerCase() === cleanInput.toLowerCase()
      )
      const existsInNew = currentNewHashtags.some(
        (h) => h.toLowerCase() === cleanInput.toLowerCase()
      )

      if (!existsInExisting && !existsInNew) {
        form.setValue('newHashtags', [...currentNewHashtags, cleanInput])
        setNewHashtagInput('')
      } else {
        // Si le hashtag existe déjà, on peut l'ajouter à la sélection
        const existingHashtag = hashtags.find(
          (h) => h.name.toLowerCase() === cleanInput.toLowerCase()
        )
        if (existingHashtag && !currentHashtags.includes(existingHashtag.id)) {
          toggleHashtag(existingHashtag.id)
        }
        setNewHashtagInput('')
      }
    } else if (cleanInput.length < 2) {
      // Montrer un message d'erreur si le hashtag est trop court après nettoyage
      console.warn(t('form.hashtagTooShort'))
    }
  }

  const removeNewHashtag = (index: number) => {
    const currentNewHashtags = form.getValues('newHashtags') || []
    form.setValue(
      'newHashtags',
      currentNewHashtags.filter((_, i) => i !== index)
    )
  }

  const toggleHashtag = (hashtagId: string) => {
    const currentHashtags = form.getValues('hashtags') || []
    if (currentHashtags.includes(hashtagId)) {
      form.setValue(
        'hashtags',
        currentHashtags.filter((id) => id !== hashtagId)
      )
    } else {
      form.setValue('hashtags', [...currentHashtags, hashtagId])
    }
  }

  async function onSubmit(data: PostFormValues) {
    setIsSubmitting(true)
    try {
      let result

      if (mode === 'create') {
        result = await createPostAction(data)
      } else if (post) {
        result = await updatePostCompleteAction(post.id, data)
      }

      if (result?.success) {
        toast.success(result.message)
      } else {
        // Appliquer les erreurs serveur au formulaire RHF

        // Appliquer les erreurs Zod du service au formulaire RHF
        if (result?.errors) {
          result.errors.forEach((error) => {
            // Mapper les champs de traduction vers le bon chemin dans RHF
            const fieldPath = mapErrorFieldToFormPath(error.field as string)
            form.setError(fieldPath as keyof PostFormValues, {
              type: 'manual',
              message: error.message,
            })
          })
        }

        toast.error(result?.message || t('form.genericError'))
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error)
      toast.error('Une erreur inattendue est survenue')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileUpload = async (files: File[] | FileList): Promise<void> => {
    if (!post?.id) {
      toast.error("Veuillez d'abord enregistrer le post.")
      return
    }
    const fileArray = Array.isArray(files) ? files : [...files]
    for (const file of fileArray) {
      try {
        //const path = `/${file.name}`
        // Créer FormData pour l'upload
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadFileAction(post?.id ?? '', formData)
        console.log(t('form.fileUploaded'), result)
        if (result.success) {
          toast.success(result.message)
        } else if (!result.success) {
          toast.error(result.message)
        }
      } catch (error) {
        console.error("Erreur lors de l'upload :", error)
      }
    }
  }
  async function handleRemoveFile(file: FileResponse): Promise<void> {
    const result = await deleteFileAction(post?.id ?? '', file.name)
    if (result.success) {
      toast('Success', {
        description: result.message,
      })
    } else if (!result.success) {
      toast('Error', {
        description: result.message,
      })
    }
  }

  // Gérer la suppression de fichier
  // const handleRemoveFile = async (file: FileResponse) => {
  //   if (!post?.id) return

  //   try {
  //     const result = await deleteFileAction(post.id, file.name)
  //     if (result.success) {
  //       setFileList((files) => files.filter((f) => f.name !== file.name))
  //       toast.success(result.message)
  //     } else {
  //       toast.error(result.message)
  //     }
  //   } catch (error) {
  //     console.error('Erreur lors de la suppression:', error)
  //     toast.error('Erreur lors de la suppression du fichier')
  //   }
  // }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Configuration générale */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.generalConfig')}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{tCommon('fields.status')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectStatus')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={POST_STATUS.DRAFT}>
                        {t('status.draft')}
                      </SelectItem>
                      <SelectItem value={POST_STATUS.PUBLISHED}>
                        {t('status.published')}
                      </SelectItem>
                      <SelectItem value={POST_STATUS.ARCHIVED}>
                        {t('status.archived')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{tCommon('fields.category')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectCategory')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">
                        {t('categories.none')}
                      </SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Hashtags */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.hashtags')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sélecteur de hashtags */}
            <div>
              <FormLabel>{t('form.selectHashtags')}</FormLabel>
              <Select
                value={hashtagSelectValue}
                onValueChange={(value) => {
                  if (value && value !== 'add-new') {
                    toggleHashtag(value)
                    setHashtagSelectValue('') // Réinitialiser la sélection
                  } else if (value === 'add-new') {
                    // Focus sur l'input pour nouveau hashtag
                    document.getElementById('new-hashtag-input')?.focus()
                    setHashtagSelectValue('') // Réinitialiser la sélection
                  }
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('form.chooseHashtag')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="add-new"
                    className="text-primary font-medium"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.addHashtag')}
                  </SelectItem>
                  {hashtags
                    .filter((hashtag) => !watchedHashtags.includes(hashtag.id))
                    .map((hashtag) => (
                      <SelectItem key={hashtag.id} value={hashtag.id}>
                        #{hashtag.name}
                      </SelectItem>
                    ))}
                  {hashtags.filter(
                    (hashtag) => !watchedHashtags.includes(hashtag.id)
                  ).length === 0 && (
                    <SelectItem value="no-more" disabled>
                      {t('form.allHashtagsSelected')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Ajouter nouveau hashtag */}
            <div>
              <FormLabel>{t('form.addHashtag')}</FormLabel>
              <div className="mt-2 flex gap-2">
                <Input
                  id="new-hashtag-input"
                  placeholder={t('form.hashtagPlaceholder')}
                  value={newHashtagInput}
                  onChange={(e) => setNewHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addNewHashtag()
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={addNewHashtag}
                  disabled={!newHashtagInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">
                Les caractères spéciaux et espaces seront automatiquement
                supprimés
              </p>
            </div>

            {/* Hashtags sélectionnés */}
            {(watchedHashtags.length > 0 || watchedNewHashtags.length > 0) && (
              <div>
                <FormLabel>{t('form.selectedHashtags')}</FormLabel>
                <div className="mt-2 flex flex-wrap gap-2">
                  {/* Hashtags existants sélectionnés */}
                  {watchedHashtags.map((hashtagId) => {
                    const hashtag = hashtags.find((h) => h.id === hashtagId)
                    return hashtag ? (
                      <Badge
                        key={hashtag.id}
                        variant="default"
                        className="gap-1 pr-1"
                      >
                        #{hashtag.name}
                        <button
                          type="button"
                          className="ml-1 cursor-pointer rounded-sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleHashtag(hashtag.id)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ) : null
                  })}

                  {/* Nouveaux hashtags */}
                  {watchedNewHashtags.map((hashtag, index) => (
                    <Badge
                      key={`new-${index}`}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      #{hashtag}
                      <button
                        type="button"
                        className="ml-1 cursor-pointer rounded-sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeNewHashtag(index)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fichiers */}
        <Card>
          <CardHeader>
            <CardTitle>{t('form.files')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FileDropzone
                disabled={post?.id ? false : true}
                disabledMessage="Please save the post first."
                defaultFiles={files}
                onFilesSelected={(files) => {
                  handleFileUpload(files)
                }}
                onFilesServerSelectedToRemove={handleRemoveFile}
              />
            </div>
          </CardContent>
        </Card>

        {/* Traductions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t('form.translations')}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTranslation}
                disabled={translationFields.length >= 3}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('form.addLanguage')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="0" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                {translationFields.map((field, index) => (
                  <TabsTrigger
                    key={field.id}
                    value={index.toString()}
                    className="cursor-pointer"
                  >
                    {
                      LANGUAGE_OPTIONS.find((l) => l.value === field.language)
                        ?.label
                    }
                  </TabsTrigger>
                ))}
              </TabsList>

              {translationFields.map((field, index) => (
                <TabsContent key={field.id} value={index.toString()}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">
                        {
                          LANGUAGE_OPTIONS.find(
                            (l) => l.value === field.language
                          )?.label
                        }
                      </h3>
                      {translationFields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeTranslation(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name={`translations.${index}.language`}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{tCommon('fields.language')}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LANGUAGE_OPTIONS.map((lang) => (
                                <SelectItem key={lang.value} value={lang.value}>
                                  {lang.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`translations.${index}.title`}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{t('form.titleRequired')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t('form.titlePlaceholder')}
                              onChange={(e) => {
                                field.onChange(e)
                                const slug = generateSlug(e.target.value)
                                form.setValue(
                                  `translations.${index}.slug`,
                                  slug
                                )
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`translations.${index}.slug`}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{t('form.slugRequired')}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t('form.slugPlaceholder')}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('form.slugDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`translations.${index}.description`}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{tCommon('fields.description')}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder={t('form.descriptionPlaceholder')}
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`translations.${index}.content`}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>{t('form.content')}</FormLabel>
                          <FormControl>
                            <MarkdownEditor
                              value={field.value}
                              onChange={field.onChange}
                              placeholder={t('form.contentPlaceholder')}
                              id={`content-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* SEO Meta */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-medium">{t('form.seoMeta')}</h4>

                      <FormField
                        control={form.control}
                        name={`translations.${index}.metaTitle`}
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>{t('form.metaTitle')}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t('form.metaTitlePlaceholder')}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('form.metaTitleHint')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`translations.${index}.metaDescription`}
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>{t('form.metaDescription')}</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder={t(
                                  'form.metaDescriptionPlaceholder'
                                )}
                                rows={3}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('form.metaDescriptionHint')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`translations.${index}.metaKeywords`}
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>{t('form.metaKeywords')}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t('form.metaKeywordsPlaceholder')}
                              />
                            </FormControl>
                            <FormDescription>
                              {t('form.metaKeywordsHint')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting
              ? t('saving')
              : mode === 'create'
                ? t('form.create')
                : t('form.update')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
