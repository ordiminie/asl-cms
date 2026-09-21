import {PageBlockData} from '@/services/types/domain/page-block-types'

/** Un bloc tel que l'editeur le manipule avant enregistrement. */
export type EditorBlock = {
  /** Cle stable cote client, identique a l'`id` une fois le bloc enregistre. */
  key: string
  /** Identifiant en base, absent tant que le bloc n'a pas ete enregistre. */
  id?: string
  type: string
  /** Forme connue pour les cinq types ; donnee opaque pour un type inconnu. */
  data: unknown
}

export type BlockFormProps<T extends PageBlockData> = {
  data: T
  onChange: (data: T) => void
  onUpload: (
    file: File,
    kind: 'image' | 'document'
  ) => Promise<{key: string; fileName: string; fileSize: number} | undefined>
}

/** Adresse publique d'un fichier de bloc, servie par la route de l'application. */
export const pageBlockFileUrl = (key: string): string =>
  `/api/pages/files/${key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
