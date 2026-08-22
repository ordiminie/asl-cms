'use client'

import {Session} from 'better-auth'
import {formatDistanceToNow} from 'date-fns'
import {Copy, Monitor, Smartphone, Trash2} from 'lucide-react'
import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {authClient} from '@/lib/better-auth/auth-client'
import {getDateFnsLocale} from '@/lib/helper/date-helper'

const fetchSessions = async (): Promise<Session[]> => {
  const {data} = await authClient.listSessions()
  return data || []
}

export function ListTokensSection() {
  const t = useTranslations('AccountPage.UserSecuritySection.listTokens')
  const locale = useLocale()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      setSessions(await fetchSessions())
    } catch (error) {
      console.error('Erreur lors du chargement des sessions:', error)
      toast.error(t('errors.loadSessions'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleRevokeSession = async (token: string) => {
    try {
      setIsDeleting(token)
      const {error} = await authClient.revokeSession({token})
      if (error) {
        toast.error(t('errors.revokeSession'), {
          description: error.message,
        })
        return
      }
      toast.success(t('success.sessionRevoked'))
      await loadSessions() // Recharger la liste
    } catch (error) {
      console.error('Erreur lors de la révocation:', error)
      toast.error(t('errors.revokeSession'))
    } finally {
      setIsDeleting(null)
    }
  }

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success(t('success.tokenCopied'))
    } catch (error) {
      console.error('Erreur lors de la copie:', error)
      toast.error(t('errors.copyToken'))
    }
  }

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />

    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)
    return isMobile ? (
      <Smartphone className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    )
  }

  const getDeviceInfo = (userAgent?: string) => {
    if (!userAgent) return t('device.unknown')

    // Extraction simplifiée du navigateur
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'

    return t('device.unknown')
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchSessions()
        if (cancelled) return
        setSessions(data)
      } catch (error) {
        if (cancelled) return
        console.error('Erreur lors du chargement des sessions:', error)
        toast.error(t('errors.loadSessions'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">{t('loading')}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center">
            {t('noSessions')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.device')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('table.ipAddress')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('table.token')}
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('table.lastActivity')}
                  </TableHead>
                  <TableHead>{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="flex items-center gap-2">
                      {getDeviceIcon(session.userAgent ?? undefined)}
                      <div>
                        <div className="font-medium">
                          {getDeviceInfo(session.userAgent ?? undefined)}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm md:hidden">
                          <span>
                            {session.ipAddress ?? t('table.notAvailable')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 lg:hidden"
                            onClick={() => handleCopyToken(session.token)}
                            title={t('actions.copyToken')}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <code className="bg-muted rounded px-1 py-0.5 text-sm">
                        {session.ipAddress || t('table.notAvailable')}
                      </code>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <code className="bg-muted rounded px-1 py-0.5 text-xs">
                          {session.token.substring(0, 16)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyToken(session.token)}
                          title={t('actions.copyFullToken')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {formatDistanceToNow(new Date(session.updatedAt), {
                        addSuffix: true,
                        locale: getDateFnsLocale(locale),
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevokeSession(session.token)}
                        disabled={isDeleting === session.id}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {isDeleting === session.id
                          ? t('actions.revoking')
                          : t('actions.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" onClick={loadSessions} disabled={isLoading}>
            {t('actions.refresh')}
          </Button>
          <p className="text-muted-foreground text-xs">
            {t('sessionCount', {count: sessions.length})}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
