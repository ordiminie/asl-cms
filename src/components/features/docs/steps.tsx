import React from 'react'

import {cn} from '@/lib/utils'

interface StepsProps {
  children: React.ReactNode
  className?: string
}

interface StepProps {
  children: React.ReactNode
  title: string
  className?: string
}

export function Steps({children, className}: StepsProps) {
  // Créer un array stable avec les numéros
  const childrenArray = React.Children.toArray(children)
  const stepsWithNumbers = childrenArray.map((child, index) => {
    if (React.isValidElement(child)) {
      return {
        child,
        stepNumber: index + 1,
        isStep: true,
      }
    }
    return {child, stepNumber: 0, isStep: false}
  })

  const totalSteps = stepsWithNumbers.filter((item) => item.isStep).length

  return (
    <div className={cn('my-6 space-y-0', className)}>
      {stepsWithNumbers.map((item, index) => {
        if (item.isStep && React.isValidElement(item.child)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const originalProps = (item.child as any).props
          return React.createElement(Step, {
            ...originalProps,
            stepNumber: item.stepNumber,
            isLast: item.stepNumber === totalSteps,
            key: index,
          })
        }
        return item.child
      })}
    </div>
  )
}

export function Step({
  children,
  title,
  className,
  stepNumber,
  isLast,
}: StepProps & {stepNumber?: number; isLast?: boolean}) {
  return (
    <div className={cn('relative pb-8', className)}>
      {/* Step number circle */}
      <div className="bg-foreground text-background absolute top-0 left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
        {stepNumber || 1}
      </div>

      {/* Vertical line connector */}
      {!isLast && (
        <div className="bg-border absolute top-8 bottom-0 left-4 w-0.5" />
      )}

      {/* Content area */}
      <div className="ml-12">
        {/* Title aligned with circle center */}
        <div className="relative" style={{top: '-4px'}}>
          <h3 className="text-foreground !m-0 !p-0 text-xl font-semibold">
            {title}
          </h3>
        </div>

        {/* Step content */}
        <div className="text-muted-foreground mt-4">{children}</div>
      </div>
    </div>
  )
}
