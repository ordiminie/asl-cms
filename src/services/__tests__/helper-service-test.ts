import {vi} from 'vitest'

import {getAuthUser} from '../authentication/auth-service'
import {User} from '../types/domain/user-types'

// export const setupSessionMocked = async (session: Session | null = null) => {
//   return vi.mocked(getSessionAuth).mockImplementation(async () => {
//     return session
//   })
// }
export const setupAuthUserMocked = async (user?: User | undefined) => {
  return vi.mocked(getAuthUser).mockImplementation(async () => {
    if (!user) return
    return user
  })
}
