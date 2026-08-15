import {Metadata} from 'next'
import {redirect} from 'next/navigation'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

export const metadata: Metadata = {
  title: 'Détails du projet',
  description: 'Détails et gestion du projet',
}

interface ProjectDetailsPageProps {
  params: Promise<{
    slug: string
    id: string
  }>
}

export default async function ProjectDetailsPage({
  params,
}: ProjectDetailsPageProps) {
  const path = await params
  redirect(`/team/${path.slug}/projects/${path.id}/tasks`)
  return <div className="bg-background"></div>
}
