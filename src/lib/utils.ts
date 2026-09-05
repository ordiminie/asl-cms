import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

import {EnabledPage, env} from '@/env'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const isPageEnabled = (page: EnabledPage) =>
  env.NEXT_PUBLIC_ENABLED_PAGES.includes(page)
