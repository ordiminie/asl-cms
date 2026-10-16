import {describe, expect, it, vi} from 'vitest'

import {render} from '@/__tests__/customRender'
import {User} from '@/services/types/domain/user-types'

vi.mock('@/app/[locale]/admin/users/actions', () => ({
  updateUserDetailAction: vi.fn(),
}))
vi.mock('@/services/organization-service', () => ({}))

import UserDetailForm from './user-detail-form'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Bob Martin',
  email: 'bob@asl.test',
  emailVerified: true,
  image: null,
  role: 'user',
  visibility: 'private',
  banned: false,
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  stripeCustomerId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} satisfies User

const permissions = {
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canManage: true,
}

/**
 * Le `Select` Radix double ses options dans un `<select>` natif caché,
 * présent même liste fermée : c'est lui qu'on lit, il porte la liste exacte.
 */
const nativeOptionsOf = (container: HTMLElement, current: string) => {
  const select = [...container.querySelectorAll('select')].find(
    (candidate) => candidate.value === current
  )
  return [...(select?.querySelectorAll('option') ?? [])]
    .map((option) => option.value)
    .filter(Boolean)
}

/** s47, critère 2 : `/admin` ne propose que les deux rôles globaux. */
describe('UserDetailForm — rôle global', () => {
  it('ne propose que user et super_admin', () => {
    const {container} = render(
      <UserDetailForm
        user={user}
        permissions={permissions}
        organizationsWithUsage={[]}
      />
    )

    expect(nativeOptionsOf(container, 'user')).toEqual(['user', 'super_admin'])
  })
})
