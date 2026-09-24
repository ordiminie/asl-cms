---
description:
---

# Système d'Upload de Fichiers et Images

Guide complet pour l'upload de fichiers et d'images dans l'architecture Next.js 16 / React 19.

## Architecture d'Upload

### Flux de données pour l'upload

**Client Components** → **Server Actions** → **Service Facades** → **Services** → **Repository**

### Un seul stockage : le disque du serveur (ADR 004, ADR 015)

L'adaptateur `local` (`src/lib/files/storage/local-storage.ts`, racine `LOCAL_STORAGE_ROOT` dans
`@/env`) est **le seul stockage du produit** : `createStorage` n'accepte plus que `'local'`, et
`STORAGE_TYPE` absente vaut `local` (s12a). Aucun module de `src/` n'importe de SDK de fournisseur —
un test de garde le vérifie (`src/lib/files/storage/provider-imports.test.ts`).

Deux chaînes l'utilisent :

- **Identité d'association** (s01b) : `replaceAssociationIdentityFileService`, lu par
  `GET /api/identity/{logo|favicon}`. Elle construit son adaptateur elle-même, sans passer par
  `getStorageConfig()`. Règles qui s'y appliquent : format jugé sur la **signature binaire**, jamais
  sur l'extension ni le type déclaré ; clé **générée par le serveur**, préfixée par l'organisation,
  sans nom fourni par l'utilisateur ; fichier servi par une route de l'application avec
  `X-Content-Type-Options: nosniff`, jamais depuis `public/`.
- **Fichiers de contenu** (s04, s05, s06 — ADR 023) : blocs de page, image d'actualité et photo de
  fiche du bureau passent par
  **une seule** chaîne partagée. `src/services/types/domain/content-file-types.ts` déclare les
  **portées** (`pages`, `news`, `board` ; s09 y ajoutera la sienne) et construit la clé
  `{organizationId}/{portée}/{ownerId}/{slotId}-{uuid}.{ext}` ; `readContentFileService` la sert par
  `GET /api/files/[...key]`, `/api/pages/files/[...key]` étant servie par **le même** gestionnaire
  mais **bornée à la portée `pages`** (chemin historique, à ne pas étendre : une clé d'actualité y
  est refusée, un nouveau client passe par `/api/files`). Un nouveau modèle déclare sa portée et sa colonne `…_key` —
  il n'écrit ni validation de clé, ni route de lecture. Même discipline que l'identité : format jugé
  sur la **signature binaire**, clé générée par le serveur, `nosniff`, jamais de fichier servi depuis
  `public/`.
  **Une image est redimensionnée à l'écriture** (ADR 024, s06) : `resizeToSquareWebp`
  (`src/lib/files/resize-image.ts`) prend des octets et rend des octets, **après** la validation par
  signature binaire et **avant** l'écriture — un fichier refusé n'est jamais décodé. L'original
  n'est pas conservé : le fichier stocké est le fichier servi, et la clé porte le format `webp`.
  Une photo de personne sort en carré de 512 px (`PORTRAIT_STORED_SIZE`), recadrée au centre, sans
  métadonnée EXIF. Les images de blocs de s04 ne sont pas reprises.
- **Fichiers d'article du blog d'administration** (hérité du boilerplate) : la chaîne générique
  `file-service` → `files-repository` → adaptateur `local`, décrite par le reste de ce guide. Un
  fichier stocké n'a **pas d'URL publique** : il est servi par une route de l'application, et
  `FileResponse.url` porte la clé de stockage.

### Technologies utilisées

- **Disque du serveur** pour le stockage des fichiers
- **React Dropzone** pour l'interface de glisser-déposer
- **Framer Motion** pour les animations
- **FileUpload Component** personnalisé avec ShadCN UI

## Composant FileUpload

**Référence : [file-upload.tsx](src/components/ui/file-upload.tsx)**

### Utilisation basique

```tsx
import {FileUpload} from '@/components/ui/file-upload'

// Upload d'image unique
<FileUpload
  onChange={handleFileUpload}
  onlyimage={true}
  multi={false}
  isUploading={isUploading}
/>

// Upload de fichiers multiples
<FileUpload
  onChange={handleFileUpload}
  multi={true}
  isUploading={isUploading}
/>
```

### Props du composant FileUpload

- `onChange: (files: File[]) => void` - Callback appelé lors de la sélection de fichiers
- `multi?: boolean` - Permet la sélection multiple (défaut: false)
- `onlyimage?: boolean` - Restreint aux images uniquement (défaut: false)
- `isUploading?: boolean` - État de chargement pour désactiver l'interface

### Types d'images supportés

**Référence : [file-types.ts](src/services/types/domain/file-types.ts)**

