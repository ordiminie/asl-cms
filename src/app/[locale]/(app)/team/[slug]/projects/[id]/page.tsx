import {Metadata} from 'next'
import {redirect} from 'next/navigation'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
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
