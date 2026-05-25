import { computed } from 'vue'

/**
 * 读取与 Naive UI useThemeVars() 对齐的颜色 token（基于当前 CSS 变量）。
 * 在重构后由 Tailwind v4 token 提供。
 */
export function useThemeVars() {
  function read(name: string, fallback: string): string {
    if (typeof window === 'undefined')
      return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }

  return computed(() => ({
    successColor: read('--success', '#18a058'),
    successColorHover: read('--success', '#36ad6a'),
    successColorPressed: read('--success', '#0c7a43'),
    infoColor: read('--info', '#2080f0'),
    infoColorHover: read('--info', '#4098fc'),
    infoColorPressed: read('--info', '#1060c9'),
    warningColor: read('--warning', '#f0a020'),
    warningColorHover: read('--warning', '#fcb040'),
    warningColorPressed: read('--warning', '#c97c10'),
    errorColor: read('--destructive', '#d03050'),
    errorColorHover: read('--destructive', '#de576d'),
    errorColorPressed: read('--destructive', '#ab1f3f'),
    primaryColor: read('--primary', '#18a058'),
    primaryColorHover: read('--primary-hover', '#36ad6a'),
    primaryColorPressed: read('--primary-active', '#0c7a43'),
    textColor1: read('--foreground', '#000'),
    textColor2: read('--foreground', '#333'),
    textColor3: read('--muted-foreground', '#999'),
    borderColor: read('--border', '#e5e7eb'),
    bodyColor: read('--background', '#fff'),
    cardColor: read('--card', '#fff'),
    progressRailColor: read('--muted', '#e5e7eb'),
  }))
}
