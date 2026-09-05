import 'server-only'

import {cache} from 'react'

import {listFilesByPostIdService} from '@/services/facades/file-service-facade'
import {FileListResponse} from '@/services/types/domain/file-types'

/**
 * Récupérer les fichiers d'un post avec cache
 */
export const getPostFilesDal = cache(
  async (postId: string): Promise<FileListResponse> => {
    try {
      return await listFilesByPostIdService(postId)
    } catch (error) {
      console.error('Erreur lors de la récupération des fichiers:', error)
      return []
    }
  }
)
