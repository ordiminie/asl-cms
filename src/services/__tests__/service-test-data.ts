import {RoleConst} from '../types/domain/auth-types'
import {User} from '../types/domain/user-types'

export const currentAuthUserId = 'ae760f8e-4aa6-4d71-a4c8-344429b7ae21' //faker.string.uuid()
export const differentUserId = 'de760f8e-4aa6-4d71-a4c8-344429b7ae28' //faker.string.uuid()

export const userTest = {
  id: currentAuthUserId,
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  image: null,
  role: RoleConst.USER,
  visibility: 'private',
  createdAt: new Date(),
  updatedAt: new Date(),
  banned: null,
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  stripeCustomerId: 'cus_1234567890',
} satisfies User

/**
 * SuperAdmin Zourite Studio. C'est le seul role global au-dessus de `user`
 * (s47, ADR 035) : il provisionne une association et administre `/admin`.
 */
export const userTestSuperAdmin = {
  ...userTest,
  role: RoleConst.SUPER_ADMIN,
} satisfies User
