import {relations} from 'drizzle-orm'

import {
  member,
  organization,
  organizationModuleEnum,
  organizationRoleEnum,
  user,
} from './auth-model'

// Relations pour organizations
export const organizationsRelations = relations(organization, ({many}) => ({
  members: many(member, {
    relationName: 'organizationToUsers',
  }),
}))

// Relations pour userOrganizations
export const membersRelations = relations(member, ({one}) => ({
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
    relationName: 'userToOrganizations',
  }),
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
    relationName: 'organizationToUsers',
  }),
}))

// Types TypeScript
export type OrganizationModel = typeof organization.$inferSelect
export type AddOrganizationModel = typeof organization.$inferInsert
export type UpdateOrganizationModel = typeof organization.$inferInsert

export type MemberModel = typeof member.$inferSelect
export type AddMemberModel = typeof member.$inferInsert

export type OrganizationRoleEnumModel =
  (typeof organizationRoleEnum.enumValues)[number]

export type OrganizationModuleEnumModel =
  (typeof organizationModuleEnum.enumValues)[number]

/** Les cles de modules connues, dans l'ordre de l'enumere Postgres. */
export const organizationModuleValues = organizationModuleEnum.enumValues

/** Les deux fichiers d'identite d'une association (ADR 015). */
export type OrganizationIdentityKindModel = 'logo' | 'favicon'
