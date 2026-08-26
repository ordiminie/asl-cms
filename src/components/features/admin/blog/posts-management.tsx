'use client'

import {Edit, Eye, FileText, MoreHorizontal, Plus} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'
import {toast} from 'sonner'

import {
  deletePostAction,
  updatePostAction,
} from '@/app/[locale]/admin/blog/actions'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CategoryDTO,
  POST_STATUS,
  PostData,
} from '@/services/types/domain/post-types'

import {DeletePostDialog} from './delete-post-dialog'
import {EditPostDialog} from './edit-post-dialog'
import {PostsPagination} from './posts-pagination'
import {PostsToolbar} from './posts-toolbar'

interface PostsManagementProps {
  initialPosts: PostData[]
  currentPage: number
  pageSize: number
  totalItems: number
  categories: CategoryDTO[]
  permissions: {
    canCreate: boolean
    canReadAll: boolean
    isAuthenticated: boolean
    isAdmin: boolean
  }
  initialFilters: {
    search: string
    status: string
    categoryId: string
  }
}

export function PostsManagement({
  initialPosts,
  currentPage,
  pageSize,
  totalItems,
  categories,
  permissions,
  initialFilters,
}: PostsManagementProps) {
  const t = useTranslations('AdminBlog')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialFilters.search)
  const [selectedStatus, setSelectedStatus] = useState(initialFilters.status)
  const [selectedCategory, setSelectedCategory] = useState(
    initialFilters.categoryId
  )

  const handleSearch = (value: string) => {
    setSearch(value)
    updateURL({search: value, page: '1'})
  }

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
    updateURL({status, page: '1'})
  }

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId)
    updateURL({categoryId, page: '1'})
  }

  const handlePageChange = (page: number) => {
    updateURL({page: page.toString()})
  }

  const handlePerPageChange = (perPage: string) => {
    updateURL({limit: perPage, page: '1'})
  }

  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.push(`?${params.toString()}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case POST_STATUS.PUBLISHED:
        return <Badge variant="default">{t('status.published')}</Badge>
      case POST_STATUS.DRAFT:
        return <Badge variant="secondary">{t('status.draft')}</Badge>
      case POST_STATUS.ARCHIVED:
        return <Badge variant="outline">{t('status.archived')}</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleUpdatePost = async (
    id: string,
    data: {status: string; categoryId?: string | null}
  ) => {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value as string)
      }
    })

    const result = await updatePostAction(id, formData)

    toast(result.success ? t('successTitle') : t('errorTitle'), {
      description: result.message,
      action: {
        label: 'Undo',
        onClick: () => console.log('Undo'),
      },
    })
  }

  const handleDeletePost = async (id: string) => {
    const result = await deletePostAction(id)

    toast(result.success ? t('successTitle') : t('errorTitle'), {
      description: result.message,
      action: {
        label: 'Undo',
        onClick: () => console.log('Undo'),
      },
    })
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className="flex-1 space-y-4 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Gestion des Posts
          </h2>
          <p className="text-muted-foreground">
            Gérez les articles de blog et leurs traductions
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => router.push('/admin/blog/new')}
            className="w-fit"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouveau post
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PostsToolbar
            onSearch={handleSearch}
            onStatusFilter={handleStatusFilter}
            onCategoryFilter={handleCategoryFilter}
            categories={categories}
            totalItems={totalItems}
            onPerPageChange={handlePerPageChange}
            perPage={pageSize.toString()}
            initialSearch={search}
            initialStatus={selectedStatus}
            initialCategory={selectedCategory}
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden">ID</TableHead>
                <TableHead>{t('columns.title')}</TableHead>
                <TableHead>{tCommon('fields.status')}</TableHead>
                <TableHead className="hidden md:table-cell">
                  Catégorie
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('columns.author')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('columns.views')}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t('columns.likes')}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t('columns.createdAt')}
                </TableHead>
                <TableHead>{tCommon('fields.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="hidden font-mono text-xs">
                    {post.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-48 min-w-0">
                    <button
                      onClick={() => router.push(`/admin/blog/${post.id}/edit`)}
                      className="hover:text-primary block w-full cursor-pointer text-left font-medium break-words hover:underline md:truncate"
                    >
                      {post.postTranslations?.find((t) => t.language === 'fr')
                        ?.title ||
                        post.postTranslations?.[0]?.title ||
                        t('untitled')}
                    </button>
                  </TableCell>
                  <TableCell>{getStatusBadge(post.status)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {categories.find((c) => c.id === post.categoryId)?.name ||
                      '-'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {post.author?.name || t('unknown')}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1">
                      <Eye className="text-muted-foreground h-4 w-4" />
                      {post.nbView || 0}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1">
                      <FileText className="text-muted-foreground h-4 w-4" />
                      {post.nbLike || 0}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(post.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {permissions.isAdmin && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/admin/blog/${post.id}/edit`)
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Modifier le post
                          </DropdownMenuItem>
                        )}
                        {permissions.isAdmin && (
                          <EditPostDialog
                            post={post}
                            categories={categories}
                            onSave={handleUpdatePost}
                          />
                        )}
                        {permissions.isAdmin && (
                          <DeletePostDialog
                            postId={post.id}
                            onDelete={handleDeletePost}
                          />
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {initialPosts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    Aucun post trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <PostsPagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / pageSize)}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
