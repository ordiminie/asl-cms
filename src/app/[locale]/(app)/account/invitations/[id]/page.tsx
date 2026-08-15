import {headers} from 'next/headers'

import {auth} from '@/lib/better-auth/auth'

import {AcceptInvitationForm} from './accept-invitation-form'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

interface PageProps {
  params: Promise<{id: string}>
}

export default async function AcceptInvitationPage({params}: PageProps) {
  const {id} = await params

  let invitation
  try {
    invitation = await auth.api.getInvitation({
      headers: await headers(),
      query: {
        id,
      },
      // asResponse: true,
    })
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message)
    }
    throw new Error(
      "Une erreur est survenue lors de la récupération de l'invitation"
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AcceptInvitationForm invitation={invitation} />
    </div>
  )
}
