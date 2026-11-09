import {describe, expect, it} from 'vitest'

import {myReportUpdatedAtOf} from '../types/domain/incident-report-types'

describe('myReportUpdatedAtOf — « Mis à jour le » côté membre (s22)', () => {
  const lastEventAt = new Date('2026-10-02T09:00:00Z')

  it('gives no date while the report is still only reported', () => {
    expect(myReportUpdatedAtOf('reported', lastEventAt)).toBeNull()
  })

  it('gives the date of the last event once the status has changed', () => {
    expect(myReportUpdatedAtOf('in_progress', lastEventAt)).toEqual(lastEventAt)
    expect(myReportUpdatedAtOf('resolved', lastEventAt)).toEqual(lastEventAt)
  })

  it('gives no date when no event is known', () => {
    expect(myReportUpdatedAtOf('resolved', null)).toBeNull()
  })
})