```tsx
// Types MIME autorisés pour les images
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/png',
] as const
```

## Pattern d'Implémentation Frontend

**Référence : [association-identity-card.tsx](src/components/features/association/association-identity-card.tsx)**

### Template standard pour un formulaire avec upload

```tsx
'use client'

import {useState} from 'react'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {FileUpload} from '@/components/ui/file-upload'

export function FormWithUpload({entity}: {entity: EntityType}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [entityImage, setEntityImage] = useState(entity.image ?? '')

  const form = useForm({
    defaultValues: {
      id: entity.id,
      image: entity.image ?? '',
      // autres champs...
    },
  })

  async function handleFileUpload(files: File[]) {
    if (files.length === 0) return

    const file = files[0]
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entityId', entity.id) // ID de l'entité associée

      const result = await uploadEntityImageAction(undefined, formData)

      if (result.success && result.imageUrl) {
        // Mettre à jour le formulaire avec l'URL de l'image
        form.setValue('image', result.imageUrl)
        setEntityImage(result.imageUrl)

        toast('Succès', {
          description: result.message,
        })
      } else {
        toast('Erreur', {
          description: result.message || "Erreur lors de l'upload",
        })
      }
    } catch (error) {
      console.error("Erreur lors de l'upload:", error)
      toast('Erreur', {
        description: "Impossible d'uploader l'image. Veuillez réessayer.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Form {...form}>
      <div className="space-y-2">
        <FileUpload
          onChange={handleFileUpload}
          onlyimage={true}
          multi={false}
          isUploading={isUploading}
        />
        {isUploading && (
          <p className="text-muted-foreground text-sm">Upload en cours...</p>
        )}
      </div>
      {/* Autres champs du formulaire */}
    </Form>
  )
}
```

## Server Actions d'Upload

**Référence : [actions.ts](<src/app/[locale]/(bureau)/bureau/identite/actions.ts>)**

### Template standard d'une Server Action d'upload

```tsx
'use server'

import {getAuthUser} from '@/services/authentication/auth-service'
import {uploadImageForEntityService} from '@/services/facades/file-service-facade'
import {
  EntityTypeConst,
  FileCategoryConst,
} from '@/services/types/domain/file-types'

export type UploadImageState = {
  success: boolean
  message?: string
  imageUrl?: string
}

export async function uploadEntityImageAction(
  prevState?: UploadImageState,
  formData?: FormData
): Promise<UploadImageState> {
  // 1. VÉRIFICATION AUTHENTIFICATION
  const user = await getAuthUser()
  if (!user) {
    return {success: false, message: 'Utilisateur non trouvé'}
  }

  // 2. VALIDATION FORMDATA
  if (!formData) {
    return {success: false, message: 'Données invalides'}
  }

  const file = formData.get('file') as File
  const entityId = formData.get('entityId') as string

  // 3. VALIDATION FICHIER
  if (!file || file.size === 0) {
    return {success: false, message: 'Aucun fichier fourni'}
  }

  if (!entityId) {
    return {success: false, message: "ID d'entité manquant"}
  }

  try {
    // 4. UPLOAD VIA SERVICE FACADE
    const result = await uploadImageForEntityService({
      file,
      entityType: EntityTypeConst.ORGANIZATION, // ou USER, PRODUCT, etc.
      entityId,
      category: FileCategoryConst.LOGO, // ou PROFILE, IMAGE, etc.
    })

    return {
      success: true,
      message: 'Image uploadée avec succès',
      imageUrl: result.url,
    }
  } catch (error) {
    console.error("Erreur lors de l'upload:", error)
    return {
      success: false,
      message: "Impossible d'uploader l'image. Veuillez réessayer.",
    }
  }
}
```

## Services d'Upload

**Référence : [file-service.ts](src/services/file-service.ts)**

### Service spécialisé pour les images

```tsx
/**
 * Upload une image avec génération automatique du chemin pour une entité
 *
 * Spécialisé pour les images uniquement avec validation stricte des types MIME
 * Types autorisés : WebP, JPEG, JPG, PNG
 *
 * Exemples de chemins générés :
 * - User profile: "users/123/profile-1703123456789.webp"
 * - Organization logo: "organizations/456/logo-1703123456789.png"
 */
export const uploadImageForEntityService = async (
  params: UploadFileForEntity
): Promise<FileResponse>
```

### Service générique pour tous types de fichiers

```tsx
/**
 * Upload un fichier avec génération automatique du chemin pour une entité
 *
 * Génère automatiquement un chemin de la forme :
 * `{entityType}s/{entityId}/{category}-{timestamp}.{extension}`
 */
export const uploadFileForEntityService = async (
  params: UploadFileForEntity
): Promise<FileResponse>
```

