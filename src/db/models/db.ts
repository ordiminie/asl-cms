import {drizzle} from 'drizzle-orm/node-postgres'
import {Pool} from 'pg'

import {env} from '@/env'

import * as appSettings from './app-settings-model'
import * as auth from './auth-model'
import * as creditLedger from './credit-ledger-model'
import * as notification from './notification-model'
import * as organization from './organization-model'
import * as post from './post-model'
import * as project from './project-model'
import * as subscription from './subscription-model'
import * as user from './user-model'
import * as userSubmission from './user-submission-model'

const createPool = () =>
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10, // Neon session mode limite le pooler à 15 clients
    idleTimeoutMillis: 30_000, // Timeout pour connexions inactives
    connectionTimeoutMillis: 10_000,
  })

// Singleton via globalThis : en dev, chaque reload HMR recrée le module
// et fuiterait un nouveau pool (EMAXCONNSESSION sur Neon)
const globalForDb = globalThis as unknown as {pgPool?: Pool}

const pool = globalForDb.pgPool ?? createPool()

if (env.NEXT_PUBLIC_NODE_ENV !== 'production') {
  globalForDb.pgPool = pool
}

const db = drizzle(pool, {
  schema: {
    ...appSettings,
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
