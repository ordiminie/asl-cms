import {describe, expect, it} from 'vitest'

import {
  assertApplicationRolePrivileges,
  assertBackupRolePrivileges,
} from './role-privileges'

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

describe('assertBackupRolePrivileges', () => {
  const backupRole = {
    rolname: 'asl_backup',
    rolsuper: false,
    rolbypassrls: true,
    ownedObjects: 0,
  }

  it('accepte un role BYPASSRLS, ni superuser, ni proprietaire', () => {
    expect(() => assertBackupRolePrivileges(backupRole)).not.toThrow()
  })

  it('refuse un role sans BYPASSRLS : la sauvegarde ne contiendrait aucune ligne metier', () => {
    expect(() =>
      assertBackupRolePrivileges({...backupRole, rolbypassrls: false})
    ).toThrow(/BYPASSRLS/)
  })

  it('refuse un role superuser : la minuterie aurait tous les pouvoirs sur la base', () => {
    expect(() =>
      assertBackupRolePrivileges({...backupRole, rolsuper: true})
    ).toThrow(/SUPERUSER/)
  })

  it('refuse un role proprietaire d’objets de la base', () => {
    expect(() =>
      assertBackupRolePrivileges({...backupRole, ownedObjects: 3})
    ).toThrow(/proprietaire/)
  })

  it('refuse un role introuvable plutot que de conclure au vert', () => {
    expect(() => assertBackupRolePrivileges(undefined)).toThrow()
  })
})
