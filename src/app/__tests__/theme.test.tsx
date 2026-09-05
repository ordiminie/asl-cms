import {renderHook} from '@testing-library/react'
import {useTheme} from 'next-themes'
import {act} from 'react'
import {afterEach, describe, expect, it} from 'vitest'

import {WrapperContext} from './utils'

describe('Theme', () => {
  afterEach(() => {
    window.localStorage.removeItem('theme')
  })
  //skip for CI
  it.skip("Theme default is 'system'", () => {
    const {result: themeResult} = renderHook(() => useTheme(), {
      wrapper: WrapperContext,
    })

    act(() => {
      expect(themeResult.current.theme).toBe('system')
    })
  })

  it.skip('Theme hook provides setTheme function', () => {
    const {result: themeResult} = renderHook(() => useTheme(), {
      wrapper: WrapperContext,
    })

    act(() => {
      expect(typeof themeResult.current.setTheme).toBe('function')
    })
  })

  it.skip('Theme hook provides themes array', () => {
    const {result: themeResult} = renderHook(() => useTheme(), {
      wrapper: WrapperContext,
    })

    act(() => {
      expect(Array.isArray(themeResult.current.themes)).toBe(true)
      expect(themeResult.current.themes).toContain('light')
      expect(themeResult.current.themes).toContain('dark')
      expect(themeResult.current.themes).toContain('system')
    })
  })
})
