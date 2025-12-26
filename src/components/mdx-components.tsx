import Image from 'next/image'
import Link from 'next/link'
import type {ReactNode} from 'react'
import React from 'react'
import {Tweet as ReactTweet} from 'react-tweet'

type TweetEmbedProps = {
  url?: string
  id?: string
  native?: boolean
}

const extractTweetId = (url: string): string | null => {
  const patterns = [
    /x\.com\/\w+\/status\/(\d+)/,
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/i\/status\/(\d+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

const TweetEmbed = ({url, id, native = false}: TweetEmbedProps) => {
  const tweetId = id || (url ? extractTweetId(url) : null)

  if (!tweetId) {
    return (
      <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        Tweet invalide: impossible d&apos;extraire l&apos;ID du tweet
      </div>
    )
  }

  if (native) {
    return (
      <div className="my-4 flex justify-center">
        <blockquote className="twitter-tweet" data-theme="dark">
          <a href={`https://twitter.com/i/status/${tweetId}`}>
            Loading tweet...
          </a>
        </blockquote>
        <script async src="https://platform.twitter.com/widgets.js" />
      </div>
    )
  }

  return (
    <div className="my-4 flex justify-center [&>div]:!my-0">
      <ReactTweet id={tweetId} />
    </div>
  )
}

type VideoProps = {
  src: string
  title?: string
  width?: string | number
  height?: string | number
  className?: string
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  poster?: string
  preload?: 'auto' | 'metadata' | 'none'
  playsInline?: boolean
}

const Video = ({
  src,
  title,
  width = '100%',
  height = 'auto',
  ...props
}: VideoProps) => {
  // Détecter le type de vidéo (YouTube, Vimeo, etc.)
  if (src.includes('youtube.com') || src.includes('youtu.be')) {
    // Extraire l'ID de la vidéo YouTube
    const youtubeRegex =
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i
    const match = src.match(youtubeRegex)
    const youtubeId = match ? match[1] : null

    if (youtubeId) {
      return (
        <div className="my-4 aspect-video w-full">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title || 'YouTube video player'}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-lg"
          />
        </div>
      )
    }
  } else if (src.includes('vimeo.com')) {
    // Extraire l'ID Vimeo
    const vimeoRegex = /vimeo\.com\/(?:video\/)?([0-9]+)/i
    const match = src.match(vimeoRegex)
    const vimeoId = match ? match[1] : null

    if (vimeoId) {
      return (
        <div className="my-4 aspect-video w-full">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="rounded-lg"
          />
        </div>
      )
    }
  }

  // Vidéo MP4 par défaut
  return (
    <div className="my-4">
      <video
        controls
        width={width}
        height={height}
        src={src}
        title={title}
        className="rounded-lg"
        {...props}
      >
        Votre navigateur ne prend pas en charge la lecture de vidéos.
      </video>
    </div>
  )
}

export const Excalidraw = ({
  src,
  alt,
  data,
  height = 400,
  defaultMode = false,
  showExternalLink = true,
}: {
  src?: string
  alt?: string
  data?: string
  height?: number
  defaultMode?: boolean
  showExternalLink?: boolean
}) => {
  // Si src commence par "https://link.excalidraw.com" ou contient "excalidraw.com", c'est un lien embed externe
  const isExcalidrawLink =
    src &&
    (src.startsWith('https://link.excalidraw.com') ||
      src.includes('excalidraw.com'))

  // Vérification si src est une URL d'image
  const isImage =
    src &&
    !isExcalidrawLink &&
    (src.endsWith('.png') ||
      src.endsWith('.jpg') ||
      src.endsWith('.jpeg') ||
      src.endsWith('.svg'))

  // Si c'est un lien embed Excalidraw, on l'affiche directement
  if (isExcalidrawLink) {
    return (
      <div className="my-4 flex flex-col items-center">
        <iframe
          src={src}
          width="100%"
          height={height}
          style={{
            border: '1px solid #ccc',
            borderRadius: '4px',
            maxWidth: '100%',
          }}
          allowFullScreen
          frameBorder="0"
          title={alt || 'Diagramme Excalidraw'}
        />
        <div className="mt-1 text-sm text-gray-500">
          {alt || 'Diagramme Excalidraw'}
          {showExternalLink && (
            <>
              {' '}
              -{' '}
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Voir en plein écran
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  // Utilisation des données par défaut si le mode defaultMode est activé
  const defaultExcalidrawData = JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [
      {
        id: 'rectangle1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: '#4c6ef5',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        strokeSharpness: 'sharp',
        seed: 123456,
      },
      {
        id: 'text1',
        type: 'text',
        x: 150,
        y: 140,
        width: 100,
        height: 20,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'hachure',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        strokeSharpness: 'sharp',
        seed: 789012,
        text: 'Exemple',
        fontSize: 16,
        fontFamily: 1,
        textAlign: 'center',
        verticalAlign: 'middle',
      },
    ],
    appState: {
      gridSize: null,
      viewBackgroundColor: '#ffffff',
    },
  })

  const jsonData = defaultMode ? defaultExcalidrawData : data

  // Détermination de l'URL pour ouvrir dans Excalidraw
  let excalidrawUrl = 'https://excalidraw.com'

  if (jsonData) {
    // Encodage des données JSON pour l'URL
    const encodedData = encodeURIComponent(jsonData)
    excalidrawUrl = `https://excalidraw.com/#json=${encodedData}&mode=viewer`
  } else if (src && !isImage) {
    // Si src est un fichier .excalidraw, ajouter un lien pour l'ouvrir
    excalidrawUrl = `https://excalidraw.com/#json=${encodeURIComponent(
      JSON.stringify({source: src})
    )}&mode=viewer`
  }

  return (
    <div className="my-4 flex flex-col items-center justify-center">
      {isImage ? (
        // Affichage d'une image statique
        <div
          style={{height: `${height}px`, maxWidth: '100%'}}
          className="mb-2 overflow-hidden"
        >
          <Image
            src={src}
            alt={alt || 'Diagramme Excalidraw'}
            width={800}
            height={height}
            className="mx-auto h-full w-auto max-w-full object-contain"
          />
        </div>
      ) : (
        // Affichage d'un bouton pour ouvrir dans Excalidraw
        <div
          style={{height: `${height}px`}}
          className="mb-2 flex w-full items-center justify-center rounded-md border bg-gray-50"
        >
          <div className="text-center">
            <p className="mb-4 text-lg font-medium">
              {alt || 'Diagramme Excalidraw'}
            </p>
            <a
              href={excalidrawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            >
              Ouvrir dans Excalidraw
            </a>
          </div>
        </div>
      )}
      {(isImage || jsonData) && (
        <div className="text-sm text-gray-500">
          {alt || 'Diagramme Excalidraw'}
        </div>
      )}
    </div>
  )
}
export const mdxComponents = {
  h1: ({children}: {children: ReactNode}) => (
    <h1 className="mb-6 border-b border-gray-200 pb-2 text-4xl font-bold text-gray-900 dark:border-gray-700 dark:text-gray-100">
      {children}
    </h1>
  ),
  h2: ({children}: {children: ReactNode}) => (
    <h2 className="mt-8 mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-200">
      {children}
    </h2>
  ),
  h3: ({children}: {children: ReactNode}) => (
    <h3 className="mt-6 mb-3 text-2xl font-medium text-gray-700 dark:text-gray-300">
      {children}
    </h3>
  ),
  h4: ({children}: {children: ReactNode}) => (
    <h4 className="mt-4 mb-2 text-xl font-medium text-gray-700 dark:text-gray-300">
      {children}
    </h4>
  ),
  p: ({children}: {children: ReactNode}) => (
    <p className="mb-4 text-base leading-7 text-gray-600 dark:text-gray-400">
      {children}
    </p>
  ),
  ul: ({children}: {children: ReactNode}) => (
    <ul className="mb-4 list-inside list-disc space-y-2 text-gray-600 dark:text-gray-400">
      {children}
    </ul>
  ),
  ol: ({children}: {children: ReactNode}) => (
    <ol className="mb-4 list-inside list-decimal space-y-2 text-gray-600 dark:text-gray-400">
      {children}
    </ol>
  ),
  li: ({children}: {children: ReactNode}) => (
    <li className="text-gray-600 dark:text-gray-400">{children}</li>
  ),
  blockquote: ({children}: {children: ReactNode}) => (
    <blockquote className="mb-4 rounded-r-lg border-l-4 border-blue-500 bg-gray-50 py-2 pl-4 text-gray-700 italic dark:bg-gray-800 dark:text-gray-300">
      {children}
    </blockquote>
  ),
  // code: ({children, className}: {children: ReactNode; className?: string}) => {
  //   // Si c'est un bloc de code (avec className), laisser Shiki s'en occuper
  //   if (className) {
  //     return <code className={className}>{children}</code>
  //   }
  //   // Sinon, c'est du code inline
  //   return (
  //     <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-200">
  //       {children}
  //     </code>
  //   )
  // },
  // pre: ({children, className}: {children: ReactNode; className?: string}) => (
  //   <pre
  //     className={`mb-4 overflow-x-auto rounded-lg ${className || 'bg-gray-900 p-4 text-sm text-gray-100'}`}
  //   >
  //     {children}
  //   </pre>
  // ),
  table: ({children}: {children: ReactNode}) => (
    <div className="mb-4 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({children}: {children: ReactNode}) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  tbody: ({children}: {children: ReactNode}) => (
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {children}
    </tbody>
  ),
  tr: ({children}: {children: ReactNode}) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">{children}</tr>
  ),
  th: ({children}: {children: ReactNode}) => (
    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900 dark:border-gray-600 dark:text-gray-100">
      {children}
    </th>
  ),
  td: ({children}: {children: ReactNode}) => (
    <td className="border border-gray-300 px-4 py-2 text-gray-600 dark:border-gray-600 dark:text-gray-400">
      {children}
    </td>
  ),
  a: ({href, children}: {href?: string; children: ReactNode}) => {
    if (href && href.startsWith('/')) {
      return (
        <Link
          href={href}
          className="text-blue-600 underline transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {children}
        </Link>
      )
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {children}
      </a>
    )
  },
  hr: () => <hr className="my-8 border-gray-200 dark:border-gray-700" />,
  img: (props: React.ComponentProps<typeof Image>) => {
    const imageUrl = props.src as string
    const isGif = imageUrl.includes('.gif')

    // Support des paramètres d'URL: image.jpg?width=300&height=200
    const queryParams = new URLSearchParams(imageUrl.split('?')[1] || '')
    const widthFromUrl = queryParams.get('width')
    const heightFromUrl = queryParams.get('height')

    // Support des attributs HTML: <img width="300" height="200" />
    const widthFromProps = props.width
    const heightFromProps = props.height

    // Priorité: attributs HTML > paramètres URL > valeurs par défaut
    const width = widthFromProps
      ? Number(widthFromProps)
      : widthFromUrl
        ? Number(widthFromUrl)
        : 800
    const height = heightFromProps
      ? Number(heightFromProps)
      : heightFromUrl
        ? Number(heightFromUrl)
        : 600

    return (
      <Image
        width={width}
        height={height}
        //@ts-expect-error next-image always have alt, only compliance with jsx-a11y/alt-text rules
        alt="default alt image"
        {...props}
        unoptimized={isGif}
        className="h-auto max-w-full rounded-lg"
      />
    )
  },
  // Ajouter le composant Video aux composants MDX
  Video,
  // Ajouter le composant Excalidraw aux composants MDX
  Excalidraw,
  // Ajouter le composant Tweet pour intégrer des tweets X/Twitter
  Tweet: TweetEmbed,
}
