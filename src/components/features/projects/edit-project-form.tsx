'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'

import {updateProjectAction} from '@/app/[locale]/(app)/team/[slug]/projects/actions'
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
import {Project} from '@/services/types/domain/project-types'

import {
  createProjectFormSchema,
  ProjectFormSchemaType,
} from './project-form-validation'

interface EditProjectFormProps {
  project: Project
  canEdit: boolean
}

export function EditProjectForm({project, canEdit}: EditProjectFormProps) {
  const t = useTranslations('Projects')
  const projectFormSchema = createProjectFormSchema(t)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProjectFormSchemaType>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name,
      description: project.description || '',
    },
  })

  async function onSubmit(data: ProjectFormSchemaType) {
    if (!canEdit) {
      toast.error(t('errors.notAllowed'))
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.description) {
      formData.append('description', data.description)
    }

    const result = await updateProjectAction(project.id, undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast.success(result.message)
    } else {
      if (result.errors) {
        for (const error of result.errors) {
          form.setError(error.field as keyof ProjectFormSchemaType, {
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
        <CardTitle>{t('form.infoTitle')}</CardTitle>
        <CardDescription>{t('form.editDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!canEdit} />
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
                  <FormLabel>{t('form.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      disabled={!canEdit}
                      rows={4}
                      placeholder={t('form.descriptionPlaceholder')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {canEdit && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('form.updating') : t('form.update')}
              </Button>
            )}

            {!canEdit && (
              <p className="text-muted-foreground text-sm">
                Vous n&apos;avez pas les droits nécessaires pour modifier ce
                projet.
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
