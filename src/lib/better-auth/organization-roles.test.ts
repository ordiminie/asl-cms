import fs from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {UserOrganizationRoleConst} from '@/services/types/domain/auth-types'

import {
  ORGANIZATION_MEMBERSHIP_DISABLED_HTTP_PATHS,
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

/**
 * Portes laterales fermees (s14, ADR 039) : les routes HTTP du plugin qui
 * ecrivent des appartenances contourneraient la trace et le verrou du dernier
 * compte. La liste est epinglee, et chaque route doit exister dans la version
 * installee de Better Auth : une route renommee a la mise a jour ne serait
 * plus fermee en silence.
 */
describe('ORGANIZATION_MEMBERSHIP_DISABLED_HTTP_PATHS (s14, ADR 039)', () => {
  const pluginSources = () => {
    const dir = path.resolve(
      import.meta.dirname,
      '../../../node_modules/better-auth/dist/plugins/organization/routes'
    )
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.mjs'))
      .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
      .join('\n')
  }

  it('ferme exactement les routes qui écrivent des appartenances', () => {
    expect([...ORGANIZATION_MEMBERSHIP_DISABLED_HTTP_PATHS].sort()).toEqual(
      [
        '/organization/accept-invitation',
        '/organization/create',
        '/organization/delete',
        '/organization/invite-member',
        '/organization/leave',
        '/organization/remove-member',
        '/organization/update-member-role',
      ].sort()
    )
  })

  it('chaque route fermée existe dans le plugin installé', () => {
    const sources = pluginSources()
    for (const route of ORGANIZATION_MEMBERSHIP_DISABLED_HTTP_PATHS) {
      expect(sources).toContain(`createAuthEndpoint("${route}"`)
    }
  })
})
