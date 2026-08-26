'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'

import {createProjectAction} from '@/app/[locale]/(app)/team/[slug]/projects/actions'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import {Organization} from '@/services/types/domain/organization-types'

import {
  createProjectCreateFormSchema,
  ProjectCreateFormSchemaType,
} from './project-form-validation'

interface CreateProjectFormProps {
  organization: Organization
  organizationSlug: string
}

export function CreateProjectForm({
  organization,
  organizationSlug,
}: CreateProjectFormProps) {
  const t = useTranslations('Projects')
  const tCommon = useTranslations('Common')
  const projectFormSchema = createProjectCreateFormSchema(t)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const form = useForm<ProjectCreateFormSchemaType>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      organizationId: organization.id,
    },
  })

  async function onSubmit(data: ProjectCreateFormSchemaType) {
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('name', data.name)
    formData.append('organizationId', data.organizationId)
    if (data.description) {
      formData.append('description', data.description)
    }

    const result = await createProjectAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast.success(result.message)
      router.push(`/team/${organizationSlug}/projects`)
    } else {
      if (result.errors) {
        for (const error of result.errors) {
          form.setError(error.field as keyof ProjectCreateFormSchemaType, {
            type: 'manual',
            message: error.message,
          })
        }
      }
      toast.error(result.message || t('errors.generic'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('form.newProject')}</CardTitle>
        <CardDescription>
          {t('form.createDescription', {organization: organization.name})}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Afficher l'organisation en lecture seule */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tCommon('fields.organization')}
              </label>
              <div className="border-input bg-muted flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                {organization.name}
              </div>
              {/* Champ caché pour soumettre l'ID */}
              <input
                type="hidden"
                {...form.register('organizationId')}
                value={organization.id}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('form.namePlaceholder')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.descriptionOptionalLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder={t('form.descriptionPlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(`/team/${organizationSlug}/projects`)
                }
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('form.creating') : t('form.create')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
