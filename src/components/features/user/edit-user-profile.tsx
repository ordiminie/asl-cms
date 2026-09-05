'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import * as z from 'zod'

import {
  updateUserAction,
  uploadProfileImageAction,
} from '@/components/features/user/action'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
import {FileUpload} from '@/components/ui/file-upload'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {User} from '@/services/types/domain/user-types'

import {createUserFormSchema} from '../admin/users/user-form-validation'

export function EditUserProfileForm({user}: {user: User}) {
  const t = useTranslations('AccountPage.EditUserProfileForm')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarImage, setAvatarImage] = useState(user.image ?? '')

  // Créer le schéma avec messages traduits
  const userFormSchemaClient = createUserFormSchema(t)
  type FormValues = z.infer<typeof userFormSchemaClient>

  const form = useForm<FormValues>({
    resolver: zodResolver(userFormSchemaClient),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? '',
      visibility: user.visibility,
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    const formData = new FormData()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.append(key, value)
      }
    }

    const result = await updateUserAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('form.success'), {
        description: result.message,
        action: {
          label: t('form.undo'),
          onClick: () => console.log('Undo'),
        },
      })
    } else {
      for (const error of result?.errors ?? []) {
        form.setError(error.field, {type: 'manual', message: error.message})
      }
      toast(t('form.error'), {
        description: result.message,
        action: {
          label: t('form.ok'),
          onClick: () => console.log('Undo'),
        },
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

      const result = await uploadProfileImageAction(undefined, formData)

      if (result.success && result.imageUrl) {
        // Mettre à jour le champ image dans le formulaire avec l'URL du fichier uploadé
        form.setValue('image', result.imageUrl)
        setAvatarImage(result.imageUrl)

        toast(t('upload.success'), {
          description: result.message,
        })
      } else {
        toast(t('upload.error'), {
          description: result.message || t('upload.error'),
        })
      }
    } catch (error) {
      console.error("Erreur lors de l'upload:", error)
      toast(t('upload.error'), {
        description: t('upload.errorRetry'),
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Form {...form}>
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-[100px] w-[100px]">
          <AvatarImage src={avatarImage} alt={user.name} />
          <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="text-muted-foreground text-sm">{user.name}</p>
      </div>
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
            <p className="text-muted-foreground text-sm">
              {t('upload.inProgress')}
            </p>
          )}
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({field}) => (
            <FormItem>
              <FormLabel>{t('name.label')}</FormLabel>
              <FormControl>
                <Input placeholder={t('name.placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({field}) => (
            <FormItem>
              <FormLabel>{t('email.label')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('email.placeholder')}
                  {...field}
                  disabled={true}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibility"
          render={({field}) => (
            <FormItem>
              <FormLabel>{t('visibility.label')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('visibility.placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="public">
                    {t('visibility.public')}
                  </SelectItem>
                  <SelectItem value="private">
                    {t('visibility.private')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="mb-8">
          {isSubmitting ? t('form.updating') : t('form.save')}
        </Button>
      </form>
    </Form>
  )
}
