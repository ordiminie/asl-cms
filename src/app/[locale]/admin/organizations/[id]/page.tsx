import {redirect} from 'next/navigation'

import {withAuthAdmin} from '@/components/features/auth/with-auth'

async function EditOrganizationPage({
  params,
}: {
  params: Promise<{id: string}>
}): Promise<never> {
  const {id} = await params
  redirect(`/admin/organizations/${id}/edit`)
}

export default withAuthAdmin(EditOrganizationPage)
