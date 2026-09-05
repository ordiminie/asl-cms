import {GalleryVerticalEnd} from 'lucide-react'
import {Metadata} from 'next/types'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import React from 'react'

import {RegisterForm} from '@/components/features/auth/forms/register-form'
import {APP_NAME} from '@/lib/constants'

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>
}): Promise<Metadata> {
  const {locale} = await params
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'Auth.RegisterPage'})

  return {
    title: t('metadata.title'),
    description: t('metadata.description'),
  }
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{locale: string}>
}) {
  const {locale} = await params
  setRequestLocale(locale)

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-4" />
          </div>
          {APP_NAME}
        </a>
        <RegisterForm />
      </div>
    </div>
  )
}
