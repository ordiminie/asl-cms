import {Skeleton} from '@/components/ui/skeleton'

/** Chargement de l'ecran 1 : le titre et les trois cartes, sans contenu. */
export default function Loading() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
