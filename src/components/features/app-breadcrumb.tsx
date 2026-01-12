'use client'

import {usePathname} from 'next/navigation'
import React from 'react'

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {capitalize} from '@/lib/utils'

function truncateSegment(segment: string, maxLength: number = 16): string {
  if (segment.length <= maxLength) return segment
  return `${segment.slice(0, maxLength)}…`
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const visibleSegments = segments.filter((_, index) => index !== 0)
  const hasMiddleSegments = visibleSegments.length > 2

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Accueil</BreadcrumbLink>
        </BreadcrumbItem>

        {visibleSegments.map((segment, index) => {
          const originalIndex = index + 1
          const href = `/${segments.slice(0, originalIndex + 1).join('/')}`
          const isLast = index === visibleSegments.length - 1
          const isFirst = index === 0
          const isMiddle = !isFirst && !isLast

          const displayText = truncateSegment(capitalize(segment))

          if (isMiddle && hasMiddleSegments) {
            return (
              <React.Fragment key={href}>
                <BreadcrumbSeparator className="hidden first:hidden md:block" />
                <BreadcrumbItem className="hidden md:inline-flex">
                  <BreadcrumbLink href={href}>{displayText}</BreadcrumbLink>
                </BreadcrumbItem>
              </React.Fragment>
            )
          }

          if (isFirst && hasMiddleSegments) {
            return (
              <React.Fragment key={href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={href}>{displayText}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="md:hidden" />
                <BreadcrumbItem className="md:hidden">
                  <BreadcrumbEllipsis className="size-4" />
                </BreadcrumbItem>
              </React.Fragment>
            )
          }

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayText}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{displayText}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
