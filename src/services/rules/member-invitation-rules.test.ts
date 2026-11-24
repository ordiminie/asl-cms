import {describe, expect, it} from 'vitest'

import {invitationStateOf} from './member-invitation-rules'

const INVITED = new Date('2026-11-24T09:15:00.000Z')
const SIGNED_IN = new Date('2026-11-26T18:40:00.000Z')

describe('invitationStateOf — état de l’invitation d’une adresse (s42a)', () => {
  it('sans trace : jamais invitée', () => {
    expect(invitationStateOf(undefined)).toEqual({state: 'never', at: null})
    expect(
      invitationStateOf({lastInvitedAt: null, firstSignedInAt: null})
    ).toEqual({state: 'never', at: null})
  })

  it('invitée seulement : invitée le jour du dernier envoi parti', () => {
    expect(
      invitationStateOf({lastInvitedAt: INVITED, firstSignedInAt: null})
    ).toEqual({state: 'invited', at: INVITED.toISOString()})
  })

  it('connectée : la première connexion prime sur l’invitation', () => {
    expect(
      invitationStateOf({lastInvitedAt: INVITED, firstSignedInAt: SIGNED_IN})
    ).toEqual({state: 'signed_in', at: SIGNED_IN.toISOString()})
  })

  it('connectée sans avoir été invitée : connectée', () => {
    expect(
      invitationStateOf({lastInvitedAt: null, firstSignedInAt: SIGNED_IN})
    ).toEqual({state: 'signed_in', at: SIGNED_IN.toISOString()})
  })
})
