import {Skeleton} from '@/components/ui/skeleton'

/** Chargement de l'ecran 1 : le titre et les deux cartes, sans contenu. */
export default function AnnualImportLoading() {
  return (
    <div className="flex w-full max-w-[880px] flex-col gap-6 px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
