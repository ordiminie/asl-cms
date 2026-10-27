import {type ReactNode, useId} from 'react'

import {Card} from '@/components/ui/card'

/** Une carte de la fiche d'un proprietaire : une section titree (s12). */
export function DetailCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <Card className="gap-5 px-4 py-6 shadow-none sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id={titleId} className="font-serif text-2xl font-semibold">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </Card>
    </section>
  )
}
