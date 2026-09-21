import {describe, expect, it} from 'vitest'

import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'

import {
  organizationAccessControl,
  organizationRoles,
} from './organization-roles'

/**
 * Les roles d'association declares au plugin `organization` de Better Auth
 * (s03b) : les memes des deux cotes, serveur et client, et les memes que les
 * valeurs de l'enumere `organization_role`.
 */
describe('organizationRoles — roles declares au plugin Better Auth', () => {
  it('porte exactement les trois roles de l association, sans `admin`', () => {
    expect(Object.keys(organizationRoles).toSorted()).toEqual([
      'board',
      'member',
      'owner',
    ])
  })

  it('couvre chaque role d association connu du domaine', () => {
    for (const role of Object.values(UserOrganizationRoleConst)) {
      expect(organizationRoles).toHaveProperty(role)
    }
  })

  it('le bureau gere les membres et modifie l association', () => {
    expect(
      organizationRoles.board.authorize({
        member: ['create', 'update', 'delete'],
      }).success
    ).toBe(true)
    expect(
      organizationRoles.board.authorize({organization: ['update']}).success
    ).toBe(true)
  })

  it("le bureau ne supprime pas l'association, la presidente si", () => {
    expect(
      organizationRoles.board.authorize({organization: ['delete']}).success
    ).toBe(false)
    expect(
      organizationRoles.owner.authorize({organization: ['delete']}).success
    ).toBe(true)
  })

  it('un simple membre ne gere ni les membres ni les invitations', () => {
    expect(
      organizationRoles.member.authorize({member: ['create']}).success
    ).toBe(false)
    expect(
      organizationRoles.member.authorize({invitation: ['create']}).success
    ).toBe(false)
  })

  it('expose le controle d acces partage par le serveur et le client', () => {
    expect(Object.keys(organizationAccessControl.statements)).toContain(
      'organization'
    )
  })
})
