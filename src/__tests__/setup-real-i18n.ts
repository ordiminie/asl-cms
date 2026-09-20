import {vi} from 'vitest'

/*
 * Une Server Action appelee depuis un navigateur neuf : `next/root-params`
 * n'existe pas hors d'une route et jette, et aucun cookie `NEXT_LOCALE` n'a
 * encore ete pose. C'est le contexte ou l'e2e de la CI a recu l'email de
 * connexion en anglais.
 */
vi.mock('next/root-params', () => ({
  locale: vi.fn(async () => {
    throw new Error('`locale` can only be called in the context of a route')
  }),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => new Map<string, {value: string}>()),
  headers: vi.fn(async () => new Headers()),
}))
