import {Zap} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {getUserOrganizationsWithUsageDal} from '@/app/dal/organization-dal'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {Progress} from '@/components/ui/progress'
import {PagesConst} from '@/env'
import {sortOrganizationsByRole} from '@/lib/helper/organization-helper'
import {isPageEnabled} from '@/lib/utils'
import {canUpdateOrganization} from '@/services/authorization/organization-authorization'
import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'

export default async function OrganizationsPage() {
  if (!isPageEnabled(PagesConst.ORGANIZATION)) {
    return notFound()
  }

  const organizationsWithUsage = await getUserOrganizationsWithUsageDal()

  // Trier les organisations par rôle : OWNER en premier, puis ADMIN, puis les autres
  const sortedOrganizations = sortOrganizationsByRole(organizationsWithUsage)

  const permissions = Object.fromEntries(
    await Promise.all(
      sortedOrganizations.map(async (org) => [
        org.id,
        await canUpdateOrganization(org.id),
      ])
    )
  )

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
    <div className="flex-1 space-y-8 p-4 pt-6 sm:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Mes Organisations
        </h2>
      </div>

      <div>
        {sortedOrganizations.length === 0 ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Vous n&apos;avez pas encore d&apos;organisation.
            </p>
            <Button asChild>
              <Link href="/account/organizations/new">
                Créer votre première organisation
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sortedOrganizations.map((organization) => (
              <Card
                key={organization.id}
                className={
                  organization.role === UserOrganizationRoleConst.OWNER
                    ? 'ring-primary/20 border-primary/30 ring-2'
                    : ''
                }
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="flex-1">
                      {organization.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="uppercase">
                        {organization.usage.plan}
                      </Badge>
                      {organization.role ===
                        UserOrganizationRoleConst.OWNER && (
                        <Badge variant="default">Propriétaire</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {organization.logo && (
                    <div className="relative mb-4 h-32 w-full">
                      <Image
                        src={organization.logo}
                        alt={organization.name}
                        fill
                        className="rounded-md object-cover"
                      />
                    </div>
                  )}

                  {/* Usage Stats */}
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4" />
                      Utilisation
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">Projets</span>
                          <span>
                            {formatUsage(
                              organization.usage.projects,
                              organization.usage.limits.projects
                            )}
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercent(
                            organization.usage.projects,
                            organization.usage.limits.projects
                          )}
                          className="h-1.5"
                          indicatorClassName={getProgressColor(
                            organization.usage.projects,
                            organization.usage.limits.projects
                          )}
                        />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-muted-foreground">Membres</span>
                          <span>
                            {formatUsage(
                              organization.usage.users,
                              organization.usage.limits.users
                            )}
                          </span>
                        </div>
                        <Progress
                          value={getUsagePercent(
                            organization.usage.users,
                            organization.usage.limits.users
                          )}
                          className="h-1.5"
                          indicatorClassName={getProgressColor(
                            organization.usage.users,
                            organization.usage.limits.users
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Rôle:{' '}
                      {organization.role === UserOrganizationRoleConst.OWNER
                        ? 'Propriétaire'
                        : organization.role === UserOrganizationRoleConst.ADMIN
                          ? 'Administrateur'
                          : 'Membre'}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" asChild>
                    <Link href={`/team/${organization.slug}`}>
                      Voir les détails
                    </Link>
                  </Button>
                  {permissions[organization.id] && (
                    <Button asChild>
                      <Link
                        href={`/account/organizations/${organization.id}/edit`}
                      >
                        Modifier
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
