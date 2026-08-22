import {UserCog} from 'lucide-react'
import {cacheLife} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {getMembersAndInvitationsDal} from '@/app/dal/organization-dal'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {Button} from '@/components/ui/button'
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

import {CancelAdminInvitationButton} from '../admin/organizations/cancel-admin-invitation-button'
import {OrganizationAdminAddMemberForm} from '../admin/organizations/organization-admin-add-member-form'
import {CancelInvitationButton} from './cancel-invitation-button'
import {EditMemberRoleDialog} from './edit-member-role-dialog'
import {OrganizationAddMemberForm} from './organization-add-member-form'
import {RemoveMemberButton} from './remove-member-button'

/**
 * L'instant de référence est caché dans sa propre fonction : lire l'horloge
 * pendant le rendu interdirait le prerender de la page. Granularité horaire,
 * ce qui suffit largement pour une date d'expiration d'invitation.
 */
async function getExpiryCutoff(): Promise<number> {
  'use cache'
  cacheLife('hours')
  return Date.now()
}

function isInvitationExpired(joinedAt: Date | null, cutoff: number): boolean {
  if (!joinedAt) return false
  return new Date(joinedAt).getTime() < cutoff
}

export default async function OrganizationMembersTable({
  organizationId,
  canManageMembers = false,
  adminView = false,
}: {
  organizationId: string
  canManageMembers?: boolean
  adminView?: boolean
}) {
  const t = await getTranslations('Organization.members')
  const tCommon = await getTranslations('Common')
  const expiryCutoff = await getExpiryCutoff()
  //const isAdmin = await isAuthAdmin()
  const members = await getMembersAndInvitationsDal(organizationId)

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        {canManageMembers && !adminView && (
          <OrganizationAddMemberForm
            organizationId={organizationId}
            existingMemberIds={members.map((m) => m.memberId ?? m.userId ?? '')}
          />
        )}

        {adminView && (
          <OrganizationAdminAddMemberForm
            organizationId={organizationId}
            existingMemberIds={members.map((m) => m.memberId ?? m.userId ?? '')}
          />
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('avatar')}</TableHead>
            <TableHead>{tCommon('fields.name')}</TableHead>
            <TableHead className="hidden sm:table-cell">
              {tCommon('fields.email')}
            </TableHead>
            <TableHead className="hidden md:table-cell">
              {tCommon('fields.role')}
            </TableHead>
            <TableHead className="hidden lg:table-cell">
              Date d&apos;ajout
            </TableHead>
            <TableHead className="w-10 text-center">
              {tCommon('fields.role')}
            </TableHead>
            <TableHead className="w-10 text-center">{t('action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member, i) => (
            <TableRow key={i}>
              <TableCell>
                <Avatar>
                  {member.image ? (
                    <AvatarImage src={member.image} alt={member.name ?? ''} />
                  ) : (
                    <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                  )}
                </Avatar>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {member.name}
                    {member.status === 'invited' && (
                      <span
                        className={`ml-2 rounded px-2 py-0.5 text-xs font-semibold ${
                          isInvitationExpired(member.joinedAt, expiryCutoff)
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                        }`}
                      >
                        {isInvitationExpired(member.joinedAt, expiryCutoff)
                          ? t('expiredInvitation')
                          : t('pendingInvitation')}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground text-sm sm:hidden">
                    {member.email}
                  </span>
                  <span className="text-muted-foreground text-xs md:hidden">
                    {member.role}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {member.email}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {member.role}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {member.joinedAt
                  ? new Date(member.joinedAt).toLocaleDateString()
                  : ''}
              </TableCell>
              <TableCell className="text-center">
                {canManageMembers &&
                member.status === 'member' &&
                member.memberId ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <EditMemberRoleDialog
                          memberId={member.memberId}
                          memberName={member.name ?? ''}
                          currentRole={member.role ?? ''}
                          triggerButton={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('editRole')}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent>{t('editRole')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </TableCell>
              <TableCell className="text-center">
                {canManageMembers ? (
                  member.status === 'member' ? (
                    <RemoveMemberButton
                      organizationId={organizationId}
                      userId={member.userId ?? ''}
                      userName={member.name ?? ''}
                    />
                  ) : (
                    <>
                      {adminView ? (
                        <CancelAdminInvitationButton
                          organizationId={organizationId}
                          invitationId={member.invitationId ?? ''}
                          userEmail={member.email}
                        />
                      ) : (
                        <CancelInvitationButton
                          organizationId={organizationId}
                          invitationId={member.invitationId ?? ''}
                          userEmail={member.email}
                        />
                      )}
                    </>
                  )
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
