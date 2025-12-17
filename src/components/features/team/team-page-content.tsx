'use client'

import {CalendarDays, FolderKanban, Users, Zap} from 'lucide-react'
import {useEffect, useState} from 'react'
import {toast} from 'sonner'

import {
  OrganizationDTO,
  OrganizationMemberDTO,
} from '@/app/dal/organization-dal'
import {useOrganization} from '@/components/context/organization-provider'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
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
import {Progress} from '@/components/ui/progress'
import {AdminUsageStats} from '@/db/repositories/subscription-repository'
import {authClient} from '@/lib/better-auth/auth-client'

interface TeamPageContentProps {
  organization: OrganizationDTO
  members: OrganizationMemberDTO[]
  usage: AdminUsageStats
}

export function TeamPageContent({
  organization,
  members,
  usage,
}: TeamPageContentProps) {
  const {
    currentOrganization,
    setCurrentOrganizationWithoutRedirect,
    organizations,
  } = useOrganization()
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const formatUsage = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) {
      return `${used} / ∞`
    }
    return `${used} / ${limit}`
  }

  const getUsagePercent = (used: number, limit: number | null) => {
    if (limit === null || limit === -1 || limit === 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getProgressColor = (used: number, limit: number | null) => {
    if (limit === null || limit === -1) return 'bg-green-500'
    const ratio = used / limit
    if (ratio >= 1) return 'bg-red-500'
    if (ratio >= 0.8) return 'bg-orange-500'
    return 'bg-green-500'
  }

  // Mettre à jour l'organisation courante si elle ne correspond pas au slug
  useEffect(() => {
    if (currentOrganization?.id !== organization.id) {
      // Chercher l'organisation dans la liste des organisations de l'utilisateur
      const userOrg = organizations.find(
        (org) => org.organization?.id === organization.id
      )

      if (userOrg?.organization?.id) {
        // Mettre à jour le contexte sans rediriger (on est déjà sur la bonne page)
        setCurrentOrganizationWithoutRedirect(userOrg.organization.id)
      }
    }
  }, [
    organization.id,
    currentOrganization?.id,
    setCurrentOrganizationWithoutRedirect,
    organizations,
  ])

  const handleLeaveOrganization = async () => {
    if (!organization.id) {
      toast.error('Organisation non trouvée')
      return
    }

    setIsLeaving(true)
    try {
      const {error} = await authClient.organization.leave({
        organizationId: organization.id,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success("Vous avez quitté l'organisation avec succès")
      setIsLeaveModalOpen(false)
      // Rediriger vers le dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error("Erreur lors de la sortie de l'organisation:", error)
      toast.error("Erreur lors de la sortie de l'organisation")
    } finally {
      setIsLeaving(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Non définie'
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* En-tête de l'organisation */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={organization.logo || ''}
                alt={organization.name}
              />
              <AvatarFallback className="text-lg">
                {organization.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <CardTitle className="text-2xl">{organization.name}</CardTitle>
              <Badge variant="outline">@{organization.slug}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {organization.description && (
            <div>
              <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                Description
              </h3>
              <p className="text-sm">{organization.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="text-muted-foreground flex items-center space-x-2 text-sm">
              <CalendarDays className="h-4 w-4" />
              <span>Créée le {formatDate(organization.createdAt)}</span>
            </div>

            {members.length > 0 && (
              <div className="text-muted-foreground flex items-center space-x-2 text-sm">
                <Users className="h-4 w-4" />
                <span>
                  {members.length} membre{members.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste des membres si accessible */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Membres de l&apos;équipe</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center space-x-3 rounded-lg border p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.image || ''} alt={member.name} />
                    <AvatarFallback>
                      {member.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {member.email}
                    </p>
                    <div className="mt-1 flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Utilisation</span>
            </CardTitle>
            <Badge variant="outline" className="uppercase">
              {usage.plan}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Projets
                </span>
                <span className="font-medium">
                  {formatUsage(usage.projects, usage.limits.projects)}
                </span>
              </div>
              <Progress
                value={getUsagePercent(usage.projects, usage.limits.projects)}
                className="h-2"
                indicatorClassName={getProgressColor(
                  usage.projects,
                  usage.limits.projects
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Membres
                </span>
                <span className="font-medium">
                  {formatUsage(usage.users, usage.limits.users)}
                </span>
              </div>
              <Progress
                value={getUsagePercent(usage.users, usage.limits.users)}
                className="h-2"
                indicatorClassName={getProgressColor(
                  usage.users,
                  usage.limits.users
                )}
              />
            </div>
          </div>
          {usage.periodStart && usage.periodEnd && (
            <p className="text-muted-foreground mt-4 text-xs">
              Période: {formatDate(usage.periodStart)} -{' '}
              {formatDate(usage.periodEnd)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Informations détaillées */}
      <Card>
        <CardHeader>
          <CardTitle>Informations détaillées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-sm font-medium">
                Identifiant unique
              </h4>
              <p className="bg-muted rounded p-2 font-mono text-sm">
                {organization.id}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-muted-foreground text-sm font-medium">
                Slug de l&apos;organisation
              </h4>
              <p className="bg-muted rounded p-2 font-mono text-sm">
                {organization.slug}
              </p>
            </div>

            {organization.updatedAt && (
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-sm font-medium">
                  Dernière mise à jour
                </h4>
                <p className="text-sm">{formatDate(organization.updatedAt)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bouton pour quitter l'organisation */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setIsLeaveModalOpen(true)}
          >
            Quitter l&apos;organisation
          </Button>
        </CardContent>
      </Card>

      {/* Modal de confirmation pour quitter l'organisation */}
      <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitter l&apos;organisation</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir quitter l&apos;organisation{' '}
              <strong>{organization.name}</strong> ? Cette action est
              irréversible et vous perdrez l&apos;accès à toutes les ressources
              de l&apos;organisation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLeaveModalOpen(false)}
              disabled={isLeaving}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleLeaveOrganization}
              disabled={isLeaving}
            >
              {isLeaving ? 'Sortie en cours...' : "Quitter l'organisation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
