'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'
import React, {Suspense, useState} from 'react'
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

export default function ResetPasswordPage() {
  const t = useTranslations('Auth.ResetPasswordForm')

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const router = useRouter()

  // Schéma de validation avec traductions
  const resetPasswordSchema = z
    .object({
      password: z
        .string()
        .min(8, t('validation.passwordMin'))
        .max(100, t('validation.passwordMax')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsMismatch'),
      path: ['confirmPassword'],
    })

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const {error} = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(t('emailSent'))
      setTimeout(() => {
        router.push('/verify-request')
      }, 2000)
    } catch {
      toast.error(t('errorOccurred'))
    } finally {
      setIsLoading(false)
    }
  }

  const onResetPassword = async (data: ResetPasswordFormValues) => {
    setIsLoading(true)
    try {
      const {error} = await authClient.resetPassword({
        newPassword: data.password,
        token: token || '',
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(t('passwordResetSuccess'))
      // Rediriger vers la page de connexion après 2 secondes
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch {
      toast.error(t('errorOccurred'))
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('requestTitle')}</CardTitle>
            <CardDescription>{t('requestDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t('email.label')}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('email.placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('sendingLink') : t('sendLink')}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          {t('terms')} <Link href="/terms">{t('termsLink')}</Link> {t('and')}{' '}
          <Link href="/privacy">{t('privacyLink')}</Link>.
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('resetTitle')}</CardTitle>
            <CardDescription>{t('resetDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onResetPassword)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>{t('password.label')}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>{t('confirmPassword.label')}</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('resetting') : t('resetPassword')}
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-muted-foreground hover:text-primary text-sm"
              >
                {t('backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Suspense>
  )
}
