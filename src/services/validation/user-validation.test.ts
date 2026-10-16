import {getTranslations} from 'next-intl/server'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
  createUpdateUserServiceSchema,
  updateUserServiceSchema,
} from './user-validation'

const USER_ID = '11111111-1111-4111-8111-111111111111'

const userWithRole = (role: string) => ({
  id: USER_ID,
  name: 'Bob Martin',
  email: 'bob@asl.test',
  visibility: 'private',
  role,
  updatedAt: new Date(),
})

beforeEach(() => {
  vi.mocked(getTranslations).mockResolvedValue(((key: string) => key) as never)
})

/** s47, critère 2 : le serveur ne connaît que deux rôles globaux. */
describe('rôle global dans la validation des utilisateurs', () => {
  describe.each([
    ['updateUserServiceSchema', async () => updateUserServiceSchema],
    ['createUpdateUserServiceSchema()', createUpdateUserServiceSchema],
  ])('%s', (_name, schemaOf) => {
    it.each(['user', 'super_admin'])('accepte %s', async (role) => {
      const schema = await schemaOf()

      expect(schema.safeParse(userWithRole(role)).success).toBe(true)
    })

    it.each(['admin', 'moderator', 'redactor', 'public'])(
      'refuse le rôle retiré %s',
      async (role) => {
        const schema = await schemaOf()
        const result = schema.safeParse(userWithRole(role))

        expect(result.success).toBe(false)
        expect(result.error?.issues[0].path).toEqual(['role'])
      }
    )
  })
})
