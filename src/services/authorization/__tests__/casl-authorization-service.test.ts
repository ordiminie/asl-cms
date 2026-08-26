import {describe, expect, it} from 'vitest'

import {RoleConst} from '@/services/types/domain/auth-types'

import type {User} from '../../types/domain/user-types'
import {
  createUserAbility,
  defineAbilitiesFor,
  filterFields,
  isUserAdmin,
  userCan,
  userCannot,
  userCanOnResource,
} from '../authorization-service'
import {ActionsConst, SubjectsConst} from '../casl-abilities'

describe('CASL Abilities', () => {
  // Utilisateurs de test
  const guestUser = undefined

  const regularUser: User = {
    id: 'user-123',
    email: 'user@test.com',
    name: 'Regular User',
    role: RoleConst.USER,
    banned: null,
    banReason: null,
    banExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    image: null,
    visibility: 'public',
    twoFactorEnabled: false,
    stripeCustomerId: null,
  }

  const adminUser: User = {
    id: 'admin-123',
    email: 'admin@test.com',
    name: 'Admin User',
    role: RoleConst.ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    banned: null,
    banReason: null,
    banExpires: null,
    image: null,
    visibility: 'public',
    twoFactorEnabled: false,
    stripeCustomerId: null,
  }

  const superAdminUser: User = {
    id: 'super-admin-123',
    email: 'super@test.com',
    name: 'Super Admin',
    role: RoleConst.SUPER_ADMIN,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    image: null,
    banned: null,
    banReason: null,
    banExpires: null,
    visibility: 'public',
    twoFactorEnabled: false,
    stripeCustomerId: null,
  }

  describe('defineAbilitiesFor', () => {
    it('devrait créer une ability pour un guest', () => {
      const ability = defineAbilitiesFor(guestUser)
      expect(ability).toBeDefined()
      expect(ability.can(ActionsConst.READ, SubjectsConst.LOG)).toBe(true)
      expect(ability.can(ActionsConst.CREATE, SubjectsConst.USER)).toBe(false)
    })

    it('devrait créer une ability pour un utilisateur régulier', () => {
      const ability = defineAbilitiesFor(regularUser)
      expect(ability).toBeDefined()
      expect(ability.can(ActionsConst.READ, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(false)
    })

    it('devrait créer une ability pour un admin', () => {
      const ability = defineAbilitiesFor(adminUser)
      expect(ability).toBeDefined()
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(true)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
    })

    it('devrait créer une ability pour un super admin', () => {
      const ability = defineAbilitiesFor(superAdminUser)
      expect(ability).toBeDefined()
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(true)
      expect(ability.can(ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)).toBe(
        true
      )
    })
  })

  describe('Permissions pour les utilisateurs (User Subject)', () => {
    describe('Guest (non authentifié)', () => {
      it('peut lire les utilisateurs publics', () => {
        const publicProfile = {id: 'user-123', visibility: 'public'}
        expect(
          userCanOnResource(
            guestUser,
            ActionsConst.READ,
            SubjectsConst.USER,
            publicProfile
          )
        ).toBe(true)
      })

      it('ne peut pas lire les utilisateurs privés', () => {
        const privateProfile = {id: 'user-123', visibility: 'private'}
        expect(
          userCanOnResource(
            guestUser,
            ActionsConst.READ,
            SubjectsConst.USER,
            privateProfile
          )
        ).toBe(false)
      })

      it('ne peut pas créer des utilisateurs', () => {
        expect(
          userCan(guestUser, ActionsConst.CREATE, SubjectsConst.USER)
        ).toBe(false)
      })

      it('ne peut pas modifier des utilisateurs', () => {
        expect(
          userCan(guestUser, ActionsConst.UPDATE, SubjectsConst.USER)
        ).toBe(false)
      })
    })

    describe('Utilisateur régulier', () => {
      it('peut lire les utilisateurs (règle générale)', () => {
        expect(
          userCan(regularUser, ActionsConst.READ, SubjectsConst.USER)
        ).toBe(true)
      })

      it('peut modifier les utilisateurs (avec conditions)', () => {
        expect(
          userCan(regularUser, ActionsConst.UPDATE, SubjectsConst.USER)
        ).toBe(true)
      })

      it('ne peut pas supprimer des utilisateurs', () => {
        expect(
          userCan(regularUser, ActionsConst.DELETE, SubjectsConst.USER)
        ).toBe(false)
        expect(
          userCannot(regularUser, ActionsConst.DELETE, SubjectsConst.USER)
        ).toBe(true)
      })

      it('ne peut pas gérer (manage) des utilisateurs', () => {
        expect(
          userCan(regularUser, ActionsConst.MANAGE, SubjectsConst.USER)
        ).toBe(false)
      })
    })

    describe('Admin', () => {
      it('peut gérer (manage) tous les utilisateurs', () => {
        expect(
          userCan(adminUser, ActionsConst.MANAGE, SubjectsConst.USER)
        ).toBe(true)
      })

      it('peut effectuer toutes les actions sur les utilisateurs', () => {
        expect(
          userCan(adminUser, ActionsConst.CREATE, SubjectsConst.USER)
        ).toBe(true)
        expect(userCan(adminUser, ActionsConst.READ, SubjectsConst.USER)).toBe(
          true
        )
        expect(
          userCan(adminUser, ActionsConst.UPDATE, SubjectsConst.USER)
        ).toBe(true)
        expect(
          userCan(adminUser, ActionsConst.DELETE, SubjectsConst.USER)
        ).toBe(true)
      })
    })

    describe('Super Admin', () => {
      it('peut gérer les principales ressources', () => {
        expect(
          userCan(superAdminUser, ActionsConst.MANAGE, SubjectsConst.USER)
        ).toBe(true)
        expect(
          userCan(
            superAdminUser,
            ActionsConst.MANAGE,
            SubjectsConst.SUBSCRIPTION
          )
        ).toBe(true)
        expect(
          userCan(superAdminUser, ActionsConst.MANAGE, SubjectsConst.LOG)
        ).toBe(true)
      })
    })
  })

  describe('Permissions pour les subscriptions', () => {
    describe('Guest', () => {
      it('ne peut pas accéder aux subscriptions', () => {
        expect(
          userCan(guestUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
        ).toBe(false)
        expect(
          userCan(guestUser, ActionsConst.CREATE, SubjectsConst.SUBSCRIPTION)
        ).toBe(false)
      })
    })

    describe('Utilisateur régulier', () => {
      it('peut lire les subscriptions', () => {
        expect(
          userCan(regularUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
      })

      it('peut créer des subscriptions', () => {
        expect(
          userCan(regularUser, ActionsConst.CREATE, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
      })

      it('peut modifier les subscriptions', () => {
        expect(
          userCan(regularUser, ActionsConst.UPDATE, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
      })

      it('ne peut pas supprimer des subscriptions par défaut', () => {
        expect(
          userCan(regularUser, ActionsConst.DELETE, SubjectsConst.SUBSCRIPTION)
        ).toBe(false)
      })
    })

    describe('Admin', () => {
      it('peut gérer toutes les subscriptions', () => {
        expect(
          userCan(adminUser, ActionsConst.MANAGE, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
        expect(
          userCan(adminUser, ActionsConst.DELETE, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
      })
    })
  })

  describe('Permissions pour les logs', () => {
    it('tous les utilisateurs peuvent lire les logs', () => {
      expect(userCan(guestUser, ActionsConst.READ, SubjectsConst.LOG)).toBe(
        true
      )
      expect(userCan(regularUser, ActionsConst.READ, SubjectsConst.LOG)).toBe(
        true
      )
      expect(userCan(adminUser, ActionsConst.READ, SubjectsConst.LOG)).toBe(
        true
      )
    })

    it('seuls les admins peuvent gérer les logs', () => {
      expect(userCan(guestUser, ActionsConst.MANAGE, SubjectsConst.LOG)).toBe(
        false
      )
      expect(userCan(regularUser, ActionsConst.MANAGE, SubjectsConst.LOG)).toBe(
        false
      )
      expect(userCan(adminUser, ActionsConst.MANAGE, SubjectsConst.LOG)).toBe(
        true
      )
    })
  })

  describe('userCanOnResource - Permissions avec conditions', () => {
    it('un utilisateur peut accéder à son propre profil', () => {
      const ownProfile = {id: regularUser.id, name: 'Own Profile'}
      expect(
        userCanOnResource(
          regularUser,
          ActionsConst.READ,
          SubjectsConst.USER,
          ownProfile
        )
      ).toBe(true)
    })

    it('un utilisateur peut accéder à un profil public', () => {
      const publicProfile = {id: 'other-user', visibility: 'public'}
      expect(
        userCanOnResource(
          regularUser,
          ActionsConst.READ,
          SubjectsConst.USER,
          publicProfile
        )
      ).toBe(true)
    })

    it('un utilisateur peut accéder à ses propres subscriptions', () => {
      const ownSubscription = {id: 'sub-123', userId: regularUser.id}
      expect(
        userCanOnResource(
          regularUser,
          ActionsConst.READ,
          SubjectsConst.SUBSCRIPTION,
          ownSubscription
        )
      ).toBe(true)
    })

    it("un utilisateur ne peut pas accéder aux subscriptions d'un autre", () => {
      const otherSubscription = {id: 'sub-456', userId: 'other-user'}
      expect(
        userCanOnResource(
          regularUser,
          ActionsConst.READ,
          SubjectsConst.SUBSCRIPTION,
          otherSubscription
        )
      ).toBe(false)
    })
  })

  describe('filterFields', () => {
    it('devrait retourner les données pour un utilisateur autorisé', () => {
      const userData = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@test.com',
        role: RoleConst.USER,
      }

      const filtered = filterFields(
        regularUser,
        ActionsConst.READ,
        SubjectsConst.USER,
        userData
      )

      expect(filtered).toEqual(userData)
    })

    it('devrait retourner un objet vide pour un utilisateur non autorisé', () => {
      const userData = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@test.com',
      }

      const filtered = filterFields(
        guestUser,
        ActionsConst.UPDATE,
        SubjectsConst.USER,
        userData
      )

      expect(filtered).toEqual({})
    })

    it('devrait retourner les données pour un admin', () => {
      const userData = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@test.com',
        role: RoleConst.USER,
      }

      const filtered = filterFields(
        adminUser,
        ActionsConst.READ,
        SubjectsConst.USER,
        userData
      )

      expect(filtered).toEqual(userData)
    })
  })

  describe('Fonctions utilitaires', () => {
    describe('createUserAbility', () => {
      it('devrait créer une ability identique à defineAbilitiesFor', () => {
        const ability1 = createUserAbility(regularUser)
        const ability2 = defineAbilitiesFor(regularUser)

        expect(ability1.can(ActionsConst.READ, SubjectsConst.USER)).toBe(
          ability2.can(ActionsConst.READ, SubjectsConst.USER)
        )
        expect(ability1.can(ActionsConst.MANAGE, SubjectsConst.USER)).toBe(
          ability2.can(ActionsConst.MANAGE, SubjectsConst.USER)
        )
      })
    })

    describe('isUserAdmin', () => {
      it('devrait retourner false pour un guest', () => {
        expect(isUserAdmin(guestUser)).toBe(false)
      })

      it('devrait retourner false pour un utilisateur régulier', () => {
        expect(isUserAdmin(regularUser)).toBe(false)
      })

      it('devrait retourner true pour un admin', () => {
        expect(isUserAdmin(adminUser)).toBe(true)
      })

      it('devrait retourner true pour un super admin', () => {
        expect(isUserAdmin(superAdminUser)).toBe(true)
      })
    })

    describe('userCannot', () => {
      it("devrait être l'inverse de userCan", () => {
        // Test avec une permission accordée
        expect(
          userCan(regularUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
        ).toBe(true)
        expect(
          userCannot(regularUser, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
        ).toBe(false)

        // Test avec une permission refusée
        expect(
          userCan(regularUser, ActionsConst.DELETE, SubjectsConst.USER)
        ).toBe(false)
        expect(
          userCannot(regularUser, ActionsConst.DELETE, SubjectsConst.USER)
        ).toBe(true)
      })
    })
  })

  describe('Permissions techniques', () => {
    it('seuls les admins peuvent accéder aux ressources techniques', () => {
      expect(
        userCan(guestUser, ActionsConst.READ, SubjectsConst.TECHNICAL)
      ).toBe(false)
      expect(
        userCan(regularUser, ActionsConst.READ, SubjectsConst.TECHNICAL)
      ).toBe(false)
      expect(
        userCan(adminUser, ActionsConst.MANAGE, SubjectsConst.TECHNICAL)
      ).toBe(true)
      expect(
        userCan(superAdminUser, ActionsConst.MANAGE, SubjectsConst.TECHNICAL)
      ).toBe(true)
    })
  })

  describe('Permissions selon le rôle utilisateur', () => {
    const userWithUserRole: User = {
      id: 'multi-user',
      email: 'multi@test.com',
      name: 'Multi Role User',
      role: RoleConst.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerified: true,
      banned: null,
      banReason: null,
      banExpires: null,
      image: null,
      visibility: 'public',
      twoFactorEnabled: false,
      stripeCustomerId: null,
    }

    it('un utilisateur USER a des permissions limitées', () => {
      // Un utilisateur USER ne peut pas gérer tous les utilisateurs
      expect(
        userCan(userWithUserRole, ActionsConst.MANAGE, SubjectsConst.USER)
      ).toBe(false)
      expect(
        userCan(userWithUserRole, ActionsConst.DELETE, SubjectsConst.USER)
      ).toBe(false)

      // Mais il peut lire et créer des subscriptions
      expect(
        userCan(userWithUserRole, ActionsConst.READ, SubjectsConst.SUBSCRIPTION)
      ).toBe(true)
      expect(
        userCan(
          userWithUserRole,
          ActionsConst.CREATE,
          SubjectsConst.SUBSCRIPTION
        )
      ).toBe(true)
    })
  })
})
