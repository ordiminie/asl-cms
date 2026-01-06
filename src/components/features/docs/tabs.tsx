'use client'

import React, {useState} from 'react'

import {cn} from '@/lib/utils'

interface TabsProps {
  children: React.ReactNode
  defaultValue?: string
  className?: string
}

interface TabProps {
  children: React.ReactNode
  value?: string
  label?: string
  className?: string
}

export function Tabs({children, defaultValue, className}: TabsProps) {
  // Essayons une approche plus directe
  const allChildren = React.Children.toArray(children)
  const tabElements = allChildren.filter(
    (child): child is React.ReactElement<TabProps> =>
      React.isValidElement(child)
  )

  const [activeTab, setActiveTab] = useState(
    defaultValue || tabElements[0]?.props.value || ''
  )

  return (
    <div
      className={cn(
        'border-border bg-card my-6 overflow-hidden rounded-lg border',
        className
      )}
    >
      {/* Tab Headers */}
      <div className="border-border bg-muted/30 flex border-b">
        {tabElements.map((tab) => (
          <button
            key={tab.props.value}
            onClick={() => setActiveTab(tab.props.value || '')}
            className={cn(
              'relative px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.props.value
                ? 'text-foreground bg-background border-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab.props.label || tab.props.value}
            {activeTab === tab.props.value && (
              <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-background [&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0">
        {tabElements.map((tab) => (
          <div
            key={tab.props.value}
            className={cn(
              'transition-all duration-200',
              activeTab === tab.props.value ? 'block' : 'hidden'
            )}
          >
            {tab.props.children}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Tab({children, className}: TabProps) {
  return <div className={className}>{children}</div>
}
