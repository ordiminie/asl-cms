import {Suspense} from 'react'

import OtpVerificationPage from './otp'

export default function Page() {
  return (
    <Suspense>
      <OtpVerificationPage />
    </Suspense>
  )
}
