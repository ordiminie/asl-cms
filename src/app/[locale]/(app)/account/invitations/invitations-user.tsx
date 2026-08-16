import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'

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
// Composant pour les invitations reçues par l'utilisateur
export default function InvitationsUsers({
  invitations,
  onInvitationUpdate,
}: {
  invitations: PartialInvitationWithUser[]
  onInvitationUpdate: (invitationId: string) => void
}) {
  const router = useRouter()
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [invitationToAction, setInvitationToAction] =
    useState<PartialInvitationWithUser | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const openAcceptModal = (invitation: PartialInvitationWithUser) => {
    setInvitationToAction(invitation)
    setIsAcceptModalOpen(true)
  }

  const openRejectModal = (invitation: PartialInvitationWithUser) => {
    setInvitationToAction(invitation)
    setIsRejectModalOpen(true)
  }

  const closeModals = () => {
    setIsAcceptModalOpen(false)
    setIsRejectModalOpen(false)
    setInvitationToAction(null)
  }

  const handleAcceptInvitation = async () => {
    if (!invitationToAction) return

    setIsProcessing(true)
    try {
      const {error} = await authClient.organization.acceptInvitation({
        invitationId: invitationToAction.id,
      })
      if (error) {
        toast.error("Erreur lors de l'acceptation de l'invitation", {
          description:
            error.message || error.statusText || 'Une erreur est survenue',
        })
        return
      }
      onInvitationUpdate(invitationToAction.id)
      toast.success('Invitation acceptée avec succès')
      closeModals()
      router.refresh()
    } catch (error) {
      console.error("Erreur lors de l'acceptation de l'invitation:", error)
      toast.error("Erreur lors de l'acceptation de l'invitation")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectInvitation = async () => {
    if (!invitationToAction) return

    setIsProcessing(true)
    try {
      const {error} = await authClient.organization.rejectInvitation({
        invitationId: invitationToAction.id,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      onInvitationUpdate(invitationToAction.id)
      toast.success('Invitation rejetée avec succès')
      closeModals()
    } catch (error) {
      console.error("Erreur lors de la réjection de l'invitation:", error)
      toast.error("Erreur lors de la réjection de l'invitation")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Invitations reçues</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Inviteur</TableHead>
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
                  <TableCell colSpan={6} className="text-center">
                    Aucune invitation reçue
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {invitation.organization?.name ||
                            'Organisation inconnue'}
                        </span>
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs sm:hidden">
                          <Badge variant="outline" className="text-xs">
                            {invitation.status}
                          </Badge>
                          <span>
                            Expire:{' '}
                            {formatDate(
                              invitation.expiresAt
                                ? new Date(invitation.expiresAt)
                                : null
                            )}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {invitation.inviter?.name || 'Inviteur inconnue'}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">{invitation.role}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline">{invitation.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDate(
                        invitation.expiresAt
                          ? new Date(invitation.expiresAt)
                          : null
                      )}
                    </TableCell>
                    <TableCell>
                      {invitation.status === 'pending' && (
                        <div className="flex space-x-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openAcceptModal(invitation)}
                          >
                            Accepter
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRejectModal(invitation)}
                          >
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de confirmation pour l'acceptation */}
      <Dialog open={isAcceptModalOpen} onOpenChange={setIsAcceptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l&apos;acceptation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir accepter l&apos;invitation de{' '}
              <strong>{invitationToAction?.organization?.name}</strong> ?
              <br />
              Vous rejoindrez cette organisation en tant que{' '}
              <strong>{invitationToAction?.role}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModals}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button
              variant="default"
              onClick={handleAcceptInvitation}
              disabled={isProcessing}
            >
              {isProcessing ? 'Acceptation...' : "Accepter l'invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation pour le rejet */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le rejet</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir rejeter l&apos;invitation de{' '}
              <strong>{invitationToAction?.organization?.name}</strong> ?
              <br />
              Cette action ne peut pas être annulée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModals}
              disabled={isProcessing}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectInvitation}
              disabled={isProcessing}
            >
              {isProcessing ? 'Rejet...' : "Rejeter l'invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
