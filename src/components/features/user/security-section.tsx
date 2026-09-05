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

export function UserSecurityFactorSection({user}: {user: User}) {
  return (
    <div className="space-y-6">
      {AuthClientAppConfig.changeEmail && shouldShowChangeEmail() && (
        <Card>
          <CardContent className="pt-6">
            <ChangeEmailForm user={user} />
          </CardContent>
        </Card>
      )}

      {AuthClientAppConfig.changePassword && shouldShowChangePassword() && (
        <Card>
          <CardContent className="pt-6">
            <ChangePasswordForm />
          </CardContent>
        </Card>
      )}

      {AuthClientAppConfig.enable2FA && shouldShow2FA() && (
        <Card>
          <CardContent className="pt-6">
            <TwoFactorForm user={user} />
          </CardContent>
        </Card>
      )}

      {AuthClientAppConfig.enableTokenManagement && <ListTokensSection />}
    </div>
  )
}
