'use client'

import {formatDistanceToNow} from 'date-fns'
import {fr} from 'date-fns/locale'
import {Eye, Loader2} from 'lucide-react'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useCallback, useEffect} from 'react'
import {toast} from 'sonner'

import {
  deleteUserAction,
  fetchUsersAction,
  updateUserAction,
} from '@/app/[locale]/admin/users/actions'
import {useInfiniteScroll} from '@/components/hooks/use-infinite-scroll'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {User} from '@/services/types/domain/user-types'

import {DeleteUserDialog} from './delete-user-dialog'
import {EditUserDialog} from './edit-user-dialog'
import {UsersPagination} from './users-pagination'
import {UsersToolbar} from './users-toolbar'

const IS_INFINITE_SCROLL = true
const PAGE_SIZE = 5

interface Props {
  initialUsers: User[]
  currentPage: number
  pageSize: number
  totalUsers: number
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canManage: boolean
  }
  searchQuery: string
}

export default function UsersManagement({
  initialUsers,
  currentPage,
  pageSize,
  totalUsers,
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

  // Infinite scroll logic
  const fetchMoreUsers = useCallback(
    async (offset: number) => {
      const result = await fetchUsersAction({
        limit: PAGE_SIZE,
        offset,
        search: searchQuery || undefined,
      })
      if (result.success && result.pagination) {
        return {
          data: result.data,
          hasMore: result.pagination.hasMore,
        }
      }
      return {data: [], hasMore: false}
    },
    [searchQuery]
  )

  const {
    items: infiniteUsers,
    isLoading: isLoadingMore,
    hasMore,
    sentinelRef,
    reset,
  } = useInfiniteScroll({
    initialData: IS_INFINITE_SCROLL
      ? initialUsers.slice(0, PAGE_SIZE)
      : initialUsers,
    initialHasMore: IS_INFINITE_SCROLL ? totalUsers > PAGE_SIZE : false,
    fetchMore: fetchMoreUsers,
    pageSize: PAGE_SIZE,
    enabled: IS_INFINITE_SCROLL,
  })

  useEffect(() => {
    reset(initialUsers.slice(0, PAGE_SIZE), totalUsers > PAGE_SIZE)
  }, [initialUsers, totalUsers, reset])

  const users = IS_INFINITE_SCROLL ? infiniteUsers : initialUsers

  const getUserRoleDisplay = (role?: string) => {
    if (!role) return 'Public'
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'moderator':
        return 'Modérateur'
      case 'user':
        return 'Utilisateur'
      case 'redactor':
        return 'Rédacteur'
      case 'super_admin':
        return 'Super Admin'
      default:
        return 'Public'
    }
  }

  const getUserStatusDisplay = (user: User) => {
    const isVerified = user.emailVerified
    return isVerified ? 'Actif' : 'En attente'
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Gestion des utilisateurs</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <UsersToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalUsers={totalUsers}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
          showPerPageSelector={!IS_INFINITE_SCROLL}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden lg:table-cell">Rôle</TableHead>
              <TableHead className="hidden lg:table-cell">Statut</TableHead>
              <TableHead className="hidden md:table-cell">Créé</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="flex w-auto min-w-0 items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage src={user.image || ''} alt={user.name} />
                    <AvatarFallback>
                      {user.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('') || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {user.visibility === 'public' ? 'Public' : 'Privé'}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="w-28 min-w-0 break-all md:w-auto">
                  {user.email}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant="outline">
                    {getUserRoleDisplay(user.role)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge
                    variant={
                      getUserStatusDisplay(user) === 'Actif'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {getUserStatusDisplay(user)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                  {formatDistanceToNow(new Date(user.createdAt || ''), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Voir les détails</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {permissions.canEdit && (
                      <EditUserDialog
                        user={user}
                        onSave={async (id, data) => {
                          const formData = new FormData()
                          formData.append('name', data.name)
                          formData.append('email', data.email)
                          formData.append('visibility', data.visibility)

                          const result = await updateUserAction(
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
                      <DeleteUserDialog
                        userId={user.id}
                        userName={user.name}
                        onDelete={async (id) => {
                          const result = await deleteUserAction(id)

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

        {/* Infinite Scroll Sentinel */}
        {IS_INFINITE_SCROLL && (hasMore || isLoadingMore) && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {isLoadingMore && (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            )}
          </div>
        )}

        {/* Traditional Pagination */}
        {!IS_INFINITE_SCROLL && (
          <UsersPagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalUsers / pageSize)}
            onPageChange={handlePageChange}
          />
        )}
      </CardContent>
    </Card>
  )
}
