#!/usr/bin/env tsx
/* eslint-disable no-restricted-properties */

import {spawnSync} from 'node:child_process'

/**
 * Garde-fou avant `next build`.
 *
 * Un build Next reste **vert** avec une base injoignable : les lectures
 * échouent en silence, le prerender produit une sortie amputée (sitemap sans
 * les articles en base, plans Stripe absents), et les chemins de code qui
 * dépendent de la base ne sont jamais exercés. Pendant la migration Cache
 * Components, un bug de prerender est resté invisible plusieurs heures pour
 * exactement cette raison — le build passait alors que les trois DATABASE_URL
 * du projet étaient mortes.
 *
 * Échappatoire : `SKIP_DB_CHECK=1` quand l'absence de base est voulue (build
 * d'image Docker, CI sans service Postgres).
 */
if (process.env.SKIP_DB_CHECK === '1') {
  console.log('⚠️  Vérification de la base ignorée (SKIP_DB_CHECK=1)')
  process.exit(0)
}

const result = spawnSync('pnpm', ['db:check'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  console.error(`
❌ Build interrompu : la base de données n'est pas joignable.

Un build qui passe sans base ne prouve rien sur le code qui la touche : il
produit un sitemap amputé et laisse dormir les erreurs de prerender.

Vérifiez DATABASE_URL, ou lancez avec SKIP_DB_CHECK=1 si c'est volontaire.
`)
  process.exit(result.status ?? 1)
}
