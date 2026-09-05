'use client'

import {Heart} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useOptimistic, useTransition} from 'react'
import {toast} from 'sonner'

import {
  incrementLikePostById,
  incrementViewPostById,
} from '@/app/[locale]/(public)/blog/[slug]/actions'
import {Button} from '@/components/ui/button'

interface LikeButtonProps {
  postId: string
  initialLikes: number
  className?: string
}

export function LikeButton({postId, initialLikes, className}: LikeButtonProps) {
  const t = useTranslations('BlogPostPage')
  const [isPending, startTransition] = useTransition()
  const [optimisticLikes, setOptimisticLikes] =
    useOptimistic<number>(initialLikes)

  // Incrémenter les vues au montage du composant
  useEffect(() => {
    incrementViewPostById(postId)
  }, [postId])

  const handleLikeClick = async () => {
    setOptimisticLikes((prev) => prev + 1)
    const result = await incrementLikePostById(postId)

    if (result.success) {
      toast.success(t('likeThanks'), {
        duration: 2000,
      })
    } else {
      toast.error(result.message, {
        duration: 3000,
      })
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => startTransition(handleLikeClick)}
      disabled={isPending}
      className={`text-muted-foreground flex items-center gap-2 transition-colors hover:text-red-500 ${className}`}
    >
      <Heart className="h-4 w-4" />
      <span>{optimisticLikes}</span>
    </Button>
  )
}
