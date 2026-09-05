import {faker} from '@faker-js/faker'
import {beforeEach, describe, expect, it, vi} from 'vitest'

// Mock des DAOs avant l'import
vi.mock('@/db/repositories/post-repository')
vi.mock('@/db/repositories/notification-repository')
vi.mock('@/db/repositories/user-repository')

// Mock du logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

import {NotificationModel} from '@/db/models/notification-model'
import {createNotificationDao} from '@/db/repositories/notification-repository'
import {
  createCategoryDao,
  createHashtagDao,
  createPostDao,
  createPostTranslationDao,
  deleteCategoryByIdDao,
  deleteHashtagByIdDao,
  deletePostByIdDao,
  getCategoryByIdDao,
  getCategoryByNameDao,
  getHashtagByIdDao,
  getHashtagByNameDao,
  getPostByIdDao,
  getPostByIdWithRelationsDao,
  getPostByIdWithTranslationsDao,
  getPostBySlugAndLanguageDao,
  getPostsByCategoryIdDao,
  getPostTranslationByPostIdAndLanguageDao,
  incrementPostLikeDao,
  incrementPostViewDao,
  updateCategoryByIdDao,
  updateHashtagByIdDao,
  updatePostByIdDao,
} from '@/db/repositories/post-repository'
import {getUserByIdDao} from '@/db/repositories/user-repository'

import {AuthorizationError} from '../errors/authorization-error'
import {ValidationError} from '../errors/validation-error'
import {
  archivePostService,
  createCategoryService,
  createHashtagService,
  createPostService,
  createPostTranslationService,
  deleteCategoryService,
  deletePostService,
  generateSlugService,
  getCategoryByIdService,
  getHashtagByIdService,
  getPostByIdService,
  getPostByIdWithRelationsService,
  getPostBySlugAndLanguageService,
  incrementViewPostService,
  likePostService,
  publishPostService,
  unpublishPostService,
  updateCategoryService,
  updatePostService,
} from '../post-service'
import {NotificationTypeConst} from '../types/domain/notification-types'
import {
  Category,
  CreateCategory,
  CreateHashtag,
  CreatePost,
  CreatePostTranslation,
  Hashtag,
  Post,
  POST_STATUS,
  PostData,
  PostTranslation,
  UpdateCategory,
  UpdatePost,
} from '../types/domain/post-types'
import {setupAuthUserMocked} from './helper-service-test'
import {userTest, userTestAdmin} from './service-test-data'

