import React from 'react'

import {ThemeProvider} from '@/components/context/theme-provider'

export const WrapperContext = ({children}: {children: React.ReactNode}) => {
  return <ThemeProvider>{children}</ThemeProvider>
}
