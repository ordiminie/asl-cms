import {drizzle} from 'drizzle-orm/node-postgres'
import {Pool} from 'pg'

import {env} from '@/env'

import * as appSettings from './app-settings-model'
import * as auth from './auth-model'
import * as contentBlock from './content-block-model'
import * as menuItem from './menu-item-model'
import * as news from './news-model'
import * as notification from './notification-model'
import * as organization from './organization-model'
import * as organizationSetting from './organization-setting-model'
import * as page from './page-model'
import * as post from './post-model'
import * as subscription from './subscription-model'
import * as user from './user-model'
import * as userSubmission from './user-submission-model'

// `max` vaut 1 par défaut, et ce n'est pas un réglage frileux : en serverless
// chaque instance ouvre SON pool, donc les connexions retenues valent
// `max × instances actives`. Monter cette valeur réduit le nombre d'instances
// qui tiennent sous la limite du pooler. Sur un déploiement long-running, la
// logique s'inverse. Lire docs/database-pool.md avant tout changement.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 30_000,
})

const db = drizzle(pool, {
  schema: {
    ...appSettings,
    ...auth,
    ...user,
    ...organization,
    ...organizationSetting,
    ...subscription,
    ...notification,
    ...post,
    ...page,
    ...contentBlock,
    ...menuItem,
    ...news,
    ...userSubmission,
  },
})

if (env.NEXT_PUBLIC_NODE_ENV === 'test') {
  throw new Error('Database connections are not allowed during tests.')
}

export default db
