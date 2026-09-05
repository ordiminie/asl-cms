'use client'
import {useTranslations} from 'next-intl'
import React from 'react'
import {useActionState} from 'react'
import {useFormStatus} from 'react-dom'

import {loginMagicLinkAction} from '@/app/[locale]/(auth)/action'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

type MagicLinkValidationError = {
  field: 'email'
  message: string
}

type MagicLinkFormState = {
  success: boolean
  errors?: MagicLinkValidationError[]
  message?: string
}

export function MagicLinkForm() {
  const t = useTranslations('Auth.MagicLinkForm')

  const [state, formAction] = useActionState<MagicLinkFormState, FormData>(
    loginMagicLinkAction,
    {
      success: false,
      message: '',
      errors: [],
    }
  )

  const error = state && !state.success ? state.message : null
  const success = state?.success ? state.message : null

  return (
    <form action={formAction}>
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-500">{success}</div>}
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
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const t = useTranslations('Auth.MagicLinkForm')
  const {pending} = useFormStatus()

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t('submitting') : t('submit')}
    </Button>
  )
}
