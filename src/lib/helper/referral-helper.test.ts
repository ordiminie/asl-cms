import {describe, expect, it} from 'vitest'

import {
  isValidReferralCode,
  normalizeReferralCode,
  parseReferralCodeFromCookieHeader,
} from './referral-helper'

describe('normalizeReferralCode', () => {
  it('lowercases and trims', () => {
    expect(normalizeReferralCode('  Mike  ')).toBe('mike')
  })
})

describe('isValidReferralCode', () => {
  it('accepts lowercase letters, digits and hyphens', () => {
    expect(isValidReferralCode('mike-codeur-2')).toBe(true)
  })

  it('accepts an uppercase code, since it is normalized first', () => {
    expect(isValidReferralCode('MIKE')).toBe(true)
  })

  it('rejects a code shorter than three characters', () => {
    expect(isValidReferralCode('ab')).toBe(false)
  })

  it('rejects a code longer than 32 characters', () => {
    expect(isValidReferralCode('a'.repeat(33))).toBe(false)
  })

  it('rejects spaces and punctuation', () => {
    expect(isValidReferralCode('mike codeur')).toBe(false)
    expect(isValidReferralCode('mike!')).toBe(false)
    expect(isValidReferralCode('mike_codeur')).toBe(false)
  })

  it('rejects an empty or missing value', () => {
    expect(isValidReferralCode('')).toBe(false)
    expect(isValidReferralCode(undefined)).toBe(false)
  })
})

describe('parseReferralCodeFromCookieHeader', () => {
  it('reads the ref among other cookies', () => {
    expect(
      parseReferralCodeFromCookieHeader('theme=dark; ref=mike; NEXT_LOCALE=fr')
    ).toBe('mike')
  })

  it('reads the ref when it comes first', () => {
    expect(parseReferralCodeFromCookieHeader('ref=mike; theme=dark')).toBe(
      'mike'
    )
  })

  it('normalizes the value', () => {
    expect(parseReferralCodeFromCookieHeader('ref=MIKE')).toBe('mike')
  })

  it('decodes a percent-encoded value', () => {
    expect(parseReferralCodeFromCookieHeader('ref=mike%2Dcodeur')).toBe(
      'mike-codeur'
    )
  })

  it('returns undefined when the ref is absent', () => {
    expect(parseReferralCodeFromCookieHeader('theme=dark')).toBeUndefined()
  })

  it('returns undefined on an empty or missing header', () => {
    expect(parseReferralCodeFromCookieHeader('')).toBeUndefined()
    expect(parseReferralCodeFromCookieHeader(null)).toBeUndefined()
    expect(parseReferralCodeFromCookieHeader(undefined)).toBeUndefined()
  })

  it('rejects a forged value that does not match the pattern', () => {
    expect(parseReferralCodeFromCookieHeader("ref=' OR 1=1--")).toBeUndefined()
  })

  it('does not confuse a cookie whose name merely ends with ref', () => {
    expect(parseReferralCodeFromCookieHeader('myref=mike')).toBeUndefined()
  })
})
