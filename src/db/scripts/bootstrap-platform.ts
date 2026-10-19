#!/usr/bin/env node
/**
 * Amorcage d'une base neuve (s12b) : la premiere association, son parametrage
 * initial et le premier compte `super_admin`, sans mot de passe.
 *
 *     pnpm ops:bootstrap -- --name "<nom>" --slug <slug> --domain <domaine> \
 *       --admin-email <email du prestataire> --contact-email <contact>
 *
 * Refuse de tourner si un `super_admin` ou ce domaine existe deja. Ne cree
 * aucune donnee du seed. Les associations suivantes passent par l'ecran
 * `/admin/organizations/new`.
 */
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'
import {parseArgs} from 'node:util'

import initDotEnv from './env'

export type BootstrapArgs = {
  name: string
  slug: string
  domain: string
  adminEmail: string
  contactEmail: string
}

const OPTIONS = {
  name: 'name',
  slug: 'slug',
  domain: 'domain',
  'admin-email': 'adminEmail',
  'contact-email': 'contactEmail',
} as const satisfies Record<string, keyof BootstrapArgs>

/**
 * Lit les options de la ligne de commande. La validation du contenu (domaine,
 * emails) est celle du provisionnement, faite par le service.
 */
export const parseBootstrapArgs = (argv: string[]): BootstrapArgs => {
  const args = argv[0] === '--' ? argv.slice(1) : argv
  const {values} = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: Object.fromEntries(
      Object.keys(OPTIONS).map((flag) => [flag, {type: 'string'}])
    ) as Record<keyof typeof OPTIONS, {type: 'string'}>,
  })

  const missing = Object.keys(OPTIONS).filter(
    (flag) => values[flag as keyof typeof OPTIONS] === undefined
  )
  if (missing.length > 0) {
    throw new Error(
      `Options manquantes : ${missing.map((flag) => `--${flag}`).join(', ')}`
    )
  }

  return Object.fromEntries(
    Object.entries(OPTIONS).map(([flag, key]) => [
      key,
      values[flag as keyof typeof OPTIONS],
    ])
  ) as BootstrapArgs
}

/**
 * Les services sont gardes par `server-only`, que Next resout sous la
 * condition `react-server` : le script lui donne la meme resolution, comme la
 * purge des empreintes.
 */
const bootstrap = async () => {
  const args = parseBootstrapArgs(process.argv.slice(2))

  registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === 'server-only'
        ? nextResolve(specifier, {
            ...context,
            conditions: [...context.conditions, 'react-server'],
          })
        : nextResolve(specifier, context),
  })
  await initDotEnv()

  const {bootstrapPlatformService} =
    await import('@/services/facades/organization-service-facade')
  const {organization, superAdminUserId} = await bootstrapPlatformService(args)
  console.log(
    `Plateforme amorcee : association ${organization.id} (${organization.slug}), super_admin ${superAdminUserId}`
  )
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  bootstrap()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Echec de l'amorcage de la plateforme", error)
      process.exit(1)
    })
}
