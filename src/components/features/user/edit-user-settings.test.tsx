import {describe, expect, it, vi} from 'vitest'

vi.mock('./action', () => ({updateUserSettingsAction: vi.fn()}))

import {render, screen} from '@/__tests__/customRender'
import {User} from '@/services/types/domain/user-types'

import {EditUserSettingsForm} from './edit-user-settings'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const user = {
  id: 'user-1',
  name: 'Julien',
  email: 'julien@example.test',
  settings: {theme: 'dark', language: 'fr', timezone: 'Europe/Paris'},
} as unknown as User

describe('Réglages du compte — clair seul (ADR 033)', () => {
  it('ne propose plus de choisir un thème', () => {
    render(<EditUserSettingsForm user={user} />)

    expect(screen.queryByText('Thème')).toBeNull()
    expect(screen.getByText('Langue')).toBeInTheDocument()
  })
})
