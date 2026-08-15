import {Metadata} from 'next'
import {redirect} from 'next/navigation'

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
