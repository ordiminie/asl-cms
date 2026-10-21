import {describe, expect, it} from 'vitest'

import {decideMemberAccount, sameEmail} from './member-account-rules'

describe('decideMemberAccount — le compte suit l’adresse de la fiche', () => {
  it('ouvre un compte quand une fiche courrier reçoit une adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: null,
        nextEmail: 'odile@example.test',
        linkedRole: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('ne fait rien pour une fiche courrier qui le reste', () => {
    expect(
      decideMemberAccount({savedEmail: null, nextEmail: null, linkedRole: null})
    ).toEqual({kind: 'none'})
  })

  it('ferme le compte quand un propriétaire perd son adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: null,
        linkedRole: 'member',
      })
    ).toEqual({kind: 'close'})
  })

  it('remplace le compte quand l’adresse change, rôle member reporté', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: 'member',
      })
    ).toEqual({kind: 'replace', role: 'member'})
  })

  it('refuse de vider l’adresse d’un membre du bureau', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: null,
        linkedRole: 'board',
      })
    ).toEqual({kind: 'refuse_board_removal'})
  })

  it('refuse de vider l’adresse de la présidence', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'presidence@example.test',
        nextEmail: null,
        linkedRole: 'owner',
      })
    ).toEqual({kind: 'refuse_board_removal'})
  })

  it('remplace l’adresse d’un membre du bureau en reportant son rôle', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'helene@example.test',
        nextEmail: 'helene.roux@example.test',
        linkedRole: 'board',
      })
    ).toEqual({kind: 'replace', role: 'board'})
  })

  it('remplace l’adresse de la présidence en reportant son rôle', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'presidence@example.test',
        nextEmail: 'nouvelle.presidence@example.test',
        linkedRole: 'owner',
      })
    ).toEqual({kind: 'replace', role: 'owner'})
  })

  it('ne fait rien quand seule la casse de l’adresse change', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'Odile@Example.TEST',
        linkedRole: 'member',
      })
    ).toEqual({kind: 'none'})
  })

  it('ne fait rien quand l’adresse est inchangée et le compte ouvert', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile@example.test',
        linkedRole: 'board',
      })
    ).toEqual({kind: 'none'})
  })

  it('ouvre le compte d’une fiche à adresse encore sans compte', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile@example.test',
        linkedRole: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('ouvre sur la nouvelle adresse d’une fiche qui n’avait pas de compte', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: 'odile.marchand@example.test',
        linkedRole: null,
      })
    ).toEqual({kind: 'open'})
  })

  it('ne ferme rien quand une fiche sans compte perd son adresse', () => {
    expect(
      decideMemberAccount({
        savedEmail: 'odile@example.test',
        nextEmail: null,
        linkedRole: null,
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
