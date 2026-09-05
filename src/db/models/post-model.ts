import {relations, sql} from 'drizzle-orm'
import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {user} from './auth-model'

export const categories = pgTable('categories', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  icon: text('icon'),
  image: text('image'),
  createdAt: timestamp('createdat', {mode: 'date'}).defaultNow(),
  updatedAt: timestamp('updatedat', {mode: 'date'}).defaultNow(),
})
export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'published',
  'archived',
])

export const posts = pgTable('posts', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  status: postStatusEnum('status').default('draft').notNull(),
  authorId: uuid('authorid').references(() => user.id),
  categoryId: uuid('categoryid').references(() => categories.id),
  createdAt: timestamp('createdat', {mode: 'date'}).defaultNow(),
  updatedAt: timestamp('updatedat', {mode: 'date'}).defaultNow(),
  nbView: integer('nbview').default(0),
  nbLike: integer('nblike').default(0),
})

export const postsTranslation = pgTable(
  'posts_translation',
  {
    id: uuid('id')
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    postId: uuid('postid')
      .references(() => posts.id)
      .notNull(), // Relation avec `posts`
    createdAt: timestamp('createdat', {mode: 'date'}).defaultNow(),
    updatedAt: timestamp('updatedat', {mode: 'date'}).defaultNow(),
    language: text('language').notNull().default('fr'), // Code langue (e.g., 'fr', 'en')
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(), // Slug traduit
    content: text('content').notNull(), // Contenu traduit
    description: text('description').notNull(), // Description traduite
    metaTitle: text('meta_title'), // Titre SEO
    metaDescription: text('meta_description'), // Description SEO
    metaKeywords: text('meta_keywords'), // Mots-clés SEO
  },
  (table) => ({
    // Contrainte unique sur postId et language
    postLanguageUnique: uniqueIndex('post_language_unique').on(
      table.postId,
      table.language
    ),
  })
)

export const hashtags = pgTable('hashtags', {
  id: uuid('id')
    .default(sql`uuid_generate_v4()`)
    .primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('createdat', {mode: 'date'}).defaultNow(),
  updatedAt: timestamp('updatedat', {mode: 'date'}).defaultNow(),
})

export const postHashtags = pgTable(
  'post_hashtags',
  {
    postId: uuid('postid')
      .notNull()
      .references(() => posts.id),
    hashtagId: uuid('hashtagid')
      .notNull()
      .references(() => hashtags.id),
  },
  (table) => {
    return {
      pk: primaryKey({columns: [table.postId, table.hashtagId]}),
    }
  }
)

// Relation de `categories` vers `posts`
export const categoriesRelations = relations(categories, ({many}) => ({
  posts: many(posts),
}))

// Relation de `posts` vers `categories` et `post_hashtags`
export const postsRelations = relations(posts, ({one, many}) => ({
  //hashtags: many(postHashtags),
  postHashtags: many(postHashtags),
  postTranslations: many(postsTranslation),
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id],
  }),
  author: one(user, {
    fields: [posts.authorId],
    references: [user.id],
  }),
}))

// Relation de `hashtags` vers `post_hashtags`
export const hashtagsRelations = relations(hashtags, ({many}) => ({
  postHashtags: many(postHashtags),
}))
//relation inverse de `post_hashtags` vers `hashtags` et `posts`
export const postHashtagsRelations = relations(postHashtags, ({one}) => ({
  post: one(posts, {
    fields: [postHashtags.postId],
    references: [posts.id],
  }),
  hashtag: one(hashtags, {
    fields: [postHashtags.hashtagId],
    references: [hashtags.id],
  }),
}))

export const postsTranslationRelations = relations(
  postsTranslation,
  ({one}) => ({
    post: one(posts, {
      fields: [postsTranslation.postId],
      references: [posts.id],
    }),
  })
)

export type PostModel = typeof posts.$inferSelect
export type AddPostModel = typeof posts.$inferInsert
export type DeletePostModel = Pick<PostModel, 'id'>
export type UpdatePostModel = AddPostModel & {id: PostModel['id']}

export type PostsTranslationModel = typeof postsTranslation.$inferSelect
export type AddPostsTranslationModel = typeof postsTranslation.$inferInsert
export type AddPostsTranslationModelOptionalPostId = Omit<
  AddPostsTranslationModel,
  'postId'
> & {
  postId?: AddPostsTranslationModel['postId']
}

export type CategoryModel = typeof categories.$inferSelect
export type AddCategoryModel = typeof categories.$inferInsert
export type DeleteCategoryModel = Pick<CategoryModel, 'id'>
export type UpdateCategoryModel = AddCategoryModel & {id: CategoryModel['id']}

export type HashtagsModel = typeof hashtags.$inferSelect
export type AddHashtagsModel = typeof hashtags.$inferInsert
export type DeleteHashtagModel = Pick<HashtagsModel, 'id'>
export type UpdateHashtagModel = AddHashtagsModel & {id: HashtagsModel['id']}

export type PostHashtagsModel = typeof postHashtags.$inferSelect
export type AddPostHashtagsModel = typeof postHashtags.$inferInsert
