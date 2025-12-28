import fs from 'fs'
import matter from 'gray-matter'
import path from 'path'

export interface DocItem {
  title: string
  slug: string
  href: string
  type: 'file' | 'directory'
  order: number
  description?: string
  children?: DocItem[]
}

export interface DocsStructure {
  items: DocItem[]
}

function extractOrderAndName(filename: string): {order: number; name: string} {
  const match = filename.match(/^(\d+)-(.+)/)
  if (match) {
    return {
      order: parseInt(match[1], 10),
      name: match[2],
    }
  }
  return {
    order: 999,
    name: filename,
  }
}

function formatTitle(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildSlug(pathParts: string[]): string {
  return pathParts.map((part) => extractOrderAndName(part).name).join('/')
}

function scanDirectory(
  dirPath: string,
  basePath: string = '',
  locale: string = 'en'
): DocItem[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const items: DocItem[] = []
  const entries = fs.readdirSync(dirPath, {withFileTypes: true})

  // Créer une liste des noms de dossiers pour éviter les doublons
  const folderNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => extractOrderAndName(entry.name).name)

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(dirPath, entry.name)
    const {order, name} = extractOrderAndName(entry.name)
    const title = formatTitle(name)

    if (entry.isDirectory()) {
      const children = scanDirectory(
        fullPath,
        basePath ? `${basePath}/${name}` : name,
        locale
      )

      // Vérifier s'il y a un fichier index.mdx dans le dossier
      const indexMdxFile = path.join(fullPath, 'index.mdx')
      let folderTitle = title
      let folderDescription: string | undefined
      let folderOrder = order

      if (fs.existsSync(indexMdxFile)) {
        try {
          const fileContent = fs.readFileSync(indexMdxFile, 'utf-8')
          const {data} = matter(fileContent)

          if (data.title) {
            folderTitle = data.title
          }
          if (data.description) {
            folderDescription = data.description
          }
          if (data.order && typeof data.order === 'number') {
            folderOrder = data.order
          }
        } catch (error) {
          console.warn(
            `Error reading folder frontmatter from ${indexMdxFile}:`,
            error
          )
        }
      }

      items.push({
        title: folderTitle,
        slug: buildSlug(basePath ? [basePath, name] : [name]),
        href: `/docs/${buildSlug(basePath ? [basePath, name] : [name])}`,
        type: 'directory',
        order: folderOrder,
        description: folderDescription,
        children: children.length > 0 ? children : undefined,
      })
    } else if (entry.name.endsWith('.mdx')) {
      const fileNameWithoutExt = entry.name.replace('.mdx', '')
      const {order: fileOrder, name: fileName} =
        extractOrderAndName(fileNameWithoutExt)

      // Ignorer les fichiers index.mdx car ils sont gérés par les dossiers
      if (fileName === 'index') {
        continue
      }

      // Ignorer les fichiers MDX qui correspondent à des noms de dossiers
      // car ils sont déjà gérés par les dossiers eux-mêmes
      if (folderNames.includes(fileName)) {
        continue
      }

      // Read MDX file to get frontmatter
      let fileTitle = formatTitle(fileName)
      let description: string | undefined
      let frontmatterOrder = fileOrder

      try {
        const fileContent = fs.readFileSync(fullPath, 'utf-8')
        const {data} = matter(fileContent)

        if (data.title) {
          fileTitle = data.title
        }
        if (data.description) {
          description = data.description
        }
        if (data.order && typeof data.order === 'number') {
          frontmatterOrder = data.order
        }
      } catch (error) {
        console.warn(`Error reading frontmatter from ${fullPath}:`, error)
      }

      items.push({
        title: fileTitle,
        slug: buildSlug(basePath ? [basePath, fileName] : [fileName]),
        href: `/docs/${buildSlug(basePath ? [basePath, fileName] : [fileName])}`,
        type: 'file',
        order: frontmatterOrder,
        description,
      })
    }
  }

  return items.sort((a, b) => a.order - b.order)
}

export function getDocsStructure(locale: string = 'en'): DocsStructure {
  const docsPath = path.join(
    process.cwd(),
    'src',
    'app',
    '[locale]',
    'docs',
    '_files',
    locale
  )
  const items = scanDirectory(docsPath, '', locale)

  return {items}
}

export function findDocBySlug(
  slug: string,
  locale: string = 'en'
): DocItem | null {
  const structure = getDocsStructure(locale)

  function searchItems(items: DocItem[]): DocItem | null {
    for (const item of items) {
      if (item.slug === slug) {
        return item
      }
      if (item.children) {
        const found = searchItems(item.children)
        if (found) return found
      }
    }

    return null
  }

  return searchItems(structure.items)
}

export function getDocFilePath(
  slug: string,
  locale: string = 'en'
): string | null {
  const docsPath = path.join(
    process.cwd(),
    'src',
    'app',
    '[locale]',
    'docs',
    '_files',
    locale
  )

  function findActualPath(
    currentPath: string,
    remainingSlugParts: string[]
  ): string | null {
    if (remainingSlugParts.length === 0) {
      return currentPath
    }

    const [currentSlugPart, ...restSlugParts] = remainingSlugParts

    if (!fs.existsSync(currentPath)) {
      return null
    }

    const entries = fs.readdirSync(currentPath, {withFileTypes: true})

    // Chercher un dossier qui correspond au slug
    const matchingDir = entries.find((entry) => {
      if (entry.isDirectory()) {
        const {name} = extractOrderAndName(entry.name)
        return name === currentSlugPart
      }
      return false
    })

    if (matchingDir && restSlugParts.length > 0) {
      return findActualPath(
        path.join(currentPath, matchingDir.name),
        restSlugParts
      )
    }

    // Si c'est le dernier élément, chercher un fichier MDX
    if (restSlugParts.length === 0) {
      // 1. Chercher un fichier index.mdx dans le dossier correspondant
      if (matchingDir) {
        const indexFile = path.join(currentPath, matchingDir.name, 'index.mdx')
        if (fs.existsSync(indexFile)) {
          return indexFile
        }
      }

      // 2. Chercher un fichier MDX direct
      const matchingFile = entries.find((entry) => {
        if (entry.isFile() && entry.name.endsWith('.mdx')) {
          const {name} = extractOrderAndName(entry.name.replace('.mdx', ''))
          return name === currentSlugPart
        }
        return false
      })

      if (matchingFile) {
        return path.join(currentPath, matchingFile.name)
      }

      // 3. Chercher dans un dossier du même nom
      if (matchingDir) {
        const dirPath = path.join(currentPath, matchingDir.name)
        if (fs.existsSync(dirPath)) {
          const dirEntries = fs.readdirSync(dirPath, {withFileTypes: true})
          const fileInDir = dirEntries.find((entry) => {
            if (entry.isFile() && entry.name.endsWith('.mdx')) {
              const {name} = extractOrderAndName(entry.name.replace('.mdx', ''))
              return name === currentSlugPart
            }
            return false
          })

          if (fileInDir) {
            return path.join(dirPath, fileInDir.name)
          }
        }
      }
    }

    return null
  }

  const slugParts = slug.split('/')
  return findActualPath(docsPath, slugParts)
}
