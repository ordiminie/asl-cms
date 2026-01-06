import {AlertTriangle, CheckCircle, Info, XCircle} from 'lucide-react'
import React from 'react'

import {cn} from '@/lib/utils'

interface CalloutProps {
  children: React.ReactNode
  type?: 'warning' | 'info' | 'success' | 'error'
  className?: string
}

const calloutConfig = {
  warning: {
    icon: AlertTriangle,
    className:
      'border border-orange-200/50 bg-gradient-to-r from-orange-50/50 to-orange-100/30 text-orange-800 dark:border-orange-800/30 dark:bg-gradient-to-r dark:from-orange-950/20 dark:to-orange-900/10 dark:text-orange-200',
    iconClassName: 'text-orange-600 dark:text-orange-400',
  },
  info: {
    icon: Info,
    className:
      'border border-blue-200/50 bg-gradient-to-r from-blue-50/50 to-blue-100/30 text-blue-800 dark:border-blue-800/30 dark:bg-gradient-to-r dark:from-blue-950/20 dark:to-blue-900/10 dark:text-blue-200',
    iconClassName: 'text-blue-600 dark:text-blue-400',
  },
  success: {
    icon: CheckCircle,
    className:
      'border border-green-200/50 bg-gradient-to-r from-green-50/50 to-green-100/30 text-green-800 dark:border-green-800/30 dark:bg-gradient-to-r dark:from-green-950/20 dark:to-green-900/10 dark:text-green-200',
    iconClassName: 'text-green-600 dark:text-green-400',
  },
  error: {
    icon: XCircle,
    className:
      'border border-red-200/50 bg-gradient-to-r from-red-50/50 to-red-100/30 text-red-800 dark:border-red-800/30 dark:bg-gradient-to-r dark:from-red-950/20 dark:to-red-900/10 dark:text-red-200',
    iconClassName: 'text-red-600 dark:text-red-400',
  },
}

export function Callout({children, type = 'warning', className}: CalloutProps) {
  const config = calloutConfig[type] || calloutConfig.warning
  const Icon = config.icon

  return (
    <div
      className={cn(
        'my-6 flex items-center gap-4 rounded-xl p-4 backdrop-blur-sm',
        config.className,
        className
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconClassName)} />
      <div className="text-sm leading-relaxed font-medium">{children}</div>
    </div>
  )
}
