/* eslint-disable no-restricted-properties */
import {defineConfig} from 'drizzle-kit'

import initDotEnv from './src/db/scripts/env'

initDotEnv()

export default defineConfig({
  schema: './src/db/models/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  verbose: true,
  strict: true,
  introspect: {
    casing: 'camel',
  },
})
