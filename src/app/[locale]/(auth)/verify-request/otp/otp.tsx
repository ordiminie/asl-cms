'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {isRedirectError} from 'next/dist/client/components/redirect-error'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'

import {verifyOTPAction} from '@/app/[locale]/(auth)/action'
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

const verifyOtpCode = async (code: string) => {
  const formData = new FormData()
  formData.append('code', code)
  return verifyOTPAction({success: false, message: ''}, formData)
}

type VerificationResult = Awaited<ReturnType<typeof verifyOtpCode>>

export default function OtpVerificationPage() {
  const t = useTranslations('Auth.OtpVerificationPage')
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code') ?? ''
  const [isLoading, setIsLoading] = useState(codeFromUrl.length === 6)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const hasSentOtp = useRef(false)

  // Schéma de validation avec traductions
  const otpSchema = z.object({
    code: z
      .string()
      .min(6, t('validation.codeRequired'))
      .max(6, t('validation.codeRequired'))
      .regex(/^\d{6}$/, t('validation.codeFormat')),
  })

  type OtpFormValues = z.infer<typeof otpSchema>

  const form = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      code: codeFromUrl,
    },
  })

  const sendOtp = useCallback(async () => {
    // Éviter le double envoi en mode DEV
    if (hasSentOtp.current) {
      return
    }

    try {
      setIsSendingOtp(true)
      hasSentOtp.current = true // Marquer comme envoyé immédiatement

      const {error} = await authClient.twoFactor.sendOtp()

      if (error) {
        toast.error(t('messages.otpSendError'))
        console.error('sendOtp error:', error)
      } else {
        toast.success(t('messages.otpSent'))
      }
    } catch (error) {
      toast.error(t('messages.otpSendError'))
      console.error('sendOtp error:', error)
    } finally {
      setIsSendingOtp(false)
    }
  }, [t])

  const applyVerificationResult = (result: VerificationResult) => {
    if (result.success) {
      toast.success(t('messages.verificationSuccess'))
      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } else {
      toast.error(result.message || t('messages.verificationError'))
    }
  }

  const applyVerificationError = (error: unknown) => {
    if (isRedirectError(error)) {
      toast.success(t('messages.redirecting'))
    } else {
      toast.error(t('messages.verificationError'))
    }
  }

  const handleVerifyCode = async (code: string) => {
    setIsLoading(true)
    try {
      applyVerificationResult(await verifyOtpCode(code))
    } catch (error) {
      applyVerificationError(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Si on a un code dans l'URL, on le vérifie automatiquement
  useEffect(() => {
    if (codeFromUrl.length !== 6) return

    let cancelled = false

    const verify = async () => {
      try {
        const result = await verifyOtpCode(codeFromUrl)
        if (cancelled) return
        applyVerificationResult(result)
      } catch (error) {
        if (cancelled) return
        applyVerificationError(error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void verify()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl])

  // Envoyer l'OTP seulement si pas de code dans l'URL
  useEffect(() => {
    if (!codeFromUrl && !hasSentOtp.current) {
      sendOtp()
    }
  }, [codeFromUrl, sendOtp])

  const onSubmit = async (data: OtpFormValues) => {
    await handleVerifyCode(data.code)
  }

  return (
    <div className="lg:p-8">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('title')}</CardTitle>
            <CardDescription>
              {codeFromUrl
                ? t('descriptionAutomatic')
                : isSendingOtp
                  ? t('descriptionSending')
                  : t('description')}
            </CardDescription>
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
                          disabled={isLoading || isSendingOtp || !!codeFromUrl}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isSendingOtp || !!codeFromUrl}
                >
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
