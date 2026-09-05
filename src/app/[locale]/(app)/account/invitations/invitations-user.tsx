import {useRouter} from 'next/navigation'
import {useLocale, useTranslations} from 'next-intl'
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
  const t = useTranslations('Invitations.received')
  const tCommon = useTranslations('Common')
  const locale = useLocale()
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
        toast.error(t('acceptError'), {
          description:
            error.message || error.statusText || 'Une erreur est survenue',
        })
        return
      }
      onInvitationUpdate(invitationToAction.id)
      toast.success(t('acceptSuccess'))
      closeModals()
      router.refresh()
    } catch (error) {
      console.error("Erreur lors de l'acceptation de l'invitation:", error)
      toast.error(t('acceptError'))
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
      toast.success(t('rejectSuccess'))
      closeModals()
    } catch (error) {
      console.error("Erreur lors de la réjection de l'invitation:", error)
      toast.error(t('rejectError'))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('fields.organization')}</TableHead>
                <TableHead>{t('inviter')}</TableHead>
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
                  <TableCell colSpan={6} className="text-center">
                    {t('empty')}
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
                      {invitation.inviter?.name || t('unknownInviter')}
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
                          : null,
                        locale
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
            <DialogTitle>{t('acceptTitle')}</DialogTitle>
            <DialogDescription>
              {t('acceptDescription', {
                name: invitationToAction?.organization?.name ?? '',
                role: invitationToAction?.role ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModals}
              disabled={isProcessing}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="default"
              onClick={handleAcceptInvitation}
              disabled={isProcessing}
            >
              {isProcessing ? t('accepting') : t('accept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmation pour le rejet */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('rejectDescription', {
                name: invitationToAction?.organization?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModals}
              disabled={isProcessing}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectInvitation}
              disabled={isProcessing}
            >
              {isProcessing ? t('rejecting') : t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
