import {
  AddInvitationModel,
  InvitationModel,
  UpdateInvitationModel,
} from '@/db/models/auth-model'
import {
  AddMemberModel,
  AddOrganizationModel,
  MemberModel,
  OrganizationModel,
  OrganizationRoleEnumModel,
  UpdateOrganizationModel,
} from '@/db/models/organization-model'
import {UserModel} from '@/db/models/user-model'

// Types de domaine découplés des types Drizzle
export type Organization = OrganizationModel
export type Member = MemberModel
export type MemberData = MemberModel & {
  user?: UserModel
  organization?: OrganizationModel
}

export type OrganizationRole = OrganizationRoleEnumModel

export const OrganizationRoleConst = {
  admin: 'admin',
  member: 'member',
  owner: 'owner',
} satisfies Record<OrganizationRole, string>

// Types pour les opérations
export type CreateOrganization = AddOrganizationModel
export type UpdateOrganization = {
  id: string
} & Partial<Omit<UpdateOrganizationModel, 'id'>>

export type CreateMember = AddMemberModel

//invitation types
export type Invitation = InvitationModel
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'canceled'

export type InvitationWithUser = Invitation & {
  user: UserModel | null
  organization?: OrganizationModel
  inviter?: UserModel
}

export type CreateInvitation = AddInvitationModel
export type UpdateInvitation = {
  id: string
} & Partial<Omit<UpdateInvitationModel, 'id'>>

export type MemberOrInvitationDTO = {
  memberId?: string | null
  userId?: string
  invitationId: string | null
  organizationId: string
  name: string | null
  email: string
  image: string | null
  role: string | null
  joinedAt: Date | null
  status: 'member' | 'invited'
}

export type OrganizationSearchResult = {
  id: string
  name: string
  slug: string | null
  logo: string | null
  memberEmails: string[]
}
