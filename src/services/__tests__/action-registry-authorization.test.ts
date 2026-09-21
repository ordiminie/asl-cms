import {describe, expect, it} from 'vitest'

import {canPerformAction} from '../authorization/action-registry-authorization'
import {ActionIdConst} from '../types/domain/action-registry-types'
import {RoleConst, UserOrganizationRoleConst} from '../types/domain/auth-types'
import {OrganizationRole} from '../types/domain/organization-types'
import {User} from '../types/domain/user-types'
import {userTest, userTestAdmin, userTestSuperAdmin} from './service-test-data'

const ORG_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222'
const ACTION_ID = ActionIdConst.ASSOCIATION_SETTINGS_UPDATE

const withMembership = (
  user: User,
  organizationId: string,
  role: OrganizationRole
): User => ({
  ...user,
  organizations: [
    {
      id: `${organizationId}-${role}`,
      organizationId,
      userId: user.id,
      role,
      createdAt: new Date(),
    },
  ],
})

describe('canPerformAction — acces accordes', () => {
  it('[SUPER_ADMIN] accede quel que soit le registre, sans appartenir a l association', () => {
    expect(canPerformAction(userTestSuperAdmin, ORG_ID, ACTION_ID)).toBe(true)
  })

  it('[ORGANIZATION OWNER] la presidente accede a une action de roles par defaut owner/board', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.OWNER
    )

    expect(canPerformAction(user, ORG_ID, ACTION_ID)).toBe(true)
  })

  it('[ORGANIZATION BOARD] le bureau accede a une action de roles par defaut owner/board', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.ADMIN
    )

    expect(canPerformAction(user, ORG_ID, ACTION_ID)).toBe(true)
  })
})

describe('canPerformAction — refus', () => {
  it('[PUBLIC] refuse un visiteur non connecte', () => {
    expect(canPerformAction(undefined, ORG_ID, ACTION_ID)).toBe(false)
  })

  it('[ORGANIZATION MEMBER] refuse un role absent des roles par defaut de l action', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.MEMBER
    )

    expect(canPerformAction(user, ORG_ID, ACTION_ID)).toBe(false)
  })

  it("[USER NOT IN ORGANIZATION] refuse un utilisateur sans appartenance a l'organisation ciblee", () => {
    expect(canPerformAction(userTest, ORG_ID, ACTION_ID)).toBe(false)
  })

  it('[OTHER ORGANIZATION OWNER] refuse la presidente d une autre association', () => {
    const user = withMembership(
      userTest,
      OTHER_ORG_ID,
      UserOrganizationRoleConst.OWNER
    )

    expect(canPerformAction(user, ORG_ID, ACTION_ID)).toBe(false)
  })

  it('[ADMIN] refuse l administrateur global sans role dans l association', () => {
    expect(userTestAdmin.role).toBe(RoleConst.ADMIN)
    expect(canPerformAction(userTestAdmin, ORG_ID, ACTION_ID)).toBe(false)
  })

  it('refuse une action absente du registre, meme pour la presidente — defaut ferme', () => {
    const user = withMembership(
      userTest,
      ORG_ID,
      UserOrganizationRoleConst.OWNER
    )

    expect(canPerformAction(user, ORG_ID, 'unknown.action')).toBe(false)
  })
})
