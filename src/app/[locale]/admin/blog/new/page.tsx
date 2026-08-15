import {
  getAllCategoriesDal,
  getAllHashtagsDal,
  getPostPermissionsDal,
} from '@/app/dal/post-dal'
import {PostForm} from '@/components/features/admin/blog/post-form'
import {withAuthAdmin} from '@/components/features/auth/with-auth'

// Route authentifiée, pas encore migrée. Le layout fait un `await` sur la session à son
// niveau supérieur, ce qui bloque tout le segment. Le pattern officiel existe :
// https://nextjs.org/docs/app/guides/authentication-with-cache-components
// (session en 'use cache: private', promesse passée au provider, use() derrière Suspense).
// Voir D17 dans docs/plans/cache-components-migration.md.
export const instant = false

async function NewPostPage() {
  // Vérifications des permissions
  const permissions = await getPostPermissionsDal()

  if (!permissions.canCreate) {
    throw new Error(
      "Accès refusé - Vous n'avez pas les permissions pour créer un post"
    )
  }

  // Récupération des données nécessaires
  const [categories, hashtags] = await Promise.all([
    getAllCategoriesDal(),
    getAllHashtagsDal(),
  ])

  return (
    <div className="space-y-6">
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Créer un nouveau post
          </h1>
          <p className="text-muted-foreground">
            Créez un nouveau post de blog avec du contenu traduit en plusieurs
            langues
          </p>
        </div>

        <PostForm
          mode="create"
          categories={categories}
          hashtags={hashtags}
          files={[]}
        />
      </div>
    </div>
  )
}

export default withAuthAdmin(NewPostPage)
