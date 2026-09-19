'use client'
import Link from 'next/link'
import {useTranslations} from 'next-intl'
import React from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {cn} from '@/lib/utils'

import {CredentialForm} from './credential-form'

/**
 * Connexion par mot de passe (acces prestataire, s03) : les identifiants
 * seuls, sans inscription, sans lien magique ni fournisseur tiers. Les membres
 * se connectent par lien, a `/login`.
 */
export function LoginForm({className, ...props}: React.ComponentProps<'div'>) {
  const t = useTranslations('Auth.LoginForm')

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t('welcome')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialForm />
        </CardContent>
      </Card>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-muted-foreground *:[a]:hover:text-primary text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          {t('terms')} <Link href="/terms">{t('termsLink')}</Link> {t('and')}{' '}
          <Link href="/privacy">{t('privacyLink')}</Link>.
        </div>
      </div>
    </div>
  )
}
