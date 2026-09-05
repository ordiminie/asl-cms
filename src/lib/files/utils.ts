import {env} from '@/env'

export const emptyPaginationReturn = {
  data: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 0,
    totalPages: 0,
  },
}

export const getEnvBase = () => {
  return env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'prod' : 'dev'
}

export const fileServerEntityUsers = 'users'
export const fileServerEntityPosts = 'posts'

export const getFileServerPostPath = (postId: string, filename: string) => {
  return `${fileServerEntityPosts}/${postId}/${filename}`
}

export const getFileServerUserPath = (postId: string, filename: string) => {
  return `${fileServerEntityUsers}/${postId}/${filename}`
}

export const generateSlug = (text: string): string => {
  return text
    .toLowerCase() // Convertir tout en minuscule
    .trim() // Supprimer les espaces au début et à la fin
    .normalize('NFD') // Normaliser les caractères accentués
    .replaceAll(/[\u0300-\u036F]/g, '') // Supprimer les accents
    .replaceAll(/[^\d\sa-z-]/g, '') // Supprimer les caractères spéciaux
    .replaceAll(/\s+/g, '-') // Remplacer les espaces par des tirets
    .replaceAll(/-+/g, '-') // Remplacer les tirets multiples par un seul
}
