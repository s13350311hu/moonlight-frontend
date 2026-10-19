import { useRef, useState } from 'react'
import { db, type Chapter, type Project } from '../lib/db'
import { L } from '../lib/i18n'

// docx 那包很大，只有按下匯出才載入，不要拖慢開啟速度。
const exporters = () => import('../lib/exporters')

export function Backup({ project, chapters }: { project: Project; chapters: Chapter[] }) {
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function save(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function dump() {
    const [p, ch, en, th, no] = await Promise.all([
      db.project.toArray(), db.chapters.toArray(), db.entries.toArray(),
      db.threads.toArray(), db.notes.toArray(),
    ])
    return JSON.stringify({ v: 3, project: p, chapters: ch, entries: en, threads: th, notes: no }, null, 2)
  }

  async function restore(file: File) {
    setErr(''); setMsg('')
    try {
      const d = JSON.parse(await file.text())
      if (!d || !Array.isArray(d.chapters)) throw new Error(L('格式不對', '形式が違います'))
      await db.transaction('rw', db.project, db.chapters, db.entries, db.threads, db.notes, async () => {
        await Promise.all([db.project.clear(), db.chapters.clear(), db.entries.clear(), db.threads.clear(), db.notes.clear()])
        // 還原進來的一律標成待上傳，讓它蓋回雲端
        const mark = (rows: unknown[]) => (rows ?? []).map((r) => ({ ...(r as object), dirty: 1 }))
        await db.project.bulkPut(mark(d.project) as never)
        await db.chapters.bulkPut(mark(d.chapters) as never)
        await db.entries.bulkPut(mark(d.entries) as never)
        await db.threads.bulkPut(mark(d.threads) as never)
        await db.notes.bulkPut(mark(d.notes) as never)
      })
      setMsg(L(`還原了，共 ${d.chapters.length} 章。重新整理一下。`, `読み込みました（全 ${d.chapters.length} 章）。画面を更新してください。`))
    } catch (e) {
      setErr(L(`這個檔案讀不了：${e instanceof Error ? e.message : String(e)}`, `このファイルは読めません：${e instanceof Error ? e.message : String(e)}`))
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="hint">{L('雲端那份跟著帳號走，本機這份在瀏覽器裡。兩份都不是備份——偶爾存一份到硬碟。', 'クラウドの分は account について回り、手もとの分はブラウザの中。どちらもバックアップではない。ときどきディスクに保存する。')}</div>
      <div className="scroll">
        <div className="group-label">{L('匯出', '書き出し')}</div>
        <div className="row" style={{ marginBottom: 6 }}>
          <button style={{ flex: 1 }} disabled={busy} onClick={async () => {
            setBusy(true); setErr(''); setMsg('')
            try {
              const { toDocxBlob } = await exporters()
              save(`${project.title}.docx`, await toDocxBlob(project, chapters))
              setMsg(L('Word 檔下載了。標題、粗斜體底線、清單、引用、對齊、顏色、首行縮排都帶過去了。', 'Word を保存しました。見出し・太字斜体下線・箇条書き・引用・揃え・文字色・字下げもそのまま移ります。'))
            } catch (e) {
              setErr(L(`轉不出 Word：${e instanceof Error ? e.message : String(e)}`, `Word に変換できません：${e instanceof Error ? e.message : String(e)}`))
            } finally { setBusy(false) }
          }}>{busy ? L('轉檔中…', '変換中…') : 'Word（.docx）'}</button>
        </div>
        <div className="row" style={{ marginBottom: 6 }}>
          <button className="flat" style={{ flex: 1 }} onClick={async () => {
            const { toMarkdown } = await exporters()
            save(`${project.title}.md`, new Blob([toMarkdown(project, chapters)], { type: 'text/markdown;charset=utf-8' }))
          }}>
            Markdown（.md）
          </button>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="flat" style={{ flex: 1 }} onClick={async () =>
            save(L(`行間備份-${stamp}.json`, `行間-backup-${stamp}.json`), new Blob([await dump()], { type: 'application/json' }))}>
            {L('完整備份（含設定集、伏筆、素材）', '完全なバックアップ（設定資料・伏線・素材を含む）')}
          </button>
        </div>

        <div className="group-label">{L('還原', '読み込み')}</div>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = '' }} />
        <div className="row">
          <button className="flat" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>{L('選一個備份檔', 'バックアップを選ぶ')}</button>
        </div>
        <div className="sub" style={{ marginTop: 6 }}>{L('目前本機的內容會被整個換掉，然後推上雲端。', 'いま手もとにある内容は丸ごと置き換わり、クラウドにも上がります。')}</div>

        {err && <div className="err">{err}</div>}
        {msg && <div className="ok-msg">{msg}</div>}

        <div className="group-label">{L('字數', '文字数')}</div>
        <div className="card">
          <div className="sub">
            {L(`${chapters.length} 章`, `${chapters.length} 章`)}　·　
            {chapters.reduce((n, c) => n + c.text.length, 0).toLocaleString()}{L(' 個字元', ' 文字')}
          </div>
        </div>
      </div>
    </>
  )
}
