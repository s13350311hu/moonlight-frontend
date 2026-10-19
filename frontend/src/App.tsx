import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  addRec, alive, chapterHtml, createFirstChapter, createFirstProject, createProject,
  CURRENT_PROJECT_KEY, currentProjectId, db, DEFAULT_LAYOUT, delRec, deleteProject,
  detectEntries, dialogueRatio, FONT_STACK, listProjects,
  setMutationHook, setSetting, updRec, wordCount,
  type Chapter, type ChapterStatus, type Entry, type Note, type Project, type Thread,
} from './lib/db'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { Editor } from './components/Editor'
import { L, useLang } from './lib/i18n'
import { FUNCTIONS } from './lib/propp'
import { scheduleSync, startAutoSync, subscribeSync, type SyncStatus } from './sync/syncEngine'
import { TextInput } from './components/Field'
import { Cards } from './components/Cards'
import { Equation } from './components/Equation'
import { Codex } from './components/Codex'
import { Threads } from './components/Threads'
import { Notes } from './components/Notes'
import { Layout } from './components/Layout'
import { Backup } from './components/Backup'
import { Settings } from './components/Settings'
import { PoetryPanel } from './components/PoetryPanel';

type Tab = 'cards' | 'equation' | 'codex' | 'threads' | 'notes' | 'layout' | 'backup' | 'settings'
const TABS: { id: Tab; label: () => string }[] = [
  { id: 'cards', label: () => L('抽卡', 'カード') },
  { id: 'equation', label: () => L('方程式', '方程式') },
  { id: 'codex', label: () => L('設定集', '設定資料') },
  { id: 'threads', label: () => L('伏筆', '伏線') },
  { id: 'notes', label: () => L('素材', '素材') },
  { id: 'layout', label: () => L('版面', '組版') },
  { id: 'backup', label: () => L('備份', 'バックアップ') },
  { id: 'settings', label: () => L('同步', '同期') },
]
const STATUS_LABEL: Record<ChapterStatus, () => string> = {
  draft: () => L('初稿', '初稿'),
  revising: () => L('修改中', '改稿中'),
  done: () => L('定稿', '決定稿'),
}

setMutationHook(() => scheduleSync())

/**
 * useLiveQuery 在重新查詢的空檔會回 undefined。照著它渲染的話，
 * 每次存檔都會讓整個畫面掉回「載入中」，編輯區被卸載重建——
 * 注音打到一半就是這樣斷掉的。所以記住上一次的好值，undefined 就沿用。
 *
 * key 是拿來分辨「這筆舊值還算不算數」的。換作品的時候查詢會重跑，
 * 這時候沿用上一部的資料會讓畫面顯示錯的東西，所以 key 一變就不沿用。
 */
function useSticky<T>(value: T | undefined, key?: string): T | undefined {
  const last = useRef<{ k?: string; v?: T }>({})
  if (value !== undefined) last.current = { k: key, v: value }
  return last.current.k === key ? last.current.v : undefined
}

