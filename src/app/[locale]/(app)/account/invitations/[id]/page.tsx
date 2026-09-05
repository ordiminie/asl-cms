import {headers} from 'next/headers'

import {auth} from '@/lib/better-auth/auth'

import {AcceptInvitationForm} from './accept-invitation-form'

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
