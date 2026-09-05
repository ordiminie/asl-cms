'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'
import {useForm} from 'react-hook-form'
import {z} from 'zod'

import {useCreateProject} from '@/components/hooks/client/project-client'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import {authClient} from '@/lib/better-auth/auth-client'

const createProjectSchema = z.object({
  name: z.string().min(1, 'The name is required'),
  description: z.string().optional(),
})

type CreateProjectFormData = z.infer<typeof createProjectSchema>

interface Props {
  organizationId: string
  trigger: React.ReactNode
}

export function CreateProjectDialog({organizationId, trigger}: Props) {
  const t = useTranslations('Projects')
  const [open, setOpen] = useState(false)
  const createProjectMutation = useCreateProject()
  const user = authClient.useSession()

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const onSubmit = async (data: CreateProjectFormData) => {
    createProjectMutation.mutate(
      {
        name: data.name,
        description: data.description || undefined,
        organizationId,
        createdBy: user.data?.user.id, // TODO: Récupérer depuis le contexte d'auth
      },
      {
        onSuccess: () => {
          setOpen(false)
          form.reset()
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('form.createTitle')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('form.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('form.namePlaceholderShort')}
                      {...field}
                    />
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
                      placeholder={t('form.descriptionShortPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createProjectMutation.isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createProjectMutation.isPending}>
                {createProjectMutation.isPending
                  ? t('form.creating')
                  : t('form.createShort')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
