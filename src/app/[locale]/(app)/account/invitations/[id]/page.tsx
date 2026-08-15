import {headers} from 'next/headers'

import {auth} from '@/lib/better-auth/auth'

import {AcceptInvitationForm} from './accept-invitation-form'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
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
