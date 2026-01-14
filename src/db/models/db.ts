import {drizzle} from 'drizzle-orm/node-postgres'
import {Pool} from 'pg'

import {env} from '@/env'

import * as auth from './auth-model'
import * as creditLedger from './credit-ledger-model'
import * as notification from './notification-model'
import * as organization from './organization-model'
import * as post from './post-model'
import * as project from './project-model'
import * as subscription from './subscription-model'
import * as user from './user-model'
import * as userSubmission from './user-submission-model'

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Limite de connexions
  idleTimeoutMillis: 30_000, // Timeout pour connexions inactives
  connectionTimeoutMillis: 10_000,
})

const db = drizzle(pool, {
  schema: {
    ...auth,
    ...creditLedger,
    ...user,
    ...organization,
    ...project,
    ...subscription,
    ...notification,
    ...post,
    ...userSubmission,
  },
})

if (env.NEXT_PUBLIC_NODE_ENV === 'test') {
  throw new Error('Database connections are not allowed during tests.')
}

export default db
