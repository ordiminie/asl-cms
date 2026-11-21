import type {ReactNode} from 'react'

/** Le titre d'une carte de la fiche campagne, partage par ses cartes. */
export function CardHeading({children}: {children: ReactNode}) {
  return (
    <h2 className="font-serif text-[24px] leading-snug font-semibold">
      {children}
    </h2>
  )
}
