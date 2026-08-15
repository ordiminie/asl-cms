import {redirect} from 'next/navigation'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

type PageProps = {
  params: Promise<{id: string}>
}

async function Page({params}: PageProps): Promise<never> {
  const {id} = await params
  redirect(`/admin/blog/${id}/edit`)
}

export default withAuthAdmin(Page)
