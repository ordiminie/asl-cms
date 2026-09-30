import {describe, expect, it} from 'vitest'

import {resolveReportRecipients} from '../types/domain/incident-report-types'

describe('resolveReportRecipients — décision F', () => {
  it('keeps the contact address alone when the category has none', () => {
    expect(resolveReportRecipients('bureau@x.test', null)).toEqual([
      'bureau@x.test',
    ])
  })

  it('adds the category address after the contact address', () => {
    expect(resolveReportRecipients('bureau@x.test', 'forage@x.test')).toEqual([
      'bureau@x.test',
      'forage@x.test',
    ])
  })

  it('deduplicates without regard to case or surrounding spaces', () => {
    expect(
      resolveReportRecipients('Contact@x.test', ' contact@X.test ')
    ).toEqual(['Contact@x.test'])
  })

  it('ignores an absent or blank address on either side', () => {
    expect(resolveReportRecipients(undefined, 'forage@x.test')).toEqual([
      'forage@x.test',
    ])
    expect(resolveReportRecipients('bureau@x.test', '  ')).toEqual([
      'bureau@x.test',
    ])
    expect(resolveReportRecipients(undefined, null)).toEqual([])
  })
})
