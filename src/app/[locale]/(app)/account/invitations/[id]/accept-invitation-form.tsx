'use client'

//import {Invitation} from 'better-auth/plugins/organization'
import {useRouter} from 'next/navigation'
import {useState} from 'react'
import {toast} from 'sonner'

import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {authClient} from '@/lib/better-auth/auth-client'

interface Invitation {
  id: string
  organizationName: string
  organizationSlug: string
  inviterEmail: string
  email: string
  status: 'pending' | 'canceled' | 'accepted' | 'rejected'
  expiresAt: Date
  organizationId: string
  role: string
  inviterId: string
  teamId?: string
}

interface AcceptInvitationFormProps {
  invitation: Invitation
}

export function AcceptInvitationForm({invitation}: AcceptInvitationFormProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      })

      toast.success('Invitation acceptée avec succès')

      // Cette route définit l'organisation active côté serveur : refresh pour
      // invalider le cache router et recharger la session à jour
      router.push(`/team/${invitation.organizationSlug}`)
      router.refresh()
    } catch (err) {
      console.error("Erreur lors de l'acceptation de l'invitation:", err)
      toast.error('Erreur lors de l&apos;acceptation de l&apos;invitation')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    setIsProcessing(true)
    try {
      await authClient.organization.cancelInvitation({
        invitationId: invitation.id,
      })
      await authClient.organization.rejectInvitation({
        invitationId: invitation.id,
      })
      toast.success('Invitation annulée avec succès')
      router.push('/dashboard')
    } catch (err) {
      console.error("Erreur lors de l'annulation de l'invitation:", err)
      toast.error('Erreur lors de l&apos;annulation de l&apos;invitation')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Invitation d&apos;Organisation</CardTitle>
        <CardDescription>
          Vous avez été invité à rejoindre une organisation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Organisation</p>
          <p className="text-muted-foreground text-sm">
            {invitation.organizationName}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Invité par</p>
          <p className="text-muted-foreground text-sm">
            {invitation.inviterEmail}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Rôle</p>
          <p className="text-muted-foreground text-sm capitalize">
            {invitation.role}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button
            onClick={handleAccept}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? 'Traitement...' : "Accepter l'invitation"}
          </Button>
          <Button
            onClick={handleCancel}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? 'Traitement...' : "Refuser l'invitation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
