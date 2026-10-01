/**
 * Segments servis derriere une session : le groupe (app), l'espace admin et
 * l'espace bureau de l'association (s01b).
 *
 * **Une seule liste pour deux usages** (s11, decision D) : le proxy en tire
 * son controle de session, `robots.txt` ses interdictions. Un nouveau segment
 * authentifie se declare ici, et il est protege des deux cotes du meme geste.
 */
export const AUTHENTICATED_SEGMENTS: readonly string[] = [
  '/account',
  '/admin',
  '/bureau',
  '/dashboard',
  '/team',
]

/** Ecrans de connexion : publics, mais sans interet pour un moteur. */
export const SIGN_IN_SEGMENTS: readonly string[] = [
  '/login',
  '/register',
  '/verify-request',
  '/reset-password',
  '/logout',
  '/auth-error',
]
