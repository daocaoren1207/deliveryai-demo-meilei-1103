import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#fbf5ea',
  dark: '#15110f',
}

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const initial = getInitialPreference()
    applyTheme(resolveTheme(initial))
    return initial
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(preference))

  useEffect(() => {
    const resolved = resolveTheme(preference)
    setResolvedTheme(resolved)
    applyTheme(resolved)

    if (preference !== 'system') return

    const media = getColorSchemeMedia()
    if (!media) return

    const handleChange = () => {
      const next = resolveTheme('system')
      setResolvedTheme(next)
      applyTheme(next)
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage 不可用时降级为当前会话内存态，不阻塞用户继续使用
    }
  }, [])

  return { preference, resolvedTheme, setPreference }
}

function getInitialPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isThemePreference(stored)) return stored
  } catch {
    // localStorage 不可读时使用默认跟随系统；系统偏好不可读时 resolveTheme 会回退浅色
  }
  return 'system'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  const media = getColorSchemeMedia()
  return media?.matches ? 'dark' : 'light'
}

function getColorSchemeMedia(): MediaQueryList | null {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
    return window.matchMedia('(prefers-color-scheme: dark)')
  } catch {
    return null
  }
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor) themeColor.setAttribute('content', THEME_COLOR[theme])
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}
