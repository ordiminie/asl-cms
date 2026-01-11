import {useCallback, useEffect, useState} from 'react'
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

// Composant pour les invitations envoyées par l'organisation
export default function InvitationsOrganization() {
  const {currentUserOrganization} = useOrganization()
  const [invitations, setInvitationsOrganization] = useState<
    PartialInvitationWithUser[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [invitationToCancel, setInvitationToCancel] =
    useState<PartialInvitationWithUser | null>(null)
  const [isCanceling, setIsCanceling] = useState(false)

  const fetchInvitations = useCallback(async () => {
    if (!currentUserOrganization?.organization?.id) {
      setIsLoading(false)
      return
    }

    try {
      // Récupérer les invitations envoyées par l'organisation (pour les owners)
      const result = await authClient.organization.listInvitations({
        query: {
          organizationId: currentUserOrganization.organization.id,
        },
      })
      setInvitationsOrganization(result.data || [])
    } catch (error) {
      console.error('Erreur lors du chargement des invitations:', error)
      toast.error('Erreur lors du chargement des invitations')
    } finally {
      setIsLoading(false)
    }
  }, [currentUserOrganization?.organization?.id])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

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

      toast.success('Invitation annulée avec succès')
      closeCancelModal()
      fetchInvitations()
    } catch (error) {
      console.error("Erreur lors de l'annulation de l'invitation:", error)
      toast.error("Erreur lors de l'annulation de l'invitation")
    } finally {
      setIsCanceling(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Chargement des invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Veuillez patienter pendant le chargement des invitations...</p>
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
            Invitations envoyées par{' '}
            {currentUserOrganization?.organization?.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="hidden sm:table-cell">Statut</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Date d&apos;expiration
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Aucune invitation envoyée
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
                          <span suppressHydrationWarning>
                            Expire:{' '}
                            {formatDate(
                              new Date(invitation.expiresAt ?? new Date())
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
                    <TableCell
                      className="hidden sm:table-cell"
                      suppressHydrationWarning
                    >
                      {formatDate(new Date(invitation.expiresAt ?? new Date()))}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openCancelModal(invitation)}
                        >
                          Annuler
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
            <DialogTitle>Confirmer l&apos;annulation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler l&apos;invitation envoyée à{' '}
              <strong>{invitationToCancel?.email}</strong> ?
              <br />
              Cette action ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCancelModal}
              disabled={isCanceling}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelInvitation}
              disabled={isCanceling}
            >
              {isCanceling ? 'Annulation...' : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
