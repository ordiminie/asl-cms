import {cacheLife} from 'next/cache'
import {getTranslations} from 'next-intl/server'

import {openImpersonationAction} from '@/app/[locale]/admin/organizations/actions'
import {getMembersAndInvitationsDal} from '@/app/dal/organization-dal'
import {requireCurrentTenantDal} from '@/app/dal/tenant-dal'
import {ImpersonationDialog} from '@/components/features/impersonation/impersonation-dialog'
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {env} from '@/env'
import {associationOriginOf} from '@/lib/better-auth/association-origin'
import type {MemberOrInvitationDTO} from '@/services/types/domain/organization-types'

import {CancelAdminInvitationButton} from '../admin/organizations/cancel-admin-invitation-button'
import {OrganizationAdminAddMemberForm} from '../admin/organizations/organization-admin-add-member-form'
import {CancelInvitationButton} from './cancel-invitation-button'
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

type ImpersonationEntry = {
  organizationName: string
  durationMinutes: number
  otherDomain?: {domain: string; url: string}
}

/**
 * Ce que la boite « Agir a sa place » doit savoir de l'association (s48, D9) :
 * si l'hote courant n'est pas le sien, elle renvoie vers son site, ou le
 * SuperAdmin se connecte s'il ne l'est pas.
 */
async function impersonationEntryOf(
  organizationId: string,
  organizationName: string,
  organizationDomain: string | null | undefined
): Promise<ImpersonationEntry> {
  const tenant = await requireCurrentTenantDal()
  const origin = associationOriginOf(organizationDomain)
  const onAssociationDomain = tenant.id === organizationId
  return {
    organizationName,
    durationMinutes: Math.round(
      env.IMPERSONATION_SESSION_DURATION_SECONDS / 60
    ),
    otherDomain:
      onAssociationDomain || !origin || !organizationDomain
        ? undefined
        : {
            domain: organizationDomain,
            url: `${origin}/admin/organizations/${organizationId}/edit`,
          },
  }
}

export default async function OrganizationMembersTable({
  organizationId,
  organizationName = '',
  organizationDomain,
  canManageMembers = false,
  adminView = false,
}: {
  organizationId: string
  organizationName?: string
  organizationDomain?: string | null
  canManageMembers?: boolean
  adminView?: boolean
}) {
  const t = await getTranslations('Organization.members')
  const tCommon = await getTranslations('Common')
  const tImpersonation = await getTranslations('Impersonation')
  const expiryCutoff = await getExpiryCutoff()
  //const isAdmin = await isAuthAdmin()
  const members = await getMembersAndInvitationsDal(organizationId)
  const impersonation = adminView
    ? await impersonationEntryOf(
        organizationId,
        organizationName,
        organizationDomain
      )
    : undefined

  const impersonationCell = (member: MemberOrInvitationDTO) => {
    if (!impersonation) return null
    if (member.status !== 'member' || !member.hasAccount) {
      return (
        <span className="text-muted-foreground text-sm">
          {tImpersonation('table.noAccount')}
        </span>
      )
    }
    if (member.isSuperAdmin) {
      return (
        <span className="text-muted-foreground text-sm">
          {tImpersonation('table.superAdminImpossible')}
        </span>
      )
    }
    return (
      <ImpersonationDialog
        organizationId={organizationId}
        userId={member.userId ?? ''}
        name={member.name ?? member.email}
        roleLabel={tImpersonation(`roles.${member.role ?? 'member'}`)}
        organizationName={impersonation.organizationName}
        durationMinutes={impersonation.durationMinutes}
        otherDomain={impersonation.otherDomain}
        action={openImpersonationAction}
      />
    )
  }

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
      <Table className="max-sm:block">
        <TableHeader className="max-sm:hidden">
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
            <TableHead className="w-10 text-center">{t('action')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="max-sm:flex max-sm:flex-col max-sm:gap-3">
          {members.map((member, i) => (
            <TableRow
              key={i}
              className="max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:rounded-md max-sm:border max-sm:p-4"
            >
              <TableCell className="max-sm:hidden">
                <Avatar>
                  {member.image ? (
                    <AvatarImage src={member.image} alt={member.name ?? ''} />
                  ) : (
                    <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                  )}
                </Avatar>
              </TableCell>
              <TableCell className="max-sm:block max-sm:p-0">
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
              <TableCell className="text-center max-sm:block max-sm:w-full max-sm:p-0">
                <div className="flex items-center justify-end gap-2 max-sm:flex-col max-sm:items-stretch">
                  {impersonationCell(member)}
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
