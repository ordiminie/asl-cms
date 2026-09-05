'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {Key, Shield} from 'lucide-react'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {verifyBackupCodeAction} from '@/app/[locale]/(auth)/action'
import {Alert, AlertDescription} from '@/components/ui/alert'
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

export function RecoveryCodeForm() {
  const t = useTranslations('Auth.RecoveryCodeForm')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Schéma de validation avec traductions
  const recoveryCodeSchema = z.object({
    code: z
      .string()
      .min(1, t('validation.codeRequired'))
      .regex(/^[0-9A-Za-z-]+$/, t('validation.codeFormat')),
  })

  type RecoveryCodeFormValues = z.infer<typeof recoveryCodeSchema>

  const form = useForm<RecoveryCodeFormValues>({
    resolver: zodResolver(recoveryCodeSchema),
    defaultValues: {
      code: '',
    },
  })

  async function onSubmit(data: RecoveryCodeFormValues) {
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('code', data.code)

    const result = await verifyBackupCodeAction({success: false}, formData)
    setIsSubmitting(false)

    if (result.success) {
      toast(t('messages.success'), {
        description: result.message,
      })
    } else {
      toast(t('messages.error'), {
        description: result.message,
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <div className="flex items-center space-x-2">
          <Shield className="text-primary h-5 w-5" />
          <CardTitle className="text-xl">{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>{t('alertDescription')}</AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({field}) => (
                <FormItem>
                  <FormLabel>{t('codeLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      placeholder={t('codePlaceholder')}
                      className="text-center font-mono text-lg tracking-wider"
                      maxLength={12}
                      autoComplete="off"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('submitting') : t('submitButton')}
            </Button>
          </form>
        </Form>

        <div className="text-muted-foreground text-center text-sm">
          <p>
            {t('noCodeMessage')}{' '}
            <Link
              href="/login"
              className="hover:text-primary underline underline-offset-4"
            >
              {t('backToLogin')}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
