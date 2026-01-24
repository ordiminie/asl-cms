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

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground text-lg">
          {translations.noArticles}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-8">
        {posts.map((post) => (
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
