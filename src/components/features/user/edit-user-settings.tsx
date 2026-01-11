'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Switch} from '@/components/ui/switch'
import {User} from '@/services/types/domain/user-types'
import {languageSchema} from '@/services/validation/user-validation'

import {updateUserSettingsAction} from './action'

const settingsFormSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  language: languageSchema,
  timezone: z.string(),
  //enableTwoFactor: z.boolean(),
  enableEmailNotifications: z.boolean(),
  enablePushNotifications: z.boolean(),
  notificationChannel: z.enum(['email', 'push', 'both', 'none']),
  emailDigest: z.boolean(),
  marketingEmails: z.boolean(),
})

type FormValues = z.infer<typeof settingsFormSchema>

export function EditUserSettingsForm({user}: {user: User}) {
  const t = useTranslations('AccountSettingsPage')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      theme: user?.settings?.theme ?? 'system',
      language: user?.settings?.language ?? 'fr',
      timezone: user?.settings?.timezone ?? 'Europe/Paris',
      enableEmailNotifications:
        user?.settings?.enableEmailNotifications ?? true,
      enablePushNotifications: user?.settings?.enablePushNotifications ?? true,
      notificationChannel: user?.settings?.notificationChannel ?? 'both',
      emailDigest: user?.settings?.emailDigest ?? true,
      marketingEmails: user?.settings?.marketingEmails ?? false,
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

    const result = await updateUserSettingsAction(undefined, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('form.success'), {
        description: result.message,
      })
    } else {
      for (const error of result?.errors ?? []) {
        form.setError(error.field as never, {
          type: 'manual',
          message: error.message,
        })
      }
      toast(t('form.error'), {
        description: result.message,
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Apparence */}
        <Card>
          <CardHeader>
            <CardTitle>{t('appearance.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="theme"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('appearance.theme.label')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('appearance.theme.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="light">
                        {t('appearance.theme.light')}
                      </SelectItem>
                      <SelectItem value="dark">
                        {t('appearance.theme.dark')}
                      </SelectItem>
                      <SelectItem value="system">
                        {t('appearance.theme.system')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('appearance.language.label')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('appearance.language.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fr">
                        {t('appearance.language.fr')}
                      </SelectItem>
                      <SelectItem value="en">
                        {t('appearance.language.en')}
                      </SelectItem>
                      <SelectItem value="es">
                        {t('appearance.language.es')}
                      </SelectItem>
                      <SelectItem value="de">
                        {t('appearance.language.de')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>{t('notifications.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="notificationChannel"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('notifications.channel.label')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t('notifications.channel.placeholder')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">
                        {t('notifications.channel.email')}
                      </SelectItem>
                      <SelectItem value="push">
                        {t('notifications.channel.push')}
                      </SelectItem>
                      <SelectItem value="both">
                        {t('notifications.channel.both')}
                      </SelectItem>
                      <SelectItem value="none">
                        {t('notifications.channel.none')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableEmailNotifications"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('notifications.emailNotifications.title')}
                    </FormLabel>
                    <FormDescription>
                      {t('notifications.emailNotifications.description')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enablePushNotifications"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('notifications.pushNotifications.title')}
                    </FormLabel>
                    <FormDescription>
                      {t('notifications.pushNotifications.description')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailDigest"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('notifications.emailDigest.title')}
                    </FormLabel>
                    <FormDescription>
                      {t('notifications.emailDigest.description')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Marketing */}
        <Card>
          <CardHeader>
            <CardTitle>{t('marketing.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="marketingEmails"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('marketing.marketingEmails.title')}
                    </FormLabel>
                    <FormDescription>
                      {t('marketing.marketingEmails.description')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('form.updating') : t('form.updateSettings')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
