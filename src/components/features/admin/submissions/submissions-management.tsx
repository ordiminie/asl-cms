'use client'

import {formatDistanceToNow} from 'date-fns'
import {fr} from 'date-fns/locale'
import {Archive, Eye, Mail, MessageSquare, Phone} from 'lucide-react'
import {useRouter, useSearchParams} from 'next/navigation'
import {toast} from 'sonner'

import {
  archiveSubmissionAction,
  markAsReadAction,
} from '@/app/[locale]/admin/submissions/actions'
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
import {UserSubmissionWithUser} from '@/services/types/domain/user-submission-types'

import {SubmissionDetailDialog} from './submission-detail-dialog'
import {SubmissionsPagination} from './submissions-pagination'
import {SubmissionsToolbar} from './submissions-toolbar'

interface Props {
  initialSubmissions: UserSubmissionWithUser[]
  currentPage: number
  pageSize: number
  totalSubmissions: number
  permissions: {
    canRead: boolean
    canMarkAsRead: boolean
    canArchive: boolean
    canManage: boolean
  }
  searchQuery: string
  typeFilter?: 'contact' | 'feedback' | 'support'
  readFilter?: boolean
}

const typeLabels = {
  contact: 'Contact',
  feedback: 'Feedback',
  support: 'Support',
}

const typeIcons = {
  contact: Mail,
  feedback: MessageSquare,
  support: Phone,
}

export default function SubmissionsManagement({
  initialSubmissions,
  currentPage,
  pageSize,
  totalSubmissions,
  permissions,
  searchQuery,
  typeFilter,
  readFilter,
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

  const handleTypeChange = (type: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (type === 'all') {
      params.delete('type')
    } else {
      params.set('type', type)
    }
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handleReadChange = (read: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (read === 'all') {
      params.delete('read')
    } else {
      params.set('read', read)
    }
    params.set('page', '1')
    router.push(`?${params.toString()}`)
  }

  const handleMarkAsRead = async (id: string) => {
    const result = await markAsReadAction(id)
    if (result.success) {
      toast.success(result.message)
      router.refresh()
    } else {
      toast.error(result.message)
    }
  }

  const handleArchive = async (id: string) => {
    const result = await archiveSubmissionAction(id)
    if (result.success) {
      toast.success(result.message)
      router.refresh()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <Card className="border-0 sm:border">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle>Soumissions utilisateurs</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <SubmissionsToolbar
          onSearch={handleSearch}
          initialSearch={searchQuery}
          totalSubmissions={totalSubmissions}
          onPerPageChange={handlePerPageChange}
          perPage={pageSize.toString()}
          onTypeChange={handleTypeChange}
          typeFilter={typeFilter || 'all'}
          onReadChange={handleReadChange}
          readFilter={
            readFilter === undefined ? 'all' : readFilter ? 'true' : 'false'
          }
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead className="hidden lg:table-cell">
                Utilisateur
              </TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSubmissions.map((submission) => {
              const TypeIcon = typeIcons[submission.type]
              return (
                <TableRow
                  key={submission.id}
                  className={!submission.read ? 'bg-muted/30' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="text-muted-foreground h-4 w-4" />
                      <Badge variant="outline">
                        {typeLabels[submission.type]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {submission.subject}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarImage
                          src={submission.user?.image || ''}
                          alt={submission.user?.name || 'Anonyme'}
                        />
                        <AvatarFallback className="text-xs">
                          {submission.user?.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('') || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {submission.user?.name || submission.email || 'Anonyme'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {formatDistanceToNow(new Date(submission.createdAt), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={submission.read ? 'secondary' : 'default'}>
                      {submission.read ? 'Lu' : 'Non lu'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SubmissionDetailDialog
                              submission={submission}
                              onMarkAsRead={handleMarkAsRead}
                            >
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </SubmissionDetailDialog>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Voir le détail</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {permissions.canArchive && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchive(submission.id)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Archiver</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <SubmissionsPagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalSubmissions / pageSize)}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  )
}
