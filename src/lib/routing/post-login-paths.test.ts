import {readdirSync} from 'node:fs'
import path from 'node:path'

import {describe, expect, it} from 'vitest'

import {POST_LOGIN_PATHS} from '@/services/authorization/association-authorization'

import nextConfig from '../../../next.config'

const APP_ROOT = path.resolve(import.meta.dirname, '../../app/[locale]')

/** `(groupe)` ne compte pas dans l'adresse. */
const isRouteGroup = (segment: string) => /^\(.*\)$/.test(segment)

type RouteFile = {path: string; kind: 'page' | 'route'}

/** Les pages et Route Handlers de l'application, par adresse servie. */
const routeFilesOf = (directory: string, segments: string[] = []) => {
  const files: RouteFile[] = []
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      const next = isRouteGroup(entry.name)
        ? segments
        : [...segments, entry.name]
      files.push(...routeFilesOf(path.join(directory, entry.name), next))
    } else if (/^(page|route)\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push({
        path: `/${segments.join('/')}`,
        kind: entry.name.startsWith('page') ? 'page' : 'route',
      })
    }
  }
  return files
}

/** Motif de `redirects()` en expression reguliere (`:param`, `:param*`). */
const sourcePatternOf = (source: string) =>
  new RegExp(
    `^${source.replace(/\/:[^/]+\*/g, '(?:/.*)?').replace(/:[^/]+/g, '[^/]+')}$`
  )

describe('destinations après connexion (s46b, revue M1)', () => {
  /**
   * Une Server Action qui redirige vers une adresse qui redirige a son tour
   * laisse la barre d'adresse sur la premiere adresse : Next suit la chaine
   * cote serveur et rend la page finale sous l'adresse demandee.
   */
  it.each(POST_LOGIN_PATHS)(
    '%s n’est la source d’aucune redirection de next.config.ts',
    async (target) => {
      const redirects = (await nextConfig.redirects?.()) ?? []

      const sources = redirects
        .map((redirect) => redirect.source)
        .filter((source) => sourcePatternOf(source).test(target))
      expect(sources).toEqual([])
    }
  )

  it.each(POST_LOGIN_PATHS)(
    '%s est une page, pas un Route Handler',
    (target) => {
      const files = routeFilesOf(APP_ROOT).filter(
        (file) => file.path === target
      )

      expect(files).toEqual([{path: target, kind: 'page'}])
    }
  )

  it('reconnaît la redirection /bureau et la route de passage', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []
    const files = routeFilesOf(APP_ROOT)

    expect(
      redirects.some((redirect) =>
        sourcePatternOf(redirect.source).test('/bureau')
      )
    ).toBe(true)
    expect(files).toContainEqual({path: '/login/destination', kind: 'route'})
  })
})
