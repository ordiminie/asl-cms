import {describe, expect, it} from 'vitest'

import {
  hasRequiredRole,
  hasRequiredRoles,
} from '@/services/authentication/auth-util'
import {RoleConst, roleHierarchy} from '@/services/types/domain/auth-types'
import type {Roles, User} from '@/services/types/domain/user-types'

import {userTest, userTestSuperAdmin} from './service-test-data'

/**
 * s47 : deux rôles globaux seulement. Un rôle retiré (`admin`…) qui
 * traînerait encore en base ou dans un cookie de session ne doit ouvrir
 * aucun droit. Le cast passe par `string` parce que le type `Roles` ne
 * connaît plus ces valeurs une fois l'énuméré réduit.
 */
const withRole = (role: string | undefined): User =>
  ({...userTest, role: role as Roles}) as User

describe('rôles globaux (s47)', () => {
  it('ne connaît que user et super_admin', () => {
    expect(roleHierarchy).toEqual(['user', 'super_admin'])
    expect([...Object.values(RoleConst)].sort()).toEqual([
      'super_admin',
      'user',
    ])
  })

  describe('hasRequiredRole', () => {
    it('refuse un user sur une exigence SUPER_ADMIN', () => {
      expect(hasRequiredRole(userTest, RoleConst.SUPER_ADMIN)).toBe(false)
    })

    it('accepte un super_admin sur une exigence USER', () => {
      expect(hasRequiredRole(userTestSuperAdmin, RoleConst.USER)).toBe(true)
    })

    it('refuse un compte sans rôle ou au rôle vide', () => {
      expect(hasRequiredRole(withRole(undefined), RoleConst.USER)).toBe(false)
      expect(hasRequiredRole(withRole(''), RoleConst.USER)).toBe(false)
    })

    it('refuse un rôle retiré, même sur la plus petite exigence', () => {
      for (const role of ['admin', 'moderator', 'redactor', 'public']) {
        expect(hasRequiredRole(withRole(role), RoleConst.USER)).toBe(false)
      }
    })
  })

  describe('hasRequiredRoles', () => {
    it('refuse un user sur [SUPER_ADMIN]', () => {
      expect(hasRequiredRoles(userTest, [RoleConst.SUPER_ADMIN])).toBe(false)
    })

    it('accepte un super_admin sur [USER]', () => {
      expect(hasRequiredRoles(userTestSuperAdmin, [RoleConst.USER])).toBe(true)
    })

    it('refuse un compte sans rôle, au rôle vide ou au rôle retiré', () => {
      for (const role of [undefined, '', 'admin', 'moderator', 'public']) {
        expect(hasRequiredRoles(withRole(role), [RoleConst.USER])).toBe(false)
      }
    })
  })
})
