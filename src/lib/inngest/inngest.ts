import {Inngest} from 'inngest'

import {env} from '@/env'

import {APP_NAME} from '../constants'

export const inngest = new Inngest({
  id: APP_NAME,
  isDev: env.NEXT_PUBLIC_NODE_ENV !== 'production',
})
