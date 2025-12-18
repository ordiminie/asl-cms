'use client'
import {Plus} from 'lucide-react'
import {useEffect, useState, useTransition} from 'react'
import {useDebounce} from 'react-use'
import {toast} from 'sonner'

import {useOrganization} from '@/components/context/organization-provider'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {
  OrganizationRole,
  OrganizationRoleConst,
} from '@/services/types/domain/organization-types'
import {UserDTO} from '@/services/types/domain/user-types'

import {
  addUserToOrganizationAction,
  searchUsersForOrganizationAction,
} from './action'

export function OrganizationAddMemberForm({
  organizationId,
  existingMemberIds,
}: {
  organizationId: string
  existingMemberIds: string[]
}) {
  const [email, setEmail] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<UserDTO[]>([])
  const [selectedUser, setSelectedUser] = useState<UserDTO | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>(
    OrganizationRoleConst.member as OrganizationRole
  )

  const {setCurrentOrganizationWithoutRedirect} = useOrganization()

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  useDebounce(
    () => {
      if (isValidEmail(searchValue)) {
        startTransition(async () => {
          const users = await searchUsersForOrganizationAction(
            organizationId,
            searchValue
          )
          setResults(
            users.filter((u: UserDTO) => !existingMemberIds.includes(u.id))
          )
        })
      } else {
        setResults([])
      }
    },
    300,
    [searchValue]
  )

  // We need set current organization to add member
  useEffect(() => {
    setCurrentOrganizationWithoutRedirect(organizationId)
  }, [organizationId, setCurrentOrganizationWithoutRedirect])

  function handleSearch(value: string) {
    setEmail(value)
    setSearchValue(value)
    setSelectedUser(null)
  }

  function handleSelectUser(user: UserDTO) {
    setSelectedUser(user)
    setEmail(user.email)
    setResults([])
  }

  function handleInvite() {
    if (!selectedUser) {
      toast.error('Veuillez sélectionner un utilisateur')
      return
    }

    startTransition(async () => {
      const res = await addUserToOrganizationAction(
        organizationId,
        selectedUser.id,
        selectedUser.email,
        selectedRole,
        true
      )

      if (res.success) {
        toast.success(res.message || 'Membre invité avec succès')
        setEmail('')
        setSelectedUser(null)
        setResults([])
        setIsModalOpen(false)
        setSelectedRole('member')
      } else {
        toast.error(res.message || "Erreur lors de l'invitation")
      }
    })
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un membre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Team Member</DialogTitle>
          <DialogDescription>
            Entrez l&apos;adresse email de l&apos;utilisateur que vous souhaitez
            inviter.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-6">
          {/* Input Email */}
          <div className="mb-8">
            <Label className="mb-3 block text-sm font-medium">
              Email address
            </Label>
            <div className="relative">
              <Input
                type="email"
                placeholder="steve.wozniak@example.com"
                value={email}
                onChange={(e) => handleSearch(e.target.value)}
                disabled={isPending}
              />
              {isPending && (
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                </div>
              )}
            </div>

            {/* Résultats de recherche */}
            {results.length > 0 && !selectedUser && (
              <div className="bg-background mt-2 max-h-48 overflow-auto rounded border">
                <ul className="divide-y">
                  {results.map((user) => (
                    <li
                      key={user.id}
                      className="hover:bg-accent cursor-pointer p-3 transition-colors"
                      onClick={() => handleSelectUser(user)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-muted-foreground text-sm">
                            {user.email}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-gray-400" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isValidEmail(email) &&
              results.length === 0 &&
              !isPending &&
              !selectedUser && (
                <p className="text-muted-foreground mt-2 py-2 text-center text-sm">
                  Aucun utilisateur trouvé avec cet email
                </p>
              )}
          </div>

          {/* Utilisateur sélectionné */}
          {selectedUser && (
            <div className="mb-8">
              <Label className="mb-3 block text-sm font-medium">
                Utilisateur sélectionné
              </Label>
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center space-x-3">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <div>
                    <p className="font-medium text-green-900">
                      {selectedUser.name}
                    </p>
                    <p className="text-sm text-green-700">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedUser(null)
                    setEmail('')
                  }}
                  className="text-green-700 hover:text-green-900"
                >
                  Changer
                </Button>
              </div>
            </div>
          )}

          {/* Sélection du rôle */}
          <div className="mb-6">
            <Label className="mb-3 block text-sm font-medium">
              Select role
            </Label>
            <RadioGroup
              value={selectedRole}
              onValueChange={(value: string) =>
                setSelectedRole(value as OrganizationRole)
              }
              className="space-y-2"
            >
              <div className="hover:bg-muted/50 flex items-start space-x-3 rounded-lg border p-3">
                <RadioGroupItem
                  value={OrganizationRoleConst.admin}
                  id="admin"
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="admin" className="cursor-pointer font-medium">
                    Admin
                  </Label>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Invite users, update payment, and delete the team.
                  </p>
                </div>
              </div>
              <div className="hover:bg-muted/50 flex items-start space-x-3 rounded-lg border p-3">
                <RadioGroupItem
                  value={OrganizationRoleConst.member}
                  id="member"
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="member"
                    className="cursor-pointer font-medium"
                  >
                    Member
                  </Label>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Manage emails, domains, and webhooks.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Bouton Invite */}
          <div className="pt-4">
            <Button
              onClick={handleInvite}
              disabled={isPending || !selectedUser}
              className="w-full"
            >
              {isPending ? 'Envoi en cours...' : 'Invite'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