## Types et Constantes

### Types principaux

```tsx
// Types d'entités supportées
export enum EntityTypeConst {
  USER = 'user',
  ORGANIZATION = 'organization',
  PRODUCT = 'product',
}

// Catégories de fichiers
export enum FileCategoryConst {
  PROFILE = 'profile',
  LOGO = 'logo',
  IMAGE = 'image',
  DOCUMENT = 'document',
}

// Paramètres d'upload
export type UploadFileForEntity = {
  file: File
  entityType: EntityType
  entityId: string
  category?: FileCategory
}

// Réponse d'upload
export type FileResponse = {
  path: string
  url: string
  size: number
  type: string
  name: string
}
```

## Configuration du stockage sur disque

### Variables d'environnement

```env
# Racine du stockage, hors de public/, accessible en ecriture
LOCAL_STORAGE_ROOT=/var/lib/asl-cms/files
# Facultative : `local` est la seule valeur acceptee, et le defaut
STORAGE_TYPE=local
NEXT_PUBLIC_MAX_FILE_SIZE=5242880
NEXT_PUBLIC_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

### Génération automatique des chemins

```tsx
// Exemple de chemin généré automatiquement
const generateFilePath = (
  entityType: EntityType,
  entityId: string,
  file: File,
  category: FileCategory = 'image'
): string => {
  const timestamp = Date.now()
  const fileExtension = file.name.split('.').pop()
  return `${entityType}s/${entityId}/${category}-${timestamp}.${fileExtension}`
}

// Résultat : "organizations/123/logo-1703123456789.png"
```

## Exemples d'Utilisation

### Upload d'un fichier d'article

**Référence : [file-dropzone.tsx](src/components/features/admin/blog/file-dropzone.tsx)**

```tsx
// Écrira sous : "<LOCAL_STORAGE_ROOT>/<basePath>/posts/post-id/image/timestamp-nom.png"
const result = await uploadFilePostService(postId, file)
```

## Gestion des Erreurs

### Validation côté client

```tsx
// Le composant FileUpload valide automatiquement :
// - Types MIME autorisés
// - Taille maximum configurée
// - Formats d'images supportés

const isValidFile = (file: File): boolean => {
  if (onlyimage) {
    return ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any)
  }
  return true
}
```

### Validation côté serveur

```tsx
// Validation dans les services
if (file.size > config.maxFileSize) {
  throw FileErrors.FILE_TOO_LARGE(file.size, config.maxFileSize)
}

if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
  throw new Error(`Type d'image non supporté: ${file.type}`)
}
```

## États de Chargement

### Interface utilisateur réactive

```tsx
// État pendant l'upload
const [isUploading, setIsUploading] = useState(false)

// Feedback visuel
{
  isUploading && (
    <p className="text-muted-foreground text-sm">Upload en cours...</p>
  )
}

// Désactivation des interactions
;<FileUpload isUploading={isUploading} />
```

## Bonnes Pratiques

### 1. Sécurité

- ✅ Toujours vérifier l'authentification dans les Server Actions
- ✅ Valider les types de fichiers côté client ET serveur
- ✅ Limiter la taille des fichiers
- ✅ Utiliser des chemins prédictibles et sécurisés

### 2. UX/UI

- ✅ Feedback visuel pendant l'upload (états de chargement)
- ✅ Messages d'erreur explicites en français
- ✅ Drag & drop intuitif avec animations
- ✅ Prévisualisation des images après upload

### 3. Architecture

- ✅ Respecter le flux des couches (Client → Server Action → Facade → Service)
- ✅ Utiliser les types TypeScript stricts
- ✅ Centraliser la logique d'upload dans les services
- ✅ Génération automatique des chemins de fichiers

### 4. Performance

- ✅ Upload en arrière-plan sans bloquer l'interface
- ✅ Validation immédiate côté client
- ✅ Optimisation des images (WebP préféré)
- ✅ Servir les fichiers par une route de l'application

## Checklist d'Implémentation

- [ ] **FileUpload Component** configuré avec les bonnes props
- [ ] **Server Action** avec validation auth + fichier
- [ ] **Service d'upload** via les façades
- [ ] **Types appropriés** (EntityType, FileCategory)
- [ ] **Gestion d'erreurs** côté client et serveur
- [ ] **États de chargement** avec feedback visuel
- [ ] **Validation MIME types** pour les images
- [ ] **Toast notifications** pour le succès/erreur
- [ ] **Mise à jour du formulaire** avec l'URL résultante

Cette architecture garantit un système d'upload robuste, sécurisé et performant avec une excellente expérience utilisateur.
