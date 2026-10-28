#!/usr/bin/env node
/**
 * Recours d'exploitation (s14, D8, ADR 039) : la President(e) d'une
 * association est partie sans transmettre la presidence.
 *
 *     pnpm ops:transfer-presidency -- <domaine> <adresse>
 *
 * Passe par le meme service que l'ecran, sous le meme verrou : le compte de
 * cette adresse, deja membre de l'association du domaine, devient
 * President(e) ; l'ancienne repasse Bureau. Trace `presidency_transfer`,
 * auteur « Zourite Studio ». Refuse une adresse sans compte membre de cette
 * association.
 */
import {registerHooks} from 'node:module'
import {pathToFileURL} from 'node:url'
import {parseArgs} from 'node:util'

import initDotEnv from './env'

export type TransferPresidencyArgs = {
  domain: string
  email: string
}

const USAGE = 'Usage : pnpm ops:transfer-presidency <domaine> <adresse>'

/** Lit les deux arguments positionnels. Le contenu est valide par le service. */
export const parseTransferPresidencyArgs = (
  argv: string[]
): TransferPresidencyArgs => {
  const args = argv[0] === '--' ? argv.slice(1) : argv
  const {positionals} = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {},
  })

  if (positionals.length !== 2) {
    throw new Error(USAGE)
  }

  const [domain, email] = positionals
  return {domain, email}
}

/**
 * Les services sont gardes par `server-only`, que Next resout sous la
 * condition `react-server` : le script lui donne la meme resolution, comme
 * l'amorcage.
 */
const transferPresidency = async () => {
  const {domain, email} = parseTransferPresidencyArgs(process.argv.slice(2))

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

  const {transferPresidencyByOperatorService} =
    await import('@/services/facades/member-role-service-facade')
  const result = await transferPresidencyByOperatorService(domain, email)
  console.log(
    result.changed
      ? `Présidence transmise : association ${result.organizationId}, nouvelle Président(e) ${result.newOwnerUserId}, ancienne(s) ${result.previousOwnerUserIds.join(', ') || 'aucune'}`
      : `Rien à faire : ${result.newOwnerUserId} est déjà Président(e) de l'association ${result.organizationId}`
  )
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  transferPresidency()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Echec de la passation de la présidence', error)
      process.exit(1)
    })
}
