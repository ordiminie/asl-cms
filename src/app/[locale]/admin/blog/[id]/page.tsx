import {redirect} from 'next/navigation'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

type PageProps = {
  params: Promise<{id: string}>
}

async function Page({params}: PageProps): Promise<never> {
  const {id} = await params
  redirect(`/admin/blog/${id}/edit`)
}

export default withAuthAdmin(Page)
