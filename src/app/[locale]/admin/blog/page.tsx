import {Suspense} from 'react'

import {PostsSkeleton} from '@/components/features/admin/blog/posts-skeleton'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

import PostsContent from './posts-content'

type SearchParamsType = Promise<{
  page?: string
  limit?: string
  search?: string
  status?: string
  categoryId?: string
}>

async function AdminBlogPage({searchParams}: {searchParams: SearchParamsType}) {
  const params = await searchParams
  const suspenseKey = `page=${params.page || '1'}-limit=${params.limit || '10'}-search=${params.search || ''}-status=${params.status || ''}-categoryId=${params.categoryId || ''}`

  return (
    <div className="bg-background px-2 md:px-4">
      <Suspense key={suspenseKey} fallback={<PostsSkeleton />}>
        <PostsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

export default withAuthAdmin(AdminBlogPage)
