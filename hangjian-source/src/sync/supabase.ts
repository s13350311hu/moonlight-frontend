import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL_KEY = 'hj.supabase.url'
const ANON_KEY = 'hj.supabase.anon'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function readConfig(): SupabaseConfig | null {
  const url = localStorage.getItem(URL_KEY) ?? import.meta.env.VITE_SUPABASE_URL ?? ''
  const anonKey = localStorage.getItem(ANON_KEY) ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/** 從 Supabase 後台複製過來的網址常常帶著 /rest/v1，createClient 要的是根網址。 */
export function normalizeUrl(raw: string): string {
  let url = raw.trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    return new URL(url).origin
  } catch {
    return url.replace(/\/+$/, '')
  }
}

export function writeConfig(cfg: SupabaseConfig | null): void {
  if (!cfg) {
    localStorage.removeItem(URL_KEY)
    localStorage.removeItem(ANON_KEY)
  } else {
    localStorage.setItem(URL_KEY, normalizeUrl(cfg.url))
    localStorage.setItem(ANON_KEY, cfg.anonKey.trim())
  }
  client = undefined
}

let client: SupabaseClient | undefined

export function getClient(): SupabaseClient | null {
  if (client) return client
  const cfg = readConfig()
  if (!cfg) return null
  // storageKey 跟 LifeGrid 分開，兩個網站各自記各自的登入狀態。
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hj.auth' },
  })
  return client
}

export function isConfigured(): boolean {
  return readConfig() !== null
}
