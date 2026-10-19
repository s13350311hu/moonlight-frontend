import Dexie, { type Table } from 'dexie'
import { L } from './i18n'
import type { ActantId } from './propp'

/**
 * 每一筆資料都帶同步欄位，跟 LifeGrid 同一套：
 * updatedAt（最後修改時間，毫秒）、deleted（軟刪除）、dirty（1 = 本機有還沒推上去的變更）。
 * 衝突用 last-write-wins 解，比 updatedAt。
 */
export interface SyncMeta {
  id: string
  updatedAt: number
  deleted: 0 | 1
  dirty: 0 | 1
}

export type ChapterStatus = 'draft' | 'revising' | 'done'
export type EntryType = 'character' | 'place' | 'item' | 'lore'
export type ThreadStatus = 'open' | 'paid' | 'dropped'

/** 寫作時的版面設定。存在作品上，所以每台裝置看到的樣子一致。 */
export interface LayoutPrefs {
  font: 'serif' | 'sans' | 'kai' | 'mono'
  /** 字級，px */
  size: number
  /** 行距，倍數 */
  lineHeight: number
  /** 字距，em */
  letterSpacing: number
  /** 版心寬度，rem */
  measure: number
  /** 每段開頭要補幾個全形空格。0 = 不補。 */
  indent: 0 | 1 | 2
}

export const DEFAULT_LAYOUT: LayoutPrefs = {
  font: 'serif', size: 17, lineHeight: 2.05, letterSpacing: 0.02,
  measure: 41, indent: 0,
}

export const FONT_STACK: Record<LayoutPrefs['font'], string> = {
  serif: '"Noto Serif TC","Songti TC","Source Han Serif TC",serif',
  sans: '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif',
  kai: '"Kaiti TC","BiauKai","標楷體","DFKai-SB","Noto Serif TC",serif',
  mono: 'ui-monospace,"Sarasa Mono TC","Menlo","Noto Sans Mono CJK TC",monospace',
}

/** 每段開頭補上全形空格。已經有的不重複補。 */
export function applyIndent(text: string, n: 0 | 1 | 2): string {
  if (!n) return text
  const pad = '　'.repeat(n)
  return text.split('\n').map((line) => {
    if (!line.trim()) return line
    return pad + line.replace(/^[　\s]+/, '')
  }).join('\n')
}

/** 把每段開頭的全形空格拿掉。 */
export function stripIndent(text: string): string {
  return text.split('\n').map((line) => (line.trim() ? line.replace(/^　+/, '') : line)).join('\n')
}

/** 作品層級的東西，永遠只有一筆，id 固定是 'main'。 */
export interface Project extends SyncMeta {
  title: string
  logline: string
  /** 格雷馬斯的六個行為項。 */
  actants: Partial<Record<ActantId, string>>
  /** 舊資料沒有這個欄位，讀的時候用 DEFAULT_LAYOUT 補。 */
  layout?: LayoutPrefs
}

export interface Chapter extends SyncMeta {
  projectId: string
  order: number
  title: string
  /** 一句話講這章發生什麼事。 */
  summary: string
  /**
   * 純文字投影。字數、會話比例、全稿搜尋、設定集偵測都吃這個，
   * 每次存檔從 html 重新算出來，不要手動改。
   */
  text: string
  /** 真正的內容。舊資料沒有這個欄位，讀的時候用 text 轉。 */
  html?: string
  status: ChapterStatus
  /** 普羅普三十一機能的代號，例如 'A'、'↑'。 */
  func: string | null
}

/** 設定集：角色、地點、物件、世界觀。 */
export interface Entry extends SyncMeta {
  projectId: string
  type: EntryType
  name: string
  /** 別名、綽號、代稱，用來在內文裡自動偵測。 */
  aliases: string[]
  body: string
}

/** 伏筆：埋在哪、要在哪回收、回收了沒。 */
export interface Thread extends SyncMeta {
  projectId: string
  title: string
  note: string
  plantedIn: string | null
  payoffIn: string | null
  status: ThreadStatus
}

/** 用卡牌寫故事的練習。出自《物語の体操》第一講。 */
export interface Sketch extends SyncMeta {
  projectId: string
  title: string
  /** 抽到的卡：n 是牌組索引，face 0 正位、1 逆位。前六張對應書上圖 6 的六個位置。 */
  cards: { n: number; face: 0 | 1 }[]
  /** 每個位置底下寫的「這張在我的故事裡是什麼」，跟 cards 同長。 */
  parts: string[]
  /** 把六張接起來寫成的故事。 */
  story: string
  createdAt: number
}

