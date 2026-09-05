'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import React, {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

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
import {authClient} from '@/lib/better-auth/auth-client'

export default function TotpVerificationPage() {
  const t = useTranslations('Auth.TotpVerificationPage')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Schéma de validation avec traductions
  const totpSchema = z.object({
    code: z
      .string()
      .min(6, t('validation.codeRequired'))
      .max(6, t('validation.codeRequired'))
      .regex(/^\d{6}$/, t('validation.codeFormat')),
  })

  type TotpFormValues = z.infer<typeof totpSchema>

  const form = useForm<TotpFormValues>({
    resolver: zodResolver(totpSchema),
    defaultValues: {
      code: '',
    },
  })

  const verifyTotp = async (code: string) => {
    const {data, error} = await authClient.twoFactor.verifyTotp({code})
    return {data, error}
  }

  const onSubmit = async (data: TotpFormValues) => {
    setIsLoading(true)
    try {
      const {error} = await verifyTotp(data.code)

      if (error) {
        toast.error(error.message || t('messages.verificationError'))
        return
      }

      toast.success(t('messages.verificationSuccess'))
      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch {
      toast.error(t('messages.generalError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('title')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="code"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>{t('codeLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={t('codePlaceholder')}
                          maxLength={6}
                          className="text-center text-lg tracking-widest"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('submitting') : t('submitButton')}
                </Button>
              </form>
            </Form>
            <div className="mt-4 space-y-2 text-center">
              <div>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-primary text-sm"
                >
                  {t('backToLogin')}
                </Link>
              </div>
              <div>
                <Link
                  href="/verify-request/recovery"
                  className="text-muted-foreground hover:text-primary text-sm underline underline-offset-4"
                >
                  {t('useBackupCode')}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          {t('terms')} <Link href="/terms">{t('termsLink')}</Link> {t('and')}{' '}
          <Link href="/privacy">{t('privacyLink')}</Link>.
        </div>
      </div>
    </div>
  )
}
