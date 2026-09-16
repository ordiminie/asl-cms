import {serve} from 'inngest/next'

import {helloWorld, sendWelcomeFollowUpEmail} from '@/lib/inngest/functions'
import {inngest} from '@/lib/inngest/inngest'

// Create an API that serves zero functions
export const {GET, POST, PUT} = serve({
  client: inngest,
  functions: [helloWorld, sendWelcomeFollowUpEmail],
})
