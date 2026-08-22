'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Edit} from 'lucide-react'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'
import {useForm} from 'react-hook-form'
import * as z from 'zod'

import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {User} from '@/services/types/domain/user-types'

// Schéma de validation
const formSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  visibility: z.enum(['public', 'private'], {
    message: 'La visibilité est requise',
  }),
})

type FormValues = z.infer<typeof formSchema>

interface EditUserDialogProps {
  user: User
  onSave: (id: string, data: FormValues) => Promise<void>
}

export function EditUserDialog({user, onSave}: EditUserDialogProps) {
  const t = useTranslations('AdminUsers')
  const tCommon = useTranslations('Common')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      visibility: user.visibility,
    },
  })

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      await onSave(user.id, data)
      setIsDialogOpen(false)
      form.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{tCommon('actions.edit')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription>
            Modifiez les informations de l&apos;utilisateur et cliquez sur
            Enregistrer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{tCommon('fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>{tCommon('fields.email')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
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
                  <FormLabel>{tCommon('fields.visibility')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectVisibility')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">
                        {tCommon('states.public')}
                      </SelectItem>
                      <SelectItem value="private">
                        {tCommon('states.private')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('saving') : tCommon('actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
