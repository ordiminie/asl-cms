import {redirect} from 'next/navigation'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false

type PageProps = {
  params: Promise<{id: string}>
}

async function Page({params}: PageProps): Promise<never> {
  const {id} = await params
  redirect(`/admin/blog/${id}/edit`)
}

export default withAuthAdmin(Page)
