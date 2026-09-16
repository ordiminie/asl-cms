import {describe, expect, it} from 'vitest'

import {assertApplicationRolePrivileges} from './role-privileges'

describe('assertApplicationRolePrivileges', () => {
  it('accepte un role ni superuser ni BYPASSRLS', () => {
    expect(() =>
      assertApplicationRolePrivileges({
        rolname: 'asl_app',
        rolsuper: false,
        rolbypassrls: false,
      })
    ).not.toThrow()
  })

  it('refuse un role superuser : FORCE ROW LEVEL SECURITY ne le contraint pas', () => {
    expect(() =>
      assertApplicationRolePrivileges({
        rolname: 'asl',
        rolsuper: true,
        rolbypassrls: false,
      })
    ).toThrow(/asl/)
  })

  it('refuse un role BYPASSRLS', () => {
    expect(() =>
      assertApplicationRolePrivileges({
        rolname: 'asl',
        rolsuper: false,
        rolbypassrls: true,
      })
    ).toThrow(/BYPASSRLS/)
  })

  it('nomme la consequence dans le message : les policies seraient inertes', () => {
    expect(() =>
      assertApplicationRolePrivileges({
        rolname: 'postgres',
        rolsuper: true,
        rolbypassrls: true,
      })
    ).toThrow(/inerte/i)
  })

  it('refuse un role introuvable plutot que de conclure au vert', () => {
    expect(() => assertApplicationRolePrivileges(undefined)).toThrow()
  })
})
