import 'server-only'

import {env} from '@/env'

import {createPennylaneClient, type PennylaneClient} from './pennylane-client'

/**
 * Le client Pennylane de l'instance (s20, ADR 062 §10) : une cle pour
 * l'instance tant qu'un seul client. Absente, chaque appel echoue avec
 * `missing_key`. La base n'est remplacee que par un faux serveur local, en
 * test de bout en bout (`PENNYLANE_API_BASE_URL`).
 */
export const getPennylaneClient = (): PennylaneClient =>
  createPennylaneClient({
    apiKey: env.PENNYLANE_API_KEY,
    ...(env.PENNYLANE_API_BASE_URL
      ? {baseUrl: env.PENNYLANE_API_BASE_URL}
      : {}),
  })
