import {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'

import {ProvisionOrganizationForm} from '@/components/features/admin/organizations/provision-organization-form'
import withAuth from '@/components/features/auth/with-auth'
import {RoleConst} from '@/services/types/domain/auth-types'

export const metadata: Metadata = {
  title: 'Provisionner une association',
}

/**
 * Ecran A de s01 : **une page, pas un dialogue** — le design system limite
 * `dialog` a deux champs et cet ecran en porte cinq. Le fil d'Ariane vient du
 * gabarit du back-office (`admin/layout.tsx`).
 */
async function ProvisionOrganizationPage() {
  const t = await getTranslations('AdminOrganizations.provision')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <ProvisionOrganizationForm />
    </div>
  )
}

export default withAuth(ProvisionOrganizationPage, RoleConst.SUPER_ADMIN)
