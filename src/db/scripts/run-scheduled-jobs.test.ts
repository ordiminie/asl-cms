import {describe, expect, it} from 'vitest'

import {scheduledJobsExitCode} from './run-scheduled-jobs'

describe('run-scheduled-jobs — code de sortie de la minuterie (s26)', () => {
  it('sort 0 quand chaque association est passée', () => {
    expect(
      scheduledJobsExitCode({organizations: 2, processed: 3, failed: []})
    ).toBe(0)
  })

  it('sort non nul dès qu’une association a échoué', () => {
    expect(
      scheduledJobsExitCode({
        organizations: 2,
        processed: 1,
        failed: ['11111111-1111-4111-8111-111111111111'],
      })
    ).not.toBe(0)
  })
})
