import {FileText} from 'lucide-react'

import {PaginatedBlogResult} from '@/app/dal/blog-dal'
import {BlogCard} from '@/components/features/blog/blog-card'
import {BlogPagination} from '@/components/features/blog/blog-pagination'

interface BlogListProps {
  result: PaginatedBlogResult
  locale: string
  baseUrl: string
  translations: {
    noCategory: string
    views: string
    likes: string
    readMore: string
    noArticles: string
    noArticlesDescription?: string
    previous: string
    next: string
    page: string
    of: string
  }
}

export function BlogList({
  result,
  locale,
  baseUrl,
  translations,
}: BlogListProps) {
  const {posts, pagination} = result
  const isFirstPage = pagination.page === 1

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <FileText className="text-muted-foreground h-8 w-8" />
        </div>
        <p className="text-muted-foreground text-lg font-medium">
          {translations.noArticles}
        </p>
        {translations.noArticlesDescription && (
          <p className="text-muted-foreground mt-2 text-sm">
            {translations.noArticlesDescription}
          </p>
        )}
      </div>
    )
  }

  const [featuredPost, ...otherPosts] = posts
  const showFeatured = isFirstPage && posts.length > 1

  return (
    <>
      {showFeatured && featuredPost && (
        <div className="mb-8">
          <BlogCard
            post={featuredPost}
            locale={locale}
            featured
            translations={{
              noCategory: translations.noCategory,
              views: translations.views,
              likes: translations.likes,
              readMore: translations.readMore,
            }}
          />
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {(showFeatured ? otherPosts : posts).map((post) => (
          <BlogCard
            key={post.id}
            post={post}
            locale={locale}
            translations={{
              noCategory: translations.noCategory,
              views: translations.views,
              likes: translations.likes,
              readMore: translations.readMore,
            }}
          />
        ))}
      </div>

      <BlogPagination
        pagination={pagination}
        baseUrl={baseUrl}
        translations={{
          previous: translations.previous,
          next: translations.next,
          page: translations.page,
          of: translations.of,
        }}
      />
    </>
  )
}
