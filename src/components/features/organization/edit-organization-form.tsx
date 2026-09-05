'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import * as z from 'zod'

import {
  updateOrganizationAction,
  uploadOrganizationImageAction,
} from '@/components/features/organization/action'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {FileUpload} from '@/components/ui/file-upload'
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
import {Textarea} from '@/components/ui/textarea'
import {Organization} from '@/services/types/domain/organization-types'

import {organizationFormSchema} from './organization-form-validation'

type FormValues = z.infer<typeof organizationFormSchema>

export function EditOrganizationForm({
  organization,
  canEdit,
}: {
  organization: Organization
  canEdit: boolean
}) {
  const t = useTranslations('Organization.form')
  const tCommon = useTranslations('Common')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [organizationImage, setOrganizationImage] = useState(
    organization.logo ?? ''
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug ?? '',
      description: organization.description ?? '',
      logo: organization.logo ?? '',
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    const formData = new FormData()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value)
      }
    }

    const result = await updateOrganizationAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('successTitle'), {
        description: result.message,
      })
    } else {
      for (const error of result?.errors ?? []) {
        form.setError(error.field, {type: 'manual', message: error.message})
      }
      toast(t('errorTitle'), {
        description: result.message,
      })
    }
  }

  async function handleFileUpload(files: File[]) {
    if (files.length === 0) return

    const file = files[0]
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('organizationId', organization.id)

      const result = await uploadOrganizationImageAction(undefined, formData)

      if (result.success && result.imageUrl) {
        // Mettre à jour le champ image dans le formulaire avec l'URL du fichier uploadé
        form.setValue('logo', result.imageUrl)
        setOrganizationImage(result.imageUrl)

        toast(t('successTitle'), {
          description: result.message,
        })
      } else {
        toast(t('errorTitle'), {
          description: result.message || "Erreur lors de l'upload",
        })
      }
    } catch (error) {
      console.error("Erreur lors de l'upload:", error)
      toast(t('errorTitle'), {
        description: "Impossible d'uploader l'image. Veuillez réessayer.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Form {...form}>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            {organizationImage ? (
              <div className="relative h-32 w-32 overflow-hidden rounded-lg">
                <Image
                  src={organizationImage}
                  alt={organization.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border-dashed bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    <span className="text-xl font-semibold text-gray-600 dark:text-gray-300">
                      {organization.name?.charAt(0)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{t('noImage')}</p>
                </div>
              </div>
            )}
            <div className="text-center">
              <h3 className="text-lg font-semibold">{organization.name}</h3>
              <p className="text-muted-foreground text-sm">
                @{organization.slug}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <input type="hidden" {...form.register('id')} />
        <div className="space-y-2">
          <FileUpload
            onChange={handleFileUpload}
            onlyimage={true}
            multi={false}
            isUploading={isUploading}
          />
          {isUploading && (
            <p className="text-muted-foreground text-sm">{t('uploading')}</p>
          )}
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({field}) => (
            <FormItem>
              <FormLabel>{tCommon('fields.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('namePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({field}) => (
            <FormItem>
              <FormLabel>{tCommon('fields.slug')}</FormLabel>
              <FormControl>
                <Input placeholder={t('slugPlaceholder')} {...field} />
              </FormControl>
              <FormDescription>
                Utilisé dans l&apos;URL de l&apos;organisation. Doit contenir
                uniquement des lettres minuscules, des chiffres et des tirets.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({field}) => (
            <FormItem>
              <FormLabel>{tCommon('fields.description')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('descriptionPlaceholder')}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting || !canEdit}
          className="mb-8"
        >
          {isSubmitting ? t('updating') : tCommon('actions.save')}
        </Button>
      </form>
    </Form>
  )
}
