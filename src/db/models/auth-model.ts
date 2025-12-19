import {relations, sql} from 'drizzle-orm'
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const userVisibilityEnum = pgEnum('user_visibility', [
  'public',
  'private',
])

export const roleEnum = pgEnum('role_type', [
  'public',
  'user',
  'redactor',
  'moderator',
  'admin',
  'super_admin',
])
export const user = pgTable('user', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  visibility: userVisibilityEnum('visibility').default('private').notNull(),
  twoFactorEnabled: boolean('two_factor_enabled'),
  role: roleEnum('role').notNull().default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  stripeCustomerId: text('stripe_customer_id'),
})

export const session = pgTable('session', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, {onDelete: 'cascade'}),
  impersonatedBy: text('impersonated_by'),
  activeOrganizationId: text('active_organization_id'),
})

export const account = pgTable(
  'account',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountProviderUnique: unique().on(table.accountId, table.providerId),
  })
)

export const verification = pgTable('verification', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const apikey = pgTable('apikey', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name'),
  start: text('start'),
  prefix: text('prefix'),
  key: text('key').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, {onDelete: 'cascade'}),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: timestamp('last_refill_at'),
  enabled: boolean('enabled').default(true),
  rateLimitEnabled: boolean('rate_limit_enabled').default(true),
  rateLimitTimeWindow: integer('rate_limit_time_window').default(86400000),
  rateLimitMax: integer('rate_limit_max').default(10),
  requestCount: integer('request_count'),
  remaining: integer('remaining'),
  lastRequest: timestamp('last_request'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
})

export const twoFactor = pgTable('two_factor', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, {onDelete: 'cascade'}),
})

// Table des organisations
export const organization = pgTable('organization', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  description: text('description'),
  createdAt: timestamp('created_at', {mode: 'date'}).defaultNow(),
  updatedAt: timestamp('updated_at', {mode: 'date'}).defaultNow(),
  logo: text('logo'),
  metadata: text('metadata'),
})

export const organizationRoleEnum = pgEnum('organization_role', [
  'admin',
  'member',
  'owner',
])

export const member = pgTable(
  'member',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id, {onDelete: 'cascade'}),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    //role: text('role').default('member').notNull(),
    role: organizationRoleEnum('role').default('member').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => ({
    unq: unique().on(table.organizationId, table.userId),
  })
)

export const invitation = pgTable('invitation', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organization.id, {onDelete: 'cascade'}),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: uuid('inviter_id')
    .notNull()
    .references(() => user.id, {onDelete: 'cascade'}),
})

export const invitationRelation = relations(invitation, ({one}) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}))

export const apikeyRelation = relations(apikey, ({one}) => ({
  user: one(user, {
    fields: [apikey.userId],
    references: [user.id],
    relationName: 'userToApiKeys',
  }),
}))

export type InvitationModel = typeof invitation.$inferSelect
export type AddInvitationModel = typeof invitation.$inferInsert
export type UpdateInvitationModel = typeof invitation.$inferInsert
