import type { SupabaseClient } from '@supabase/supabase-js'
import type { Table } from 'dexie'
import { db, getSetting, setSetting, SYNCED_TABLES, TABLES, type SyncMeta, type TableName } from '../lib/db'
import { getClient } from './supabase'

// ---------------------------------------------------------------------------
// 同步策略（照 LifeGrid 那一套，共用同一張 records 表）
//
// 雲端只有一張表 `records`：(user_id, id, tbl, data jsonb, updated_at, server_seq, deleted)。
// 行間的 tbl 一律掛 hj_ 前綴，LifeGrid 拉到不認得的 tbl 會直接跳過，兩邊不會打架。
//
// 推送：本機 dirty=1 的列 upsert 上去，成功後清掉 dirty。
// 拉取：抓 server_seq > 游標的列，逐筆比 updatedAt，較新的贏。
//
// 游標用 server_seq 不用 updated_at：updated_at 是寫入那台裝置自己的時鐘，
// 兩台差幾秒的話，慢的那台寫的時間戳會低於已經推進的游標，那筆就永遠拉不到。
// server_seq 由資料庫觸發器指派，嚴格遞增，跟時鐘無關。
// ---------------------------------------------------------------------------

/** 五張表的型別各不相同，同步只在乎同步欄位，統一收斂成一種再操作。 */
type AnyRow = SyncMeta & Record<string, unknown>
const tableOf = (t: TableName) => TABLES[t]() as unknown as Table<AnyRow, string>

const LAST_PULL_KEY = 'sync.lastPulledSeq'
const PAGE = 500

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'unconfigured' | 'signedout'

export interface SyncStatus {
  state: SyncState
  lastSyncAt: number | null
  pending: number
  message: string
  /**
   * 第一次同步已經有結果了（成功拉完，或是根本沒設定雲端）。
   * 在這之前不可以因為「本機沒資料」就建空白作品或空白章節——
   * 雲端可能還沒拉下來，先建就會每次開啟都多一份，而且會推上去蓋掉雲端的。
   */
  settled: boolean
}

type Listener = (s: SyncStatus) => void
const listeners = new Set<Listener>()
let status: SyncStatus = { state: 'unconfigured', lastSyncAt: null, pending: 0, message: '', settled: false }

export function subscribeSync(fn: Listener): () => void {
  listeners.add(fn)
  fn(status)
  return () => { listeners.delete(fn) }
}
function emit(next: Partial<SyncStatus>) {
  status = { ...status, ...next }
  listeners.forEach((l) => l(status))
}
export function getSyncStatus(): SyncStatus {
  return status
}

export async function countPending(): Promise<number> {
  let total = 0
  for (const t of SYNCED_TABLES) total += await tableOf(t).where('dirty').equals(1).count()
  return total
}

interface RemoteRow {
  id: string
  tbl: string
  data: Record<string, unknown>
  updated_at: number
  server_seq: number | null
  deleted: boolean
}

const isMissingSeqColumn = (msg: string) =>
  /server_seq/i.test(msg) && /(does not exist|column|schema cache)/i.test(msg)

let running = false
let queuedAgain = false

export async function sync(opts: { silent?: boolean } = {}): Promise<SyncStatus> {
  if (running) {
    queuedAgain = true
    return status
  }
  const supabase = getClient()
  if (!supabase) {
    // 沒設定雲端就沒有東西要等，直接算定了
    emit({ state: 'unconfigured', message: '還沒設定 Supabase', settled: true })
    return status
  }
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    emit({ state: 'signedout', message: '還沒登入', settled: true })
    return status
  }
  if (!navigator.onLine) {
    emit({ state: 'offline', message: '離線中，改動先留在本機', pending: await countPending() })
    return status
  }

  running = true
  if (!opts.silent) emit({ state: 'syncing', message: '同步中…' })

  try {
    await push(supabase)
    await pull(supabase)
    const lastSyncAt = Date.now()
    await setSetting('sync.lastSyncAt', lastSyncAt)
    emit({ state: 'idle', lastSyncAt, pending: await countPending(), message: '', settled: true })
  } catch (err) {
    emit({ state: 'error', message: err instanceof Error ? err.message : String(err), pending: await countPending() })
  } finally {
    running = false
  }

  if (queuedAgain) {
    queuedAgain = false
    return sync({ silent: true })
  }
  return status
}

