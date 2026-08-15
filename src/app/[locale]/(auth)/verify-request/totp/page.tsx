import {Suspense} from 'react'

import TotpVerificationPage from './totp'

export default function Page() {
  return (
    <Suspense>
      <TotpVerificationPage />
    </Suspense>
  )
}
