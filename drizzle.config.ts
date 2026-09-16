/* eslint-disable no-restricted-properties */
import {defineConfig} from 'drizzle-kit'

import {resolveMigrationUrl} from './src/db/scripts/db-url'
import initDotEnv from './src/db/scripts/env'

initDotEnv()

export default defineConfig({
  schema: './src/db/models/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit crée et compare les objets du schéma : rôle propriétaire.
    url: resolveMigrationUrl(process.env),
  },
  verbose: true,
  strict: true,
  introspect: {
    casing: 'camel',
  },
})