export default function App() {
  const [pid, setPid] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('cards')
  const [focus, setFocus] = useState(false)
  const [drawer, setDrawer] = useState<'rail' | 'panel' | null>(null)
  const [renaming, setRenaming] = useState(false)
  useLang()   // 語言一換，整棵樹跟著重畫
  const [saved, setSaved] = useState(true)
  const [sync, setSync] = useState<SyncStatus | null>(null)

  const edRef = useRef<TipTapEditor | null>(null)
  const wcRef = useRef<HTMLSpanElement>(null)
  const drRef = useRef<HTMLSpanElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const curRef = useRef<string | null>(null)
  const [mentionedText, setMentionedText] = useState('')

  useEffect(() => { currentProjectId().then(setPid); startAutoSync() }, [])


  async function switchProject(id: string) {
    await setSetting(CURRENT_PROJECT_KEY, id)
    setCur(null)
    setPid(id)
  }
  async function newProject() {
    const title = prompt(L('新作品叫什麼？', '新しい作品の題名は？'), L('未命名作品', '無題の作品'))
    if (title === null) return
    setCur(null)
    setPid(await createProject(title))
  }
  useEffect(() => subscribeSync(setSync), [])

  const projects = useLiveQuery(() => listProjects(), [], [] as Project[])
  const project = useSticky(useLiveQuery(() => (pid ? db.project.get(pid) : undefined), [pid]), pid ?? '')
  const chapters = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.chapters.where('projectId').equals(pid).toArray()).sort((a, b) => a.order - b.order) : [], [pid]), pid ?? '') ?? ([] as Chapter[])
  const entries = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.entries.where('projectId').equals(pid).toArray()) : [], [pid]), pid ?? '') ?? ([] as Entry[])
  const threads = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.threads.where('projectId').equals(pid).toArray()) : [], [pid]), pid ?? '') ?? ([] as Thread[])
  const notes = useSticky(useLiveQuery(async () =>
    pid ? alive(await db.notes.where('projectId').equals(pid).toArray()).sort((a, b) => b.createdAt - a.createdAt) : [], [pid]), pid ?? '') ?? ([] as Note[])

  // 第一次同步有結果之後，若本機和雲端都真的沒東西，才建空白的。
  const settled = sync?.settled ?? false
  useEffect(() => {
    if (!settled) return
    if (!pid) { void createFirstProject().then(setPid); return }
    if (project && !chapters.length) void createFirstChapter(pid)
  }, [settled, pid, project, chapters])

  useEffect(() => {
    if (!chapters.length) return
    // cur 可能還指著上一部作品的章節，那樣 current 會永遠找不到、畫面卡在「載入中」
    if (cur == null || !chapters.some((c) => c.id === cur)) setCur(chapters[0].id)
  }, [chapters, cur])
  const current = chapters.find((c) => c.id === cur)

  // Tiptap 自己管內容區的 DOM，React 不會重繪到它，輸入法組字不受影響。
  const onEditorReady = useCallback((ed: TipTapEditor) => { edRef.current = ed }, [])

  /** 編輯器每次變動都會叫這裡。統計直接寫 DOM，不走 state，打字時整棵樹都不重繪。 */
  const onEditorUpdate = useCallback((html: string, text: string) => {
    if (wcRef.current) wcRef.current.textContent = `${wordCount(text)} 字`
    if (drRef.current) drRef.current.textContent = `會話 ${Math.round(dialogueRatio(text) * 100)}%`
    setSaved(false)
    clearTimeout(saveTimer.current)
    const id = curRef.current
    if (!id) return
    saveTimer.current = setTimeout(() => {
      updRec(db.chapters, id, { html, text }).then(() => setSaved(true))
      setMentionedText(text)
    }, 600) as unknown as number
  }, [])

  useEffect(() => {
    if (!current) return
    curRef.current = current.id
    setMentionedText(current.text)
  }, [current])

  const mentioned = useMemo(() => new Set(detectEntries(mentionedText, entries).map((e) => e.id)), [mentionedText, entries])
  const total = useMemo(() => chapters.reduce((n, c) => n + wordCount(c.text), 0), [chapters])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { e.preventDefault(); setFocus((v) => !v) }
      if (e.key === 'Escape') setDrawer(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  async function addChapter() {
    const id = await addRec(db.chapters, {
      projectId: pid!, order: chapters.length, title: `第${chapters.length + 1}章`,
      summary: '', text: '', html: '<p></p>', status: 'draft', func: null,
    })
    setCur(id)
  }
  async function move(id: string, d: number) {
    const i = chapters.findIndex((c) => c.id === id)
    const j = i + d
    if (i < 0 || j < 0 || j >= chapters.length) return
    const next = [...chapters]
    const [m] = next.splice(i, 1)
    next.splice(j, 0, m)
    await Promise.all(next.map((c, k) => (c.order === k ? null : updRec(db.chapters, c.id, { order: k }))))
  }
  async function removeChapter(id: string) {
    if (chapters.length <= 1) return
    if (!confirm(L('刪掉這一章？', 'この章を削除しますか。'))) return
    await delRec(db.chapters, id)
    const rest = chapters.filter((c) => c.id !== id)
    await Promise.all(rest.map((c, k) => (c.order === k ? null : updRec(db.chapters, c.id, { order: k }))))
    if (cur === id) setCur(rest[0]?.id ?? null)
  }
  /** 把一段純文字接到這一章最後面（卡牌練習用）。 */
  function appendToChapter(t: string) {
    const ed = edRef.current
    if (!ed) return
    ed.chain().focus('end').insertContent(
      t.split('\n').filter((l) => l.trim()).map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })),
    ).run()
    setDrawer(null)
  }

  /** 把一段素材插在游標處。 */
  function insertAtCursor(t: string) {
    const ed = edRef.current
    if (!ed) return
    ed.chain().focus().insertContent(t).run()
    setDrawer(null)
  }

  if (!pid || !project || !current) {
    return (
      <div className="empty" style={{ marginTop: 80 }}>
        {settled ? L('準備中…', '準備中…') : L('正在把雲端的稿子拉下來…', 'クラウドから原稿を取得しています…')}
      </div>
    )
  }

  const f = FUNCTIONS.find((x) => x.code === current.func)
  const Lp = { ...DEFAULT_LAYOUT, ...((project as Project).layout ?? {}) }
  const edStyle = {
    '--ed-font': FONT_STACK[Lp.font],
    '--ed-size': `${Lp.size}px`,
    '--ed-lh': String(Lp.lineHeight),
    '--ed-ls': `${Lp.letterSpacing}em`,
    '--ed-measure': `${Lp.measure}rem`,
    '--ed-indent': `${Lp.indent}em`,
  } as React.CSSProperties

  return (
    <>
      <div style={{ 
        position: 'fixed', 
        bottom: '20px', 
        right: '20px', 
        zIndex: 9999, 
        backgroundColor: '#f9f9f9', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '8px',
        width: '300px'
      }}>
        <PoetryPanel />
      </div>
      <div className={`scrim${drawer ? ' on' : ''}`} onClick={() => setDrawer(null)} />
      <div className={`app${focus ? ' focus' : ''}`} style={edStyle}>
        <header className="topbar">
          <button className="flat drawer-btn" aria-label={L('章節', '章')} onClick={() => setDrawer(drawer === 'rail' ? null : 'rail')}>≡</button>
          <span className="brand">月下語詩</span>
          <TextInput className="chap-title" aria-label={L('章節標題', '章の題名')} value={current.title}
            onCommit={(v) => updRec(db.chapters, current.id, { title: v })} />
          <select aria-label={L('狀態', '状態')} value={current.status}
            onChange={(e) => updRec(db.chapters, current.id, { status: e.target.value as ChapterStatus })}>
            {(Object.keys(STATUS_LABEL) as ChapterStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]()}</option>)}
          </select>
          <button className="flat" onClick={() => setFocus(!focus)}>{focus ? L('離開專注', '集中を抜ける') : L('專注', '集中')}</button>
          <button className="flat drawer-btn" aria-label={L('面板', 'パネル')} onClick={() => setDrawer(drawer === 'panel' ? null : 'panel')}>▦</button>
        </header>

        <aside className={`rail${drawer === 'rail' ? ' open' : ''}`}>
          <div className="rail-head">
            {renaming ? (
              <TextInput autoFocus aria-label={L('作品名稱', '作品名')} value={project.title}
                onCommit={(v) => updRec(db.project, project.id, { title: v.trim() || '未命名作品' })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setRenaming(false) }}
                onBlur={() => setRenaming(false)} />
            ) : (
              <select aria-label={L('作品', '作品')} value={pid}
                onChange={(e) => (e.target.value === '__new' ? newProject() : switchProject(e.target.value))}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title || '未命名作品'}</option>)}
                <option value="__new">{L('＋ 新增作品…', '＋ 新しい作品…')}</option>
              </select>
            )}
            <button className="flat" title={renaming ? L('改好了', '完了') : L('改作品名稱', '作品名を変える')}
              onClick={() => setRenaming(!renaming)}>{renaming ? '✓' : '✎'}</button>
          </div>
          <div className="scroll">
            {chapters.map((c, i) => (
              <div key={c.id} className="chap" aria-current={c.id === cur} role="button" tabIndex={0}
                onClick={() => { setCur(c.id); setDrawer(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCur(c.id); setDrawer(null) } }}>
                <div className="chap-name"><span className={`dot ${c.status}`} /><span>{i + 1}. {c.title}</span></div>
                <div className="chap-meta">
                  <span>{wordCount(c.text)}{L(' 字', ' 字')}</span>
                  {c.func && <span>・{c.func}</span>}
                  {c.id === cur && (
                    <>
                      <span style={{ flex: 1 }} />
                      <button className="flat" aria-label={L('上移', '上へ')} onClick={(e) => { e.stopPropagation(); move(c.id, -1) }}>↑</button>
                      <button className="flat" aria-label={L('下移', '下へ')} onClick={(e) => { e.stopPropagation(); move(c.id, 1) }}>↓</button>
                      <button className="flat danger" aria-label={L('刪除', '削除')} onClick={(e) => { e.stopPropagation(); removeChapter(c.id) }}>✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            <span style={{ flex: 1 }}>{L(`全稿 ${total} 字`, `全体 ${total} 字`)}</span>
            <button className="flat" onClick={addChapter}>{L('＋ 新增章節', '＋ 章を足す')}</button>
          </div>
        </aside>

        <main className="main">
          <div className="summary-row">
            <span className="lbl">{L('本章摘要', 'この章のあらすじ')}</span>
            <TextInput placeholder={L('一句話講這章發生什麼事', 'この章で何が起きるかを一行で')} value={current.summary}
              onCommit={(v) => updRec(db.chapters, current.id, { summary: v })} />
            {f && <span className="tag seal" title={L('這一章在方程式裡負責的機能', 'この章が方程式で担う機能')}>{f.code}　{f.ja}</span>}
          </div>
          <Editor chapterId={current.id} html={chapterHtml(current)}
            onUpdate={onEditorUpdate} onReady={onEditorReady} />
          <div className="statusbar">
            <span ref={wcRef}>{wordCount(current.text)}{L(' 字', ' 字')}</span>
            <span ref={drRef} title={L('會話佔全文的比例。《小説作法ABC》：小說由會話・描寫・說明構成',
              '会話が全文に占める割合。『小説作法ABC』：小説は会話・描写・説明でできている')}>
              {L('會話', '会話')} {Math.round(dialogueRatio(current.text) * 100)}%
            </span>
            <span className="grow" />
            <span className={`sync-dot ${sync?.state ?? 'unconfigured'}`} />
            <span>{saved ? L('已存', '保存済み') : L('存檔中…', '保存中…')}</span>
            <span>{L('⌘. 專注模式', '⌘. 集中モード')}</span>
          </div>
        </main>

        <aside className={`panel${drawer === 'panel' ? ' open' : ''}`}>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} role="tab"
                aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label()}
                {t.id === 'threads' && threads.some((x) => x.status === 'open') &&
                  <span style={{ color: 'var(--seal)' }}> ·{threads.filter((x) => x.status === 'open').length}</span>}
              </button>
            ))}
          </nav>
          {tab === 'cards' && <Cards projectId={pid} onAppend={appendToChapter} />}
          {tab === 'equation' && <Equation project={project as Project} chapters={chapters} entries={entries} />}
          {tab === 'codex' && <Codex projectId={pid} entries={entries} mentioned={mentioned} />}
          {tab === 'threads' && <Threads projectId={pid} threads={threads} chapters={chapters} currentId={current.id} />}
          {tab === 'notes' && <Notes projectId={pid} notes={notes} chapters={chapters} onInsert={insertAtCursor} />}
          {tab === 'layout' && (
            <Layout project={project as Project} projects={projects} onDelete={async (id) => {
              await deleteProject(id)
              const rest = projects.filter((p) => p.id !== id)
              setCur(null)
              setPid(rest.length ? rest[0].id : await createFirstProject())
            }} />
          )}
          {tab === 'backup' && <Backup project={project as Project} chapters={chapters} />}
          {tab === 'settings' && <Settings />}
        </aside>
      </div>
    </>
  )
}
