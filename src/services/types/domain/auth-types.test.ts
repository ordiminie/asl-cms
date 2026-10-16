import {describe, expect, it} from 'vitest'

import {roleEnum} from '@/db/models/auth-model'

import {GLOBAL_ROLES, RoleConst, roleHierarchy} from './auth-types'

/**
 * s47, ADR 035 : une seule liste des rôles globaux côté domaine. Elle doit
 * rester égale à l'énuméré `role_type` de la base, sans quoi un rôle pourrait
 * exister en base sans être reconnu (ou l'inverse).
 */
describe('rôles globaux — source unique', () => {
  it("GLOBAL_ROLES est égale à l'énuméré role_type de la base", () => {
    expect([...GLOBAL_ROLES].sort()).toEqual([...roleEnum.enumValues].sort())
  })

  it('roleHierarchy reprend GLOBAL_ROLES, du moins au plus élevé', () => {
    expect(roleHierarchy).toEqual(['user', 'super_admin'])
    expect(roleHierarchy).toBe(GLOBAL_ROLES)
  })

  it('RoleConst ne nomme que les rôles de GLOBAL_ROLES, tous', () => {
    expect(Object.values(RoleConst).sort()).toEqual([...GLOBAL_ROLES].sort())
  })
})
