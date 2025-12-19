'use client'

import {formatDistanceToNow} from 'date-fns'
import {fr} from 'date-fns/locale'
import {Building2, Users} from 'lucide-react'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {toast} from 'sonner'

import {
  deleteOrganizationAction,
  updateOrganizationAction,
} from '@/app/[locale]/admin/organizations/actions'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {Organization} from '@/services/types/domain/organization-types'

import {DeleteOrganizationDialog} from './delete-organization-dialog'
import {EditOrganizationDialog} from './edit-organization-dialog'
import {OrganizationsPagination} from './organizations-pagination'
import {OrganizationsToolbar} from './organizations-toolbar'

interface Props {
  initialOrganizations: Organization[]
  currentPage: number
  pageSize: number
  totalOrganizations: number
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
  }
  searchQuery: string
}

export default function OrganizationsManagement({
  initialOrganizations,
  currentPage,
  pageSize,
  totalOrganizations,
  permissions,
  searchQuery,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('search', search)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const handlePerPageChange = (limit: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', limit)
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const getOrganizationInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Gestion des organisations</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <OrganizationsToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalOrganizations={totalOrganizations}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead className="hidden md:table-cell">Slug</TableHead>
              <TableHead className="hidden xl:table-cell">
                Description
              </TableHead>
              <TableHead className="hidden lg:table-cell">Créée</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialOrganizations.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage
                      src={organization.logo || ''}
                      alt={organization.name}
                    />
                    <AvatarFallback>
                      {organization.logo ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        getOrganizationInitials(organization.name)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{organization.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {organization.slug}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline">{organization.slug}</Badge>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="truncate">
                    {organization.description || 'Aucune description'}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {organization.createdAt &&
                    formatDistanceToNow(new Date(organization.createdAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {permissions.canManage && (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/admin/organizations/${organization.id}/edit`}
                        >
                          <Users className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">
                            Éditer membres
                          </span>
                        </Link>
                      </Button>
                    )}
                    {permissions.canEdit && (
                      <EditOrganizationDialog
                        organization={organization}
                        onSave={async (id, data) => {
                          const formData = new FormData()
                          formData.append('name', data.name)
                          formData.append('slug', data.slug)
                          if (data.description) {
                            formData.append('description', data.description)
                          }
                          if (data.limitOverrides) {
                            formData.append(
                              'limitOverrides',
                              JSON.stringify(data.limitOverrides)
                            )
                          }

                          const result = await updateOrganizationAction(
                            id,
                            undefined,
                            formData
                          )

                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      />
                    )}
                    {permissions.canDelete && (
                      <DeleteOrganizationDialog
                        organizationId={organization.id}
                        organizationName={organization.name}
                        onDelete={async (id) => {
                          const result = await deleteOrganizationAction(id)

                          if (result.success) {
                            toast.success(result.message)
                          } else {
                            toast.error(result.message)
                          }
                        }}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <OrganizationsPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalOrganizations / pageSize)}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  )
}
