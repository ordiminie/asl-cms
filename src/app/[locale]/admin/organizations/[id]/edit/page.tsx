import {Users, Zap} from 'lucide-react'
import {notFound} from 'next/navigation'
import {getTranslations} from 'next-intl/server'
import {Suspense} from 'react'

import {
  getOrganizationPermissions,
  getOrganizationUsageDal,
} from '@/app/dal/organization-dal'
import {OrganizationModulesCard} from '@/components/features/admin/organizations/organization-modules-card'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import OrganizationMembersTable from '@/components/features/organization/organization-members-table'
import {Badge} from '@/components/ui/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Progress} from '@/components/ui/progress'
import {getOrganizationByIdService} from '@/services/facades/organization-service-facade'

async function EditOrganizationPage({params}: {params: Promise<{id: string}>}) {
  const t = await getTranslations('AdminOrganizations')
  const tOrgs = await getTranslations('Organizations')
  const {id} = await params
  const [organization, usage, permissions] = await Promise.all([
    getOrganizationByIdService(id),
    getOrganizationUsageDal(id),
    getOrganizationPermissions(id),
  ])
  const {canReadMembers, canManageMembers} = permissions

  if (!organization) {
    notFound()
  }

  const formatUsage = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) {
      return `${used} / ∞`
    }
    return `${used} / ${limit}`
  }

  const getUsagePercent = (used: number, limit: number | null) => {
    if (limit === null || limit === -1 || limit === 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getProgressColor = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) return 'bg-green-500'
    const ratio = used / limit
    if (ratio >= 1) return 'bg-red-500'
    if (ratio >= 0.8) return 'bg-orange-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-8 text-2xl font-bold">{t('editTitle')}</h1>
      </div>

      <div className="mx-auto mt-12">
        <OrganizationModulesCard
          organizationId={organization.id}
          enabledModules={organization.enabledModules}
        />
      </div>

      <div className="mx-auto mt-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>{tOrgs('usage')}</span>
              </CardTitle>
              <Badge variant="outline" className="uppercase">
                {usage.plan}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {tOrgs('members')}
                  </span>
                  <span className="font-medium">
                    {formatUsage(usage.users, usage.limits.users)}
                  </span>
                </div>
                <Progress
                  value={getUsagePercent(usage.users, usage.limits.users)}
                  className="h-2"
                  indicatorClassName={getProgressColor(
                    usage.users,
                    usage.limits.users
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mx-auto mt-12">
        <h2 className="mb-4 text-xl font-semibold">{tOrgs('membersTitle')}</h2>
        {canReadMembers ? (
          <Suspense fallback={<div>{tOrgs('loadingMembers')}</div>}>
            <OrganizationMembersTable
              organizationId={organization.id}
              canManageMembers={canManageMembers}
              adminView={true}
            />
          </Suspense>
        ) : (
          <p className="text-muted-foreground text-sm">
            Vous n&apos;avez pas les droits nécessaires pour voir les membres de
            cette organisation.
          </p>
        )}
      </div>
    </div>
  )
}

export default withAuthAdmin(EditOrganizationPage)
