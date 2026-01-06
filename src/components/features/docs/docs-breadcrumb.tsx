'use client'

import {usePathname} from 'next/navigation'
import React from 'react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

import type {DocItem, DocsStructure} from './docs-sidebar'

interface DocsBreadcrumbProps {
  structure: DocsStructure
}

// Helper function to find doc item by slug
function findItemBySlug(slug: string, items: DocItem[]): DocItem | undefined {
  for (const item of items) {
    if (item.slug === slug) return item
    if (item.children) {
      const found = findItemBySlug(slug, item.children)
      if (found) return found
    }
  }
  return undefined
}

// Generate breadcrumb from pathname and docs structure
function generateDocsBreadcrumb(pathname: string, structure: DocsStructure) {
  // Remove locale and docs prefix to get the clean slug
  const cleanPath = pathname
    .replace(/^\/[^/]*\/docs\//, '')
    .replace(/^\/docs\//, '')

  if (!cleanPath) {
    return []
  }

  const segments = cleanPath.split('/').filter(Boolean)
  const breadcrumbItems = []
  let currentSlug = ''

  for (let i = 0; i < segments.length; i++) {
    currentSlug += (currentSlug ? '/' : '') + segments[i]
    const docItem = findItemBySlug(currentSlug, structure.items)

    if (docItem) {
      const href = `/docs/${currentSlug}`
      const isLast = i === segments.length - 1

      breadcrumbItems.push({
        title: docItem.title,
        href,
        isLast,
      })
    }
  }

  return breadcrumbItems
}

export function DocsBreadcrumb({structure}: DocsBreadcrumbProps) {
  const pathname = usePathname()
  const breadcrumbItems = generateDocsBreadcrumb(pathname, structure)

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/docs">Documentation</BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems.map((item) => (
          <React.Fragment key={item.href}>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="min-w-0">
              {item.isLast ? (
                <BreadcrumbPage className="max-w-[200px] truncate sm:max-w-[300px] md:max-w-none">
                  {item.title}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={item.href}
                  className="block max-w-[150px] truncate sm:max-w-[200px] md:max-w-none"
                >
                  {item.title}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
