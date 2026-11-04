/**
 * Les services sont gardes par `server-only`, qui leve une erreur hors de
 * Next. Les scripts d'exploitation (tsx, sans Next) appellent ces services :
 * `allowServerOnly()` remplace, pour la vie du processus, le chargement de
 * `server-only/index.js` par un module vide (ADR 044). Fonctionne sur Node
 * 22.22.2 et 22.23.3, contrairement a `registerHooks`.
 *
 * Renvoie la fonction qui retablit le chargement d'origine.
 */
import Module from 'node:module'

type ModuleLoad = (request: unknown, ...rest: unknown[]) => unknown
type ResolveFilename = (request: string, parent: unknown) => string

const SERVER_ONLY_ENTRY = /server-only[\\/]index\.js$/

const loader = Module as unknown as {
  _load: ModuleLoad
  _resolveFilename: ResolveFilename
}

/**
 * tsx transmet le chemin deja resolu, `createRequire` le nom du paquet : les
 * deux designent le meme fichier une fois resolus.
 */
const isServerOnlyEntry = (request: unknown, parent: unknown): boolean => {
  if (typeof request !== 'string' || !request.includes('server-only')) {
    return false
  }
  if (SERVER_ONLY_ENTRY.test(request)) return true
  try {
    return SERVER_ONLY_ENTRY.test(loader._resolveFilename(request, parent))
  } catch {
    return false
  }
}

export const allowServerOnly = (): (() => void) => {
  const originalLoad = loader._load

  loader._load = function (this: unknown, request, ...rest) {
    if (isServerOnlyEntry(request, rest[0])) return {}
    return originalLoad.call(this, request, ...rest)
  }

  return () => {
    loader._load = originalLoad
  }
}