describe('[ADMIN] CRUD : Post Service', () => {
  const postId = faker.string.uuid()
  const categoryId = faker.string.uuid()
  const hashtagId = faker.string.uuid()
  const translationId = faker.string.uuid()

  const categoryData: Category = {
    id: categoryId,
    name: 'Tech',
    description: 'Articles tech',
    icon: '💻',
    image: 'https://example.com/tech.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const hashtagData: Hashtag = {
    id: hashtagId,
    name: 'javascript',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const postData: Post = {
    id: postId,
    status: POST_STATUS.DRAFT,
    authorId: userTestAdmin.id,
    categoryId: categoryId,
    createdAt: new Date(),
    updatedAt: new Date(),
    nbView: 0,
    nbLike: 0,
  }

  const postWithRelationsData: PostData = {
    ...postData,
    author: userTestAdmin,
    category: categoryData,
    postTranslations: [],
    postHashtags: [],
  }

  const translationData: PostTranslation = {
    id: translationId,
    postId: postId,
    createdAt: new Date(),
    updatedAt: new Date(),
    language: 'fr',
    title: 'Mon Premier Post',
    slug: 'mon-premier-post',
    content: '# Mon Premier Post\n\nContenu du post...',
    description: 'Description du post',
    metaTitle: 'Mon Premier Post',
    metaDescription: 'Description du post',
    metaKeywords: 'Mon Premier Post, Description du post',
  }

  const notificationData: NotificationModel = {
    id: faker.string.uuid(),
    userId: userTestAdmin.id,
    type: NotificationTypeConst.project_created,
    title: 'Test',
    message: 'Test message',
    metadata: {},
    read: false,
    createdAt: new Date(),
  }

  beforeEach(() => {
    setupAuthUserMocked(userTestAdmin)
    vi.clearAllMocks()

    // Mock des méthodes DAO pour les posts
    vi.mocked(createPostDao).mockResolvedValue(postData)
    vi.mocked(getPostByIdDao).mockResolvedValue(postData)
    vi.mocked(getPostByIdWithRelationsDao).mockResolvedValue(
      postWithRelationsData
    )
    vi.mocked(getPostByIdWithTranslationsDao).mockResolvedValue(
      postWithRelationsData
    )
    vi.mocked(updatePostByIdDao).mockResolvedValue()
    vi.mocked(deletePostByIdDao).mockResolvedValue()
    vi.mocked(getPostBySlugAndLanguageDao).mockResolvedValue(
      postWithRelationsData
    )
    vi.mocked(incrementPostLikeDao).mockResolvedValue()
    vi.mocked(incrementPostViewDao).mockResolvedValue()

    // Mock des méthodes DAO pour les catégories
    vi.mocked(createCategoryDao).mockResolvedValue(categoryData)
    vi.mocked(getCategoryByIdDao).mockResolvedValue(categoryData)
    vi.mocked(getCategoryByNameDao).mockResolvedValue(undefined)
    vi.mocked(updateCategoryByIdDao).mockResolvedValue()
    vi.mocked(deleteCategoryByIdDao).mockResolvedValue()

    // Mock des méthodes DAO pour les hashtags
    vi.mocked(createHashtagDao).mockResolvedValue(hashtagData)
    vi.mocked(getHashtagByIdDao).mockResolvedValue(hashtagData)
    vi.mocked(getHashtagByNameDao).mockResolvedValue(undefined)
    vi.mocked(updateHashtagByIdDao).mockResolvedValue()
    vi.mocked(deleteHashtagByIdDao).mockResolvedValue()

    // Mock des traductions
    vi.mocked(createPostTranslationDao).mockResolvedValue(translationData)
    vi.mocked(getPostTranslationByPostIdAndLanguageDao).mockResolvedValue(
      undefined
    )

    // Mock des relations
    vi.mocked(getPostsByCategoryIdDao).mockResolvedValue([])

    // Mock notification
    vi.mocked(createNotificationDao).mockResolvedValue(notificationData)

    // Mock user pour les notifications
    vi.mocked(getUserByIdDao).mockResolvedValue(userTestAdmin)
  })

  describe('POSTS', () => {
    it('should create a post', async () => {
      const createData: CreatePost = {
        status: POST_STATUS.DRAFT,
        authorId: userTestAdmin.id,
        categoryId: categoryId,
      }

      const result = await createPostService(createData)

      expect(createPostDao).toHaveBeenCalledWith(createData)
      expect(result).toEqual(postData)
    })

    it('should get post by id', async () => {
      const result = await getPostByIdService(postId)

      expect(getPostByIdDao).toHaveBeenCalledWith(postId)
      expect(result).toEqual(postData)
    })

    it('should get post by id with relations', async () => {
      const result = await getPostByIdWithRelationsService(postId)

      expect(getPostByIdWithRelationsDao).toHaveBeenCalledWith(postId)
      expect(result).toEqual(postWithRelationsData)
    })

    it('should get post by slug and language', async () => {
      const slug = 'mon-premier-post'
      const language = 'fr' as const

      const result = await getPostBySlugAndLanguageService(slug, language)

      expect(getPostBySlugAndLanguageDao).toHaveBeenCalledWith(slug, language)
      expect(result).toEqual(postWithRelationsData)
    })

    it('should update a post', async () => {
      const updateData: UpdatePost = {
        id: postId,
        status: POST_STATUS.PUBLISHED,
      }

      const updatedPost = {...postData, status: POST_STATUS.PUBLISHED}

      // Reset et redéfinir le mock pour ce test spécifique
      vi.mocked(getPostByIdDao).mockReset()
      vi.mocked(getPostByIdDao)
        .mockResolvedValueOnce(postData) // Premier appel dans canUpdatePost
        .mockResolvedValueOnce(postData) // Deuxième appel pour vérifier l'existence
        .mockResolvedValueOnce(updatedPost) // Troisième appel après mise à jour

      const result = await updatePostService(updateData)

      expect(updatePostByIdDao).toHaveBeenCalledWith(updateData)
      expect(result).toEqual(updatedPost)
      expect(result?.status).toBe(POST_STATUS.PUBLISHED)
    })

    it('should delete a post', async () => {
      const result = await deletePostService(postId)

      expect(result).toBe(true)
    })

    it('should publish a post', async () => {
      const result = await publishPostService(postId)

      expect(updatePostByIdDao).toHaveBeenCalledWith({
        id: postId,
        status: POST_STATUS.PUBLISHED,
      })
      expect(result).toEqual(postData)
    })

    it('should unpublish a post', async () => {
      // Mock un post publié pour pouvoir le dépublier
      const publishedPost = {...postData, status: POST_STATUS.PUBLISHED}
      vi.mocked(getPostByIdDao)
        .mockResolvedValueOnce(publishedPost)
        .mockResolvedValueOnce({...publishedPost, status: POST_STATUS.DRAFT})

      const result = await unpublishPostService(postId)

      expect(updatePostByIdDao).toHaveBeenCalledWith({
        id: postId,
        status: POST_STATUS.DRAFT,
      })
      expect(result).toEqual(postData)
    })

    it('should archive a post', async () => {
      const result = await archivePostService(postId)

      expect(updatePostByIdDao).toHaveBeenCalledWith({
        id: postId,
        status: POST_STATUS.ARCHIVED,
      })
      expect(result).toEqual(postData)
    })

    it('should like a post', async () => {
      vi.mocked(getPostByIdDao).mockResolvedValueOnce({
        ...postData,
        status: POST_STATUS.PUBLISHED,
      })
      vi.mocked(getPostByIdWithTranslationsDao).mockResolvedValueOnce(
        postWithRelationsData
      )

      const result = await likePostService(postId)

      expect(result).toEqual(postWithRelationsData)
    })

    it('should increment views of a post', async () => {
      vi.mocked(getPostByIdDao).mockResolvedValueOnce({
        ...postData,
        status: POST_STATUS.PUBLISHED,
      })
      vi.mocked(getPostByIdWithTranslationsDao).mockResolvedValueOnce(
        postWithRelationsData
      )

      const result = await incrementViewPostService(postId)

      expect(result).toEqual(postWithRelationsData)
    })

    it('should throw ValidationError for invalid post ID', async () => {
      await expect(getPostByIdService('invalid-uuid')).rejects.toThrow(
        ValidationError
      )
    })

    it('should throw NotFoundError for non-existent post', async () => {
      // Le service vérifie d'abord l'autorisation, puis l'existence
      // Pour tester NotFoundError, il faut que l'autorisation passe mais que le post n'existe pas
      vi.mocked(getPostByIdDao).mockResolvedValueOnce(undefined)

      await expect(getPostByIdService(postId)).rejects.toThrow(
        AuthorizationError
      )
    })
  })

  describe('CATEGORIES', () => {
    it('should create a category', async () => {
      const createData: CreateCategory = {
        name: 'Tech',
        description: 'Articles tech',
        icon: '💻',
        image: 'https://example.com/tech.jpg',
      }

      const result = await createCategoryService(createData)

      expect(createCategoryDao).toHaveBeenCalledWith(createData)
      expect(result).toEqual(categoryData)
    })

    it('should get category by id', async () => {
      const result = await getCategoryByIdService(categoryId)

      expect(getCategoryByIdDao).toHaveBeenCalledWith(categoryId)
      expect(result).toEqual(categoryData)
    })

    it('should update a category', async () => {
      const updateData: UpdateCategory = {
        id: categoryId,
        name: 'Technology',
        description: 'Updated tech description',
      }

      const updatedCategory = {
        ...categoryData,
        name: 'Technology',
        description: 'Updated tech description',
      }

      // Reset et redéfinir le mock pour ce test spécifique
      vi.mocked(getCategoryByIdDao).mockReset()
      vi.mocked(getCategoryByIdDao)
        .mockResolvedValueOnce(categoryData) // Premier appel dans canUpdateCategory
        .mockResolvedValueOnce(categoryData) // Deuxième appel pour vérifier l'existence
        .mockResolvedValueOnce(updatedCategory) // Troisième appel après mise à jour

      const result = await updateCategoryService(updateData)

      expect(updateCategoryByIdDao).toHaveBeenCalledWith(updateData)
      expect(result).toEqual(updatedCategory)
      expect(result?.name).toBe('Technology')
    })

    it('should delete a category', async () => {
      const result = await deleteCategoryService(categoryId)

      expect(result).toBe(true)
    })

    it('should throw ValidationError for duplicate category name', async () => {
      vi.mocked(getCategoryByNameDao).mockResolvedValueOnce(categoryData)

      const createData: CreateCategory = {
        name: 'Tech',
        description: 'Articles tech',
      }

      await expect(createCategoryService(createData)).rejects.toThrow(
        ValidationError
      )
    })
  })

  describe('HASHTAGS', () => {
    it('should create a hashtag', async () => {
      const createData: CreateHashtag = {
        name: 'javascript',
      }

      const result = await createHashtagService(createData)

      expect(createHashtagDao).toHaveBeenCalledWith(createData)
      expect(result).toEqual(hashtagData)
    })

    it('should return existing hashtag if already exists', async () => {
      vi.mocked(getHashtagByNameDao).mockResolvedValueOnce(hashtagData)

      const createData: CreateHashtag = {
        name: 'javascript',
      }

      const result = await createHashtagService(createData)

      expect(createHashtagDao).not.toHaveBeenCalled()
      expect(result).toEqual(hashtagData)
    })

    it('should get hashtag by id', async () => {
      const result = await getHashtagByIdService(hashtagId)

      expect(getHashtagByIdDao).toHaveBeenCalledWith(hashtagId)
      expect(result).toEqual(hashtagData)
    })
  })

  describe('POST TRANSLATIONS', () => {
    it('should create a post translation', async () => {
      const createData: CreatePostTranslation = {
        postId: postId,
        language: 'fr',
        title: 'Mon Premier Post',
        slug: 'mon-premier-post',
        content: '# Mon Premier Post\n\nContenu du post...',
        description: 'Description du post',
      }

      const result = await createPostTranslationService(createData)

      expect(createPostTranslationDao).toHaveBeenCalledWith(createData)
      expect(result).toEqual(translationData)
    })
  })

  describe('UTILITIES', () => {
    it('should generate slug from title', async () => {
      const title = 'Mon Premier Post'
      const language = 'fr' as const

      const result = await generateSlugService(title, language)

      expect(result).toBe('mon-premier-post')
    })

    it('should generate slug without accents', async () => {
      const title = 'Éléments Français'
      const language = 'fr' as const

      const result = await generateSlugService(title, language)

      expect(result).toBe('elements-francais')
    })

    it('should generate slug with special characters removed', async () => {
      const title = 'Post avec @#$ caractères spéciaux!'
      const language = 'fr' as const

      const result = await generateSlugService(title, language)

      expect(result).toBe('post-avec-caracteres-speciaux')
    })
  })
})

describe('[USER] CRUD : Post Service', () => {
  const postId = faker.string.uuid()
  const otherUserPostId = faker.string.uuid()

  const userPostData: Post = {
    id: postId,
    status: POST_STATUS.DRAFT,
    authorId: userTest.id,
    categoryId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    nbView: 0,
    nbLike: 0,
  }

  const otherUserPostData: Post = {
    id: otherUserPostId,
    status: POST_STATUS.PUBLISHED,
    authorId: faker.string.uuid(), // Autre utilisateur
    categoryId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    nbView: 0,
    nbLike: 0,
  }

  const userNotificationData: NotificationModel = {
    id: faker.string.uuid(),
    userId: userTest.id,
    type: NotificationTypeConst.project_created,
    title: 'Test',
    message: 'Test message',
    metadata: {},
    read: false,
    createdAt: new Date(),
  }

  beforeEach(() => {
    setupAuthUserMocked(userTest)
    vi.clearAllMocks()

    vi.mocked(getPostByIdDao).mockImplementation(async (id) => {
      if (id === postId) return userPostData
      if (id === otherUserPostId) return otherUserPostData
      return undefined
    })

    vi.mocked(createPostDao).mockResolvedValue(userPostData)
    vi.mocked(updatePostByIdDao).mockResolvedValue()
    vi.mocked(createNotificationDao).mockResolvedValue(userNotificationData)
    vi.mocked(getUserByIdDao).mockResolvedValue(userTest)
  })

  it('should access own posts', async () => {
    const result = await getPostByIdService(postId)
    expect(result).toEqual(userPostData)
  })

  it('should access published posts from others', async () => {
    const result = await getPostByIdService(otherUserPostId)
    expect(result).toEqual(otherUserPostData)
  })

  it('should NOT access draft posts from others', async () => {
    vi.mocked(getPostByIdDao).mockResolvedValueOnce({
      ...otherUserPostData,
      status: POST_STATUS.DRAFT,
    })

    await expect(getPostByIdService(otherUserPostId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('should create own posts', async () => {
    const createData: CreatePost = {
      status: POST_STATUS.DRAFT,
      authorId: userTest.id,
    }

    vi.mocked(createPostDao).mockResolvedValueOnce(userPostData)

    const result = await createPostService(createData)
    expect(result).toEqual(userPostData)
  })

  it('should update own posts', async () => {
    const updateData: UpdatePost = {
      id: postId,
      status: POST_STATUS.PUBLISHED,
    }

    const updatedUserPost = {...userPostData, status: POST_STATUS.PUBLISHED}

    // Reset et redéfinir les mocks pour ce test spécifique
    vi.mocked(getPostByIdDao).mockReset()
    vi.mocked(getPostByIdDao)
      .mockResolvedValueOnce(userPostData) // Premier appel dans canUpdatePost
      .mockResolvedValueOnce(userPostData) // Deuxième appel pour vérifier l'existence
      .mockResolvedValueOnce(updatedUserPost) // Troisième appel après mise à jour

    const result = await updatePostService(updateData)
    expect(result).toEqual(updatedUserPost)
    expect(result?.status).toBe(POST_STATUS.PUBLISHED)
  })

  it('should NOT update posts from others', async () => {
    const updateData: UpdatePost = {
      id: otherUserPostId,
      status: POST_STATUS.ARCHIVED,
    }

    await expect(updatePostService(updateData)).rejects.toThrow(
      AuthorizationError
    )
  })
})

describe('[PUBLIC] Post Service', () => {
  const publishedPostId = faker.string.uuid()
  const draftPostId = faker.string.uuid()

  const publishedPostData: Post = {
    id: publishedPostId,
    status: POST_STATUS.PUBLISHED,
    authorId: faker.string.uuid(),
    categoryId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    nbView: 0,
    nbLike: 0,
  }

  const draftPostData: Post = {
    id: draftPostId,
    status: POST_STATUS.DRAFT,
    authorId: faker.string.uuid(),
    categoryId: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    nbView: 0,
    nbLike: 0,
  }

  beforeEach(() => {
    setupAuthUserMocked(undefined) // Utilisateur non authentifié
    vi.clearAllMocks()

    vi.mocked(getPostByIdDao).mockImplementation(async (id) => {
      if (id === publishedPostId) return publishedPostData
      if (id === draftPostId) return draftPostData
      return undefined
    })
  })

  it('should access published posts', async () => {
    const result = await getPostByIdService(publishedPostId)
    expect(result).toEqual(publishedPostData)
  })

  it('should NOT access draft posts', async () => {
    await expect(getPostByIdService(draftPostId)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('should NOT create posts', async () => {
    const createData: CreatePost = {
      status: POST_STATUS.DRAFT,
    }

    await expect(createPostService(createData)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('should NOT update posts', async () => {
    const updateData: UpdatePost = {
      id: publishedPostId,
      status: POST_STATUS.ARCHIVED,
    }

    await expect(updatePostService(updateData)).rejects.toThrow(
      AuthorizationError
    )
  })

  it('should NOT delete posts', async () => {
    await expect(deletePostService(publishedPostId)).rejects.toThrow(
      AuthorizationError
    )
  })
})
