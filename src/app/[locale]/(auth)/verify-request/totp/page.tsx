import {Suspense} from 'react'

import TotpVerificationPage from './totp'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

export default function Page() {
  return (
    <Suspense>
      <TotpVerificationPage />
    </Suspense>
  )
}
