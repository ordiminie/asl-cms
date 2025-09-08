'use client'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import React from 'react'
import {useActionState} from 'react'
import {useFormStatus} from 'react-dom'
import {z} from 'zod'

import {loginCredentialAction} from '@/app/[locale]/(auth)/action'
import {authLoginFormSchema} from '@/components/features/auth/auth-form-validation'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {env} from '@/env'

type LoginValidationError = {
  field: keyof z.infer<typeof authLoginFormSchema>
  message: string
}

type LoginFormState = {
  success: boolean
  errors?: LoginValidationError[]
  message?: string
}

export function CredentialForm() {
  const t = useTranslations('Auth.CredentialForm')
  const tLogin = useTranslations('Auth.LoginForm')

  const authMethods = env.NEXT_PUBLIC_AUTH_METHODS
  const hasOtherMethods = authMethods.length > 1

  const [state, formAction] = useActionState<LoginFormState, FormData>(
    loginCredentialAction,
    {
      success: false,
      message: '',
      errors: [],
    }
  )

  const error = state && !state.success ? state.message : null

  return (
    <form action={formAction}>
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}
      <div className="grid gap-6">
        {hasOtherMethods && (
          <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            <span className="bg-background text-muted-foreground relative z-10 px-2">
              {t('orContinueWith')}
            </span>
          </div>
        )}
        <div className="grid gap-6">
          <div className="grid gap-3">
            <Label htmlFor="email">{t('email.label')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={'user@gmail.com'}
              placeholder={t('email.placeholder')}
              required
            />
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('password.label')}</Label>
              <div className="flex flex-col items-end space-y-1">
                <Link
                  href="/reset-password"
                  className="text-sm underline-offset-4 hover:underline"
                >
                  {t('password.forgotPassword')}
                </Link>
              </div>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              defaultValue={'Azerty123'}
              required
            />
          </div>
          <SubmitButton />
        </div>
        <div className="text-center text-sm">
          {tLogin('noAccount')}{' '}
          <Link href="/register" className="underline underline-offset-4">
            {tLogin('signUpLink')}
          </Link>
        </div>
      </div>
    </form>
  )
}

function SubmitButton() {
  const t = useTranslations('Auth.CredentialForm')
  const {pending} = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t('submitting') : t('submit')}
    </Button>
  )
}
