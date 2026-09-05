import {redirect} from 'next/navigation'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

type PageProps = {
  params: Promise<{id: string}>
}

async function Page({params}: PageProps): Promise<never> {
  const {id} = await params
  redirect(`/admin/blog/${id}/edit`)
}

export default withAuthAdmin(Page)
