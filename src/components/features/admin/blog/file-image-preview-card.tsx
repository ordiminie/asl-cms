import {Copy, Download, FileIcon} from 'lucide-react'
import Image from 'next/image'
import {useTranslations} from 'next-intl'
import {toast} from 'sonner'

import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent} from '@/components/ui/card'
import {FileResponse} from '@/services/types/domain/file-types'

export default function FilePreviewCard({file}: {file: FileResponse}) {
  const t = useTranslations('AdminBlog')
  const isImage = file.type?.startsWith('image/')
  const fileSize =
    (file?.size ?? 0) > 0
      ? formatFileSize(file.size ?? 0)
      : t('dropzone.unknownSize')

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <div className="relative flex h-48 items-center justify-center bg-gray-100">
        {isImage && file.url ? (
          <Image
            src={file.url}
            alt={file.name}
            className="h-full w-full object-cover transition-transform duration-300 ease-in-out hover:scale-105"
            width={300}
            height={300}
          />
        ) : (
          <FileIcon className="h-24 w-24 text-gray-400" />
        )}
        <Badge className="absolute top-2 right-2 bg-black/50 hover:bg-black/70">
          {file.type || t('dropzone.unknownType')}
        </Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="mb-2 line-clamp-1 text-lg font-semibold">{file.name}</h3>
        <p className="mb-4 text-sm text-gray-600">Path: {file.path}</p>
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>{fileSize}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault()
                navigator.clipboard.writeText(file.url || '')
                toast.success(t('dropzone.linkCopied'))
              }}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
