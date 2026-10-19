import { useEffect, useReducer } from 'react'

export type Lang = 'zh' | 'ja'

const KEY = 'hj.lang'
const listeners = new Set<() => void>()

let current: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'zh' || v === 'ja') return v
    // 沒設定過就看瀏覽器的語言
    return navigator.language.startsWith('ja') ? 'ja' : 'zh'
  } catch { return 'zh' }
})()

export function getLang(): Lang {
  return current
}

export function setLang(l: Lang): void {
  if (l === current) return
  current = l
  try { localStorage.setItem(KEY, l) } catch { /* 無痕視窗存不進去就算了 */ }
  listeners.forEach((f) => f())
}

/** 在最上層叫一次就好——語言一變，整棵樹跟著重畫。 */
export function useLang(): Lang {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    return () => { listeners.delete(force) }
  }, [])
  return current
}

/**
 * 兩種語言的字串就寫在用到它的地方。
 * 不做 key 對照表：那樣要維護兩份檔案，還會有「某個 key 忘了翻」這種錯。
 */
export function L(zh: string, ja: string): string {
  return current === 'ja' ? ja : zh
}
