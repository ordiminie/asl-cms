import type {BetterAuthPlugin} from 'better-auth'
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'

export const IMPERSONATION_GUARD_ID = 'impersonation-guard'

/** Code rendu quand une ecriture sensible est tentee pendant l'imitation. */
export const IMPERSONATION_FORBIDDEN_CODE = 'FORBIDDEN_WHILE_IMPERSONATING'

/**
 * Un seul chemin d'ouverture et de sortie (ADR 041) : les routes HTTP du plugin
 * admin() repondent 404 ; seul le service d'imitation appelle `auth.api.*`,
 * puis ecrit la trace.
 */
export const IMPERSONATION_DISABLED_HTTP_PATHS: readonly string[] = [
  '/admin/impersonate-user',
  '/admin/stop-impersonating',
]

const SENSITIVE_ACCOUNT_PATHS: readonly string[] = [
  '/change-password',
  '/change-email',
  '/delete-user',
  '/link-social',
  '/unlink-account',
]

/**
 * Les ecritures qui changeraient l'acces du compte vise : mot de passe, email,
 * double authentification, suppression, comptes lies (ADR 041, decision 4).
 * Le nom et l'image (`/update-user`) restent modifiables.
 */
export const isSensitiveAccountPath = (path: string | undefined): boolean =>
  !!path &&
  (SENSITIVE_ACCOUNT_PATHS.includes(path) || path.startsWith('/two-factor/'))

/**
 * Plugin local : refuse explicitement les ecritures sensibles tant que la
 * session est ouverte a la place d'un compte (`session.impersonatedBy`). Le
 * refus ne depend ni du mot de passe ni d'un drapeau d'environnement.
 */
export const impersonationGuard = () =>
  ({
    id: IMPERSONATION_GUARD_ID,
    hooks: {
      before: [
        {
          matcher: (context) => isSensitiveAccountPath(context.path),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx)
            if (session?.session.impersonatedBy) {
              throw new APIError('FORBIDDEN', {
                code: IMPERSONATION_FORBIDDEN_CODE,
                message:
                  'Indisponible pendant une session à la place d’un compte.',
              })
            }
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin
