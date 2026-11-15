import {describe, expect, it} from 'vitest'

import {resolveQuestionRecipient} from '../types/domain/member-question-types'

describe('resolveQuestionRecipient — routage exclusif (critère 2, D1)', () => {
  it('keeps the category address alone when it has one', () => {
    expect(resolveQuestionRecipient('voirie@x.test', 'bureau@x.test')).toBe(
      'voirie@x.test'
    )
  })

  it('falls back to the contact address when the category has none', () => {
    expect(resolveQuestionRecipient(null, 'bureau@x.test')).toBe(
      'bureau@x.test'
    )
    expect(resolveQuestionRecipient(undefined, 'bureau@x.test')).toBe(
      'bureau@x.test'
    )
  })

  it('treats a blank or empty category address as absent', () => {
    expect(resolveQuestionRecipient('', 'bureau@x.test')).toBe('bureau@x.test')
    expect(resolveQuestionRecipient('   ', 'bureau@x.test')).toBe(
      'bureau@x.test'
    )
  })

  it('trims the address kept', () => {
    expect(resolveQuestionRecipient(' voirie@x.test ', 'bureau@x.test')).toBe(
      'voirie@x.test'
    )
    expect(resolveQuestionRecipient(null, ' bureau@x.test ')).toBe(
      'bureau@x.test'
    )
  })

  it('returns undefined when neither address exists', () => {
    expect(resolveQuestionRecipient(null, null)).toBeUndefined()
    expect(resolveQuestionRecipient(' ', '')).toBeUndefined()
    expect(resolveQuestionRecipient(undefined, undefined)).toBeUndefined()
  })
})
