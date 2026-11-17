import {describe, expect, it} from 'vitest'

import {decideMemberAccount, sameEmail} from './member-account-rules'

describe('decideMemberAccount — le compte suit l’adresse de la fiche', () => {
  it('ouvre un compte quand une fiche courrier reçoit une adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: null,
        nextEmail: 'odile@example.test',
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('délie une fiche courrier qui le reste : aucun accès à fermer', () => {
    expect(
      decideMemberAccount({
        savedEmail: null,
        nextEmail: null,
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'unlink'})
  })

  it('ferme le compte quand un propriétaire perd son adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: null,
        linkedRole: 'member',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'close'})
  })

  it('remplace le compte quand l’adresse change (le rôle est relu sous le verrou)', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: 'member',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'replace'})
  })

  it('remplace le compte quand l’adresse change et que le compte encore relié n’a plus de ligne member (revue s54 round 4, MA-r4)', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: null,
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'replace'})
  })

  it('ouvre un compte quand l’adresse change sans aucun compte relié (revue s54 round 4, MA-r4)', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('relie au compte qui porte la nouvelle adresse, même quand l’ancien compte relié n’a plus de ligne member (revue s54 round 4, MA-r4)', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: null,
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: 'shared',
      })
    ).toEqual({kind: 'link_shared', userId: 'shared'})
  })

  it('délie, sans rien fermer, un compte relié sans ligne member quand l’adresse est vidée (revue s54 round 4, MA-r4)', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: null,
        linkedRole: null,
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'unlink'})
  })

  it('refuse de vider l’adresse d’un membre du bureau', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: null,
        linkedRole: 'board',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'refuse_board_removal'})
  })

  it('refuse de vider l’adresse de la présidence', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'presidence@example.test',
        nextEmail: null,
        linkedRole: 'owner',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'refuse_board_removal'})
  })

  it('remplace l’adresse d’un membre du bureau', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: 'helene.roux@example.test',
        linkedRole: 'board',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'replace'})
  })

  it('remplace l’adresse de la présidence', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'presidence@example.test',
        nextEmail: 'nouvelle.presidence@example.test',
        linkedRole: 'owner',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'replace'})
  })

  it('ne fait rien quand seule la casse de l’adresse change', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'Odile@Example.TEST',
        linkedRole: 'member',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'none'})
  })

  it('ne fait rien quand l’adresse est inchangée et le compte ouvert', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile@example.test',
        linkedRole: 'board',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'none'})
  })

  it('ouvre le compte d’une fiche à adresse encore sans compte', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile@example.test',
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('ouvre sur la nouvelle adresse d’une fiche qui n’avait pas de compte', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('délie, sans rien fermer, une fiche sans accès ici qui perd son adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: null,
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'unlink'})
  })
})

const HOLDER_ID = '55555555-5555-4555-8555-555555555555'

describe('decideMemberAccount — un compte, plusieurs fiches (s53, ADR 054)', () => {
  it('refuse de vider l’adresse de la dernière fiche d’un membre du bureau', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: null,
        linkedRole: 'board',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'refuse_board_removal'})
  })

  it('laisse vider l’adresse d’une fiche d’un membre du bureau qui en garde une autre', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: null,
        linkedRole: 'board',
        previousAccountLinked: true,
        otherLinkedProfiles: 1,
        nextEmailAccountUserId: null,
      })
    ).toEqual({kind: 'close'})
  })

  it('relie une fiche sans compte à l’adresse déjà celle d’un compte de l’association', () => {
    expect(
      decideMemberAccount({
        savedEmail: null,
        nextEmail: 'bernard@example.test',
        linkedRole: null,
        previousAccountLinked: false,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: HOLDER_ID,
      })
    ).toEqual({kind: 'link_shared', userId: HOLDER_ID})
  })

  it('relie au compte détenteur une fiche dont l’adresse est remplacée', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'ancienne@example.test',
        nextEmail: 'bernard@example.test',
        linkedRole: 'member',
        previousAccountLinked: true,
        otherLinkedProfiles: 0,
        nextEmailAccountUserId: HOLDER_ID,
      })
    ).toEqual({kind: 'link_shared', userId: HOLDER_ID})
  })

  it('ne fait rien quand l’adresse inchangée est partagée par le même compte', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'bernard@example.test',
        nextEmail: 'Bernard@example.test',
        linkedRole: 'member',
        previousAccountLinked: true,
        otherLinkedProfiles: 2,
        nextEmailAccountUserId: HOLDER_ID,
      })
    ).toEqual({kind: 'none'})
  })
})

describe('sameEmail', () => {
  it('compare sans casse', () => {
    expect(sameEmail('A@Example.test', 'a@example.test')).toBe(true)
  })

  it('distingue deux adresses', () => {
    expect(sameEmail('a@example.test', 'b@example.test')).toBe(false)
  })

  it('traite deux absences comme égales', () => {
    expect(sameEmail(null, null)).toBe(true)
    expect(sameEmail(null, 'a@example.test')).toBe(false)
  })
})