/** 素材碎片。 */
export interface Note extends SyncMeta {
  projectId: string
  body: string
  source: string
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

class HangjianDB extends Dexie {
  project!: Table<Project, string>
  chapters!: Table<Chapter, string>
  entries!: Table<Entry, string>
  threads!: Table<Thread, string>
  notes!: Table<Note, string>
  sketches!: Table<Sketch, string>
  settings!: Table<Setting, string>

  constructor() {
    super('hangjian')
    // v1/v2 是還沒有同步的舊版，自增號當主鍵。v3 整個換成 UUID 主鍵 ＋ 同步欄位，
    // 舊資料搬不過來（那時候只有本機範例稿），所以直接開新的 store。
    this.version(3).stores({
      project: 'id, dirty',
      chapters: 'id, order, dirty',
      entries: 'id, type, dirty',
      threads: 'id, status, dirty',
      notes: 'id, createdAt, dirty',
      settings: 'key',
    })
    // v4：加上卡牌練習。
    this.version(4).stores({ sketches: 'id, createdAt, dirty' })
    // v5：一個瀏覽器可以放多部作品，每筆資料都要記得自己屬於哪一部。
    this.version(5).stores({
      chapters: 'id, projectId, order, dirty',
      entries: 'id, projectId, type, dirty',
      threads: 'id, projectId, status, dirty',
      notes: 'id, projectId, createdAt, dirty',
      sketches: 'id, projectId, createdAt, dirty',
    }).upgrade(async (tx) => {
      for (const t of ['chapters', 'entries', 'threads', 'notes', 'sketches']) {
        await tx.table(t).toCollection().modify((r) => { r.projectId ??= 'main' })
      }
    })
  }
}

export const db = new HangjianDB()

export const TABLES = {
  hj_project: () => db.project,
  hj_chapters: () => db.chapters,
  hj_entries: () => db.entries,
  hj_threads: () => db.threads,
  hj_notes: () => db.notes,
  hj_sketches: () => db.sketches,
} as const

/** 雲端那張 records 表是跟 LifeGrid 共用的，所以每個名字都要掛 hj_ 前綴，不然會撞到它的 chapters。 */
export type TableName = keyof typeof TABLES
export const SYNCED_TABLES = Object.keys(TABLES) as TableName[]

/** 任何一筆資料被改動之後要做的事（排一次同步）。由 syncEngine 那邊裝上來，
 *  這樣 db 就不用反過來 import syncEngine，避免循環相依。 */
let onMutate: (() => void) | null = null
export function setMutationHook(fn: () => void): void {
  onMutate = fn
}

export function uid(): string {
  return crypto.randomUUID()
}
function stamp<T extends object>(o: T): T & { updatedAt: number; deleted: 0; dirty: 1 } {
  return { ...o, updatedAt: Date.now(), deleted: 0, dirty: 1 }
}

/** 新增一筆。 */
export async function addRec<T extends SyncMeta>(table: Table<T, string>, rec: Omit<T, keyof SyncMeta> & { id?: string }) {
  const id = rec.id ?? uid()
  await table.put(stamp({ ...rec, id }) as unknown as T)
  onMutate?.()
  return id
}
/**
 * 衝突是「時間比較新的贏」，而時間戳是寫入那台裝置自己的時鐘。
 * 如果某一筆被時鐘走得快的裝置寫過，它的時間戳就在未來；之後在別台改它，
 * 產生的時間戳比它小，下一次拉取就被舊版本蓋回去——那一筆會變成怎麼改都改不動。
 * 所以每次修改都保證比這筆現在的值大一點。
 */
async function bump<T extends SyncMeta>(table: Table<T, string>, id: string): Promise<number> {
  const cur = await table.get(id)
  return Math.max(Date.now(), (cur?.updatedAt ?? 0) + 1)
}

/** 改一筆，順便標成待推送。 */
export async function updRec<T extends SyncMeta>(table: Table<T, string>, id: string, patch: Partial<T>) {
  await table.update(id, { ...patch, updatedAt: await bump(table, id), dirty: 1 } as never)
  onMutate?.()
}
/** 軟刪除。真的刪掉的話，其他裝置不會知道這筆消失了。 */
export async function delRec<T extends SyncMeta>(table: Table<T, string>, id: string) {
  await table.update(id, { deleted: 1, updatedAt: await bump(table, id), dirty: 1 } as never)
  onMutate?.()
}

export function alive<T extends SyncMeta>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((r) => !r.deleted)
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** 目前在看哪一部作品。存在本機，不同步——手機和電腦可以各看各的。 */
export const CURRENT_PROJECT_KEY = 'ui.currentProject'

export async function listProjects(): Promise<Project[]> {
  return alive(await db.project.toArray()).sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'))
}

/**
 * 開檔時叫一次。**只讀，不建任何東西。**
 * 雲端可能還沒拉下來，這時候建空白作品會每次開啟都多一份，
 * 而且時間戳比雲端新，推上去會蓋掉你真正的作品資料。
 * 回傳 null 代表本機還沒有任何作品——等同步有結果之後再決定要不要建。
 */
export async function currentProjectId(): Promise<string | null> {
  const list = await listProjects()
  if (!list.length) return null
  let pid = await getSetting<string>(CURRENT_PROJECT_KEY, '')
  if (!pid || !list.some((p) => p.id === pid)) {
    pid = list[0].id
    await setSetting(CURRENT_PROJECT_KEY, pid)
  }
  return pid
}

/** 確定雲端也沒有東西之後才叫：建一部空白作品。 */
export async function createFirstProject(): Promise<string> {
  await db.project.put(stamp({
    id: 'main', title: '未命名作品', logline: '', actants: {}, layout: { ...DEFAULT_LAYOUT },
  }) as Project)
  await setSetting(CURRENT_PROJECT_KEY, 'main')
  return 'main'
}

/** 確定這部作品真的一章都沒有（含雲端）之後才叫。 */
export async function createFirstChapter(projectId: string): Promise<void> {
  const n = await db.chapters.where('projectId').equals(projectId).count()
  if (n > 0) return
  await addRec(db.chapters, {
    projectId, order: 0, title: L('第一章', '第一章'), summary: '', text: '', html: '<p></p>',
    status: 'draft', func: null,
  })
}

export async function createProject(title: string): Promise<string> {
  const id = uid()
  await db.project.put(stamp({
    id, title: title.trim() || L('未命名作品', '無題の作品'), logline: '', actants: {}, layout: { ...DEFAULT_LAYOUT },
  }) as Project)
  await addRec(db.chapters, {
    projectId: id, order: 0, title: '第一章', summary: '', text: '', html: '<p></p>',
    status: 'draft', func: null,
  })
  await setSetting(CURRENT_PROJECT_KEY, id)
  return id
}

/** 整部刪掉。用軟刪除，其他裝置才知道這些東西消失了。 */
export async function deleteProject(id: string): Promise<void> {
  const tables = [db.chapters, db.entries, db.threads, db.notes, db.sketches]
  for (const t of tables) {
    const rows = await (t as unknown as Table<SyncMeta, string>).where('projectId').equals(id).toArray()
    for (const r of rows) await delRec(t as unknown as Table<SyncMeta, string>, r.id)
  }
  await delRec(db.project, id)
}

/** 舊的純文字稿轉成 HTML：一行一段，空行跳過。 */
export function textToHtml(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim())
  if (!lines.length) return '<p></p>'
  return lines.map((l) => `<p>${l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))}</p>`).join('')
}

export function chapterHtml(c: Chapter): string {
  return c.html ?? textToHtml(c.text)
}

export function wordCount(text: string): number {
  const cjk = (text.match(/[㐀-鿿豈-﫿]/g) ?? []).length
  const words = (text.match(/[A-Za-z0-9']+/g) ?? []).length
  return cjk + words
}

/** 會話佔全文的比例。《小説作法ABC》：小說由會話・描寫・說明構成，三者裡只有會話數得出來。 */
export function dialogueRatio(text: string): number {
  if (!text.trim()) return 0
  let n = 0
  for (const m of text.matchAll(/[「『][^」』]*[」』]/g)) n += m[0].length
  return n / text.length
}

/** 掃內文，找出被提到的設定條目（含別名）。 */
export function detectEntries(text: string, entries: Entry[]): Entry[] {
  return entries.filter((e) => [e.name, ...(e.aliases || [])].filter(Boolean).some((n) => text.includes(n)))
}
