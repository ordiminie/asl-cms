import {notFound} from 'next/navigation'

import {getPostFilesDal} from '@/app/dal/file-dal'
import {getAllCategoriesDal, getAllHashtagsDal} from '@/app/dal/post-dal'
import {PostForm} from '@/components/features/admin/blog/post-form'
import {withAuthAdmin} from '@/components/features/auth/with-auth'
import {canUpdatePost} from '@/services/authorization/post-authorization'
import {getPostByIdWithRelationsService} from '@/services/facades/post-service-facade'

// Route authentifiée : le layout lit la session via getAuthUser() -> headers() et la
// passe à AuthProvider, qui enveloppe tout l'arbre. Aucun enfant à isoler dans un
// <Suspense> — c'est le cas que la doc Next appelle « no child to wrap ». Lever cet
// opt-out demande de revoir comment AuthProvider obtient l'utilisateur (D16).
export const instant = false

type PageProps = {
  params: Promise<{id: string}>
}

async function EditPostPage({params}: PageProps) {
  const {id} = await params

  // Récupération du post avec ses relations
  const post = await getPostByIdWithRelationsService(id)

  if (!post) {
    notFound()
  }

  // Vérifications des permissions
  const canEdit = await canUpdatePost(id)

  if (!canEdit) {
    throw new Error(
      "Accès refusé - Vous n'avez pas les permissions pour modifier ce post"
    )
  }

  // Récupération des données nécessaires
  const [categories, hashtags, files] = await Promise.all([
    getAllCategoriesDal(),
    getAllHashtagsDal(),
    getPostFilesDal(id),
  ])

  return (
    <div className="space-y-6">
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Modifier le post
          </h1>
          <p className="text-muted-foreground">ID: {post.id}</p>
        </div>

        <PostForm
          mode="edit"
          post={post}
          categories={categories}
          hashtags={hashtags}
          files={files}
        />
      </div>
    </div>
  )
}

export default withAuthAdmin(EditPostPage)