async function push(supabase: SupabaseClient) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  if (!userId) throw new Error('取不到使用者 ID')

  for (const tbl of SYNCED_TABLES) {
    const table = tableOf(tbl)
    const dirty = await table.where('dirty').equals(1).toArray()
    if (!dirty.length) continue

    for (let i = 0; i < dirty.length; i += PAGE) {
      const chunk = dirty.slice(i, i + PAGE)
      const rows = chunk.map((r) => {
        const { dirty: _d, ...rest } = r
        return {
          user_id: userId,
          id: r.id,
          tbl,
          data: rest,
          updated_at: r.updatedAt,
          deleted: r.deleted === 1,
        }
      })
      const { error } = await supabase.from('records').upsert(rows, { onConflict: 'user_id,id' })
      if (error) throw new Error(`推送 ${tbl} 失敗：${error.message}`)

      // 只有推送期間沒再被改過的才清掉 dirty
      await db.transaction('rw', table, async () => {
        for (const r of chunk) {
          const cur = await table.get(r.id)
          if (cur && cur.updatedAt === r.updatedAt) await table.update(r.id, { dirty: 0 } as never)
        }
      })
    }
  }
}

async function pull(supabase: SupabaseClient) {
  let cursor = await getSetting<number>(LAST_PULL_KEY, 0)
  let fetched = 0

  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('id, tbl, data, updated_at, server_seq, deleted')
      .gt('server_seq', cursor)
      .order('server_seq', { ascending: true })
      .limit(PAGE)

    if (error) {
      if (isMissingSeqColumn(error.message)) {
        throw new Error('雲端資料庫缺少 server_seq 欄位。到 Supabase 的 SQL Editor 跑一次 LifeGrid 的 migrate-server-seq.sql。')
      }
      throw new Error(`拉取失敗：${error.message}`)
    }

    const rows = (data ?? []) as RemoteRow[]
    if (!rows.length) break

    await applyRemote(rows)

    const last = rows[rows.length - 1].server_seq
    if (last === null) throw new Error('雲端資料缺少 server_seq，請重跑一次 migration SQL')
    cursor = last
    fetched += rows.length
    await setSetting(LAST_PULL_KEY, cursor)
    if (rows.length < PAGE) break
  }

  if (fetched > 0) emit({ message: `已更新 ${fetched} 筆` })
}

async function applyRemote(rows: RemoteRow[]) {
  const byTable = new Map<TableName, RemoteRow[]>()
  for (const r of rows) {
    // LifeGrid 的資料也在這張表裡，不是 hj_ 開頭的一律跳過
    if (!SYNCED_TABLES.includes(r.tbl as TableName)) continue
    const key = r.tbl as TableName
    if (!byTable.has(key)) byTable.set(key, [])
    byTable.get(key)!.push(r)
  }

  for (const [tbl, list] of byTable) {
    const table = tableOf(tbl)
    await db.transaction('rw', table, async () => {
      for (const r of list) {
        const local = await table.get(r.id)
        // 本機較新 → 留著，等下一輪推上去
        if (local && local.updatedAt > r.updated_at) continue
        // 一模一樣就別寫了。白寫一次會讓 useLiveQuery 重跑、畫面重繪，
        // 打字打到一半被這個打斷過。
        if (local && local.updatedAt === r.updated_at && local.deleted === (r.deleted ? 1 : 0)) continue
        await table.put({
          ...r.data,
          // v5 之前的雲端資料沒有 projectId，補成第一部作品
          ...(tbl === 'hj_project' ? {} : { projectId: (r.data as { projectId?: string }).projectId ?? 'main' }),
          id: r.id,
          updatedAt: r.updated_at,
          deleted: r.deleted ? 1 : 0,
          dirty: 0,
        } as never)
      }
    })
  }
}

/** 換帳號或重置：清掉本機所有資料與同步游標。 */
export async function wipeLocal(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}

/** 把本機全部標成 dirty，強制整包重新上傳。 */
export async function forcePushAll(): Promise<void> {
  for (const t of SYNCED_TABLES) {
    const table = tableOf(t)
    const all = await table.toArray()
    await table.bulkPut(all.map((r) => ({ ...r, dirty: 1 })) as never)
  }
}

let timer: number | undefined
/** 有改動就排一次同步，順便壓一下頻率。 */
export function scheduleSync(delay = 2500): void {
  clearTimeout(timer)
  timer = setTimeout(() => { void sync({ silent: true }) }, delay) as unknown as number
}

export function startAutoSync(): void {
  // 離線或出錯時第一次同步不會「定」，但也不能讓畫面一直等下去。
  // 十秒後放行，讓使用者至少能開始寫。
  setTimeout(() => { if (!status.settled) emit({ settled: true }) }, 10_000)
  void sync({ silent: true })
  setInterval(() => { void sync({ silent: true }) }, 60_000)
  addEventListener('online', () => { void sync({ silent: true }) })
  addEventListener('visibilitychange', () => { if (!document.hidden) void sync({ silent: true }) })
}
