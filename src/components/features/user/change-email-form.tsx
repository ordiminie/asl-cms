'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {User} from '@/services/types/domain/user-types'

import {changeEmailAction} from './action'
import {changeEmailFormSchema} from './user-form-validation'

type FormValues = z.infer<typeof changeEmailFormSchema>

export function ChangeEmailForm({user}: {user: User}) {
  const t = useTranslations('AccountPage.UserSecuritySection.changeEmail')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(changeEmailFormSchema),
    defaultValues: {
      newEmail: '',
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    const formData = new FormData()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString())
      }
    }

    const result = await changeEmailAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('success'), {
        description: result.message,
      })

      // Réinitialiser le formulaire après succès
      form.reset()
      setShowModal(false)
    } else {
      for (const error of result?.errors ?? []) {
        form.setError(error.field as never, {
          type: 'manual',
          message: error.message,
        })
      }
      toast(t('error'), {
        description: result.message,
      })
    }
  }

  const handleCancel = () => {
    setShowModal(false)
    form.reset()
  }

  return (
    <>
      <div className="space-y-4">
        <h4 className="text-sm font-medium">{t('title')}</h4>

        <div className="flex flex-col gap-4 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between sm:border">
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium">{t('currentEmail')}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowModal(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {t('submit')}
          </Button>
        </div>
      </div>

      {/* Modal pour le changement d'email */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newEmail"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{t('newEmail')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="nouveau@email.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('updating') : t('submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
