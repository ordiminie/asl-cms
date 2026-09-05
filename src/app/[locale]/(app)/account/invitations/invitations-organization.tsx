import {useLocale, useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {useOrganization} from '@/components/context/organization-provider'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {authClient} from '@/lib/better-auth/auth-client'
import {formatDate} from '@/lib/helper/date-helper'

import {PartialInvitationWithUser} from './invitations-content'

// Récupérer les invitations envoyées par l'organisation (pour les owners)
const fetchInvitations = async (
  organizationId: string | undefined
): Promise<PartialInvitationWithUser[]> => {
  if (!organizationId) {
    return []
  }
  const result = await authClient.organization.listInvitations({
    query: {organizationId},
  })
  return result.data || []
}

// Composant pour les invitations envoyées par l'organisation
export default function InvitationsOrganization() {
  const {currentUserOrganization} = useOrganization()
  const t = useTranslations('Invitations.sent')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
  const [invitations, setInvitationsOrganization] = useState<
    PartialInvitationWithUser[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [invitationToCancel, setInvitationToCancel] =
    useState<PartialInvitationWithUser | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)

  const organizationId = currentUserOrganization?.organization?.id

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const invitations = await fetchInvitations(organizationId)
        if (cancelled) return
        setInvitationsOrganization(invitations)
      } catch (error) {
        if (cancelled) return
        console.error('Erreur lors du chargement des invitations:', error)
        toast.error(t('loadError'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [organizationId, t])

  const openCancelModal = (invitation: PartialInvitationWithUser) => {
    setInvitationToCancel(invitation)
    setIsCancelModalOpen(true)
  }

  const closeCancelModal = () => {
    setIsCancelModalOpen(false)
    setInvitationToCancel(null)
  }

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return

    setIsCanceling(true)
    try {
      const {error} = await authClient.organization.cancelInvitation({
        invitationId: invitationToCancel.id,
      })
      if (error) {
        toast.error(error.message)
        return
      }

      toast.success(t('cancelSuccess'))
      closeCancelModal()
      setInvitationsOrganization(await fetchInvitations(organizationId))
    } catch (error) {
      console.error("Erreur lors de l'annulation de l'invitation:", error)
      toast.error(t('cancelError'))
    } finally {
      setIsCanceling(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>{t('loading')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('loadingDescription')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {t('title', {
              organization: currentUserOrganization?.organization?.name ?? '',
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('fields.email')}</TableHead>
                <TableHead>{tCommon('fields.role')}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {tCommon('fields.status')}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {tCommon('fields.expiresAt')}
                </TableHead>
                <TableHead>{tCommon('fields.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{invitation.email}</span>
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs sm:hidden">
                          {invitation.status === 'accepted' && (
                            <Badge variant="default" className="text-xs">
                              Acceptée
                            </Badge>
                          )}
                          {invitation.status === 'rejected' && (
                            <Badge variant="destructive" className="text-xs">
                              Rejetée
                            </Badge>
                          )}
                          {invitation.status === 'canceled' && (
                            <Badge variant="destructive" className="text-xs">
                              Annulée
                            </Badge>
                          )}
                          {invitation.status === 'pending' && (
                            <Badge variant="outline" className="text-xs">
                              En attente
                            </Badge>
                          )}
                          <span>
                            {t('expires')}{' '}
                            {formatDate(
                              invitation.expiresAt
                                ? new Date(invitation.expiresAt)
                                : null,
                              locale
                            )}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{invitation.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {invitation.status === 'accepted' && (
                        <Badge variant="default" className="text-xs">
                          Acceptée
                        </Badge>
                      )}
                      {invitation.status === 'rejected' && (
                        <Badge variant="destructive" className="text-xs">
                          Rejetée
                        </Badge>
                      )}
                      {invitation.status === 'canceled' && (
                        <Badge variant="destructive" className="text-xs">
                          Annulée
                        </Badge>
                      )}
                      {invitation.status === 'pending' && (
                        <Badge variant="outline" className="text-xs">
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDate(
                        invitation.expiresAt
                          ? new Date(invitation.expiresAt)
                          : null,
                        locale
                      )}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openCancelModal(invitation)}
                        >
                          {tCommon('actions.cancel')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de confirmation pour l'annulation */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel')}</DialogTitle>
            <DialogDescription>
              {t('cancelDescription', {
                email: invitationToCancel?.email ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCancelModal}
              disabled={isCanceling}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelInvitation}
              disabled={isCanceling}
            >
              {isCanceling ? t('canceling') : t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
