import {Lock} from 'lucide-react'
import {useTranslations} from 'next-intl'

import {
  ImpersonationExitButton,
  StopImpersonationActionResult,
} from '@/components/features/impersonation/impersonation-exit-button'
import {Card, CardContent} from '@/components/ui/card'
import {AuthClientAppConfig} from '@/lib/better-auth/auth-client'
import {
  shouldShow2FA,
  shouldShowChangeEmail,
  shouldShowChangePassword,
} from '@/lib/helper/auth-helper'
import {User} from '@/services/types/domain/user-types'

import {ChangeEmailForm} from './change-email-form'
import {ChangePasswordForm} from './change-password-form'
import {ListTokensSection} from './list-tokens-section'
import {TwoFactorForm} from './two-factor-form'

type ImpersonationLock = {
  subjectName: string
  stopAction: () => Promise<StopImpersonationActionResult>
}

/**
 * Note qui remplace une section sensible pendant une session a la place d'un
 * compte (s48, ecran 5) : fond `muted`, icone `Lock`, et la sortie.
 */
function LockedWhileImpersonating({
  title,
  impersonation,
}: {
  title: string
  impersonation: ImpersonationLock
}) {
  const t = useTranslations('Impersonation')
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="bg-muted border-border flex flex-col gap-4 rounded-md border p-4">
        <p className="flex items-start gap-3 text-base">
          <Lock className="mt-1 size-5 shrink-0" aria-hidden="true" />
          <span>{t('account.locked', {name: impersonation.subjectName})}</span>
        </p>
        <div>
          <ImpersonationExitButton stopAction={impersonation.stopAction} />
        </div>
      </div>
    </div>
  )
}

export function UserSecurityFactorSection({
  user,
  impersonation,
}: {
  user: User
  /** Pendant une session a la place d'un compte (s48) : sections verrouillees. */
  impersonation?: ImpersonationLock
}) {
  const t = useTranslations('AccountPage.UserSecuritySection')
  const section = (key: string, form: React.ReactNode) => (
    <Card>
      <CardContent className="pt-6">
        {impersonation ? (
          <LockedWhileImpersonating
            title={t(`${key}.title`)}
            impersonation={impersonation}
          />
        ) : (
          form
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 lg:space-y-8">
      {AuthClientAppConfig.changeEmail &&
        shouldShowChangeEmail() &&
        section('changeEmail', <ChangeEmailForm user={user} />)}

      {AuthClientAppConfig.changePassword &&
        shouldShowChangePassword() &&
        section('changePassword', <ChangePasswordForm />)}

      {AuthClientAppConfig.enable2FA &&
        shouldShow2FA() &&
        section('twoFactor', <TwoFactorForm user={user} />)}

      {AuthClientAppConfig.enableTokenManagement && <ListTokensSection />}
    </div>
  )
}
