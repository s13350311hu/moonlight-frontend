import { useMemo, useState } from 'react'
import { addRec, db, delRec, updRec, type Chapter, type Note } from '../lib/db'
import { L } from '../lib/i18n'
import { TextArea, TextInput } from './Field'

export function Notes({ projectId, notes, chapters, onInsert }: {
  projectId: string
  notes: Note[]
  chapters: Chapter[]
  onInsert: (text: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [source, setSource] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  async function add() {
    if (!draft.trim()) return
    await addRec(db.notes, { projectId, body: draft.trim(), source: source.trim(), createdAt: Date.now() })
    setDraft(''); setSource('')
  }

  const needle = q.trim()
  const filtered = useMemo(
    () => (needle ? notes.filter((n) => n.body.includes(needle) || n.source.includes(needle)) : notes),
    [notes, needle],
  )

  // 順便在稿子全文裡找同一個關鍵字，省得為了確認寫過沒有而翻章節。
  const hits = useMemo(() => {
    if (needle.length < 2) return []
    const out: { i: number; excerpt: string }[] = []
    chapters.forEach((c, i) => {
      let from = 0
      for (;;) {
        const at = c.text.indexOf(needle, from)
        if (at === -1 || out.length > 30) return
        out.push({ i, excerpt: c.text.slice(Math.max(0, at - 28), at + needle.length + 38) })
        from = at + needle.length
      }
    })
    return out
  }, [chapters, needle])

  return (
    <>
      <div className="hint">{L('靈感、對白、偷聽到的句子。搜尋會同時翻全稿。', '思いつき、台詞、立ち聞きした一言。検索はメモと本文を同時に探す。')}</div>
      <div className="scroll">
        <div className="card">
          <textarea rows={3} placeholder={L('丟一句話、一個畫面、偷聽到的對白…', '一言、ひとつの画、立ち聞きした台詞…')} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="row" style={{ marginTop: 6 }}>
            <input placeholder={L('來源（可留空）', '出どころ（空でよい）')} value={source} onChange={(e) => setSource(e.target.value)} />
            <button onClick={add} disabled={!draft.trim()}>{L('存', '保存')}</button>
          </div>
        </div>

        <div className="field">
          <input placeholder={L('搜筆記＋全稿', 'メモと本文を検索')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {hits.length > 0 && (
          <>
            <div className="group-label">{L(`稿子裡出現 ${hits.length} 次`, `本文に ${hits.length} 回`)}</div>
            {hits.map((h, i) => (
              <div className="card" key={i}>
                <div className="sub" style={{ marginBottom: 3 }}>{`第${h.i + 1}章`}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>…{h.excerpt}…</div>
              </div>
            ))}
          </>
        )}

        {!filtered.length && !hits.length && (
          <div className="empty">{needle ? L('沒找到。', '見つかりません。') : L('素材放這裡，寫的時候不用翻手機。', '素材はここへ。書いている最中に携帯を見ずに済む。')}</div>
        )}

        {filtered.length > 0 && <div className="group-label">{L(`筆記 ${filtered.length} 則`, `メモ ${filtered.length} 件`)}</div>}
        {filtered.map((n) => openId === n.id ? (
          <div className="card lit" key={n.id}>
            <div className="field">
              <label className="lbl">{L('內容', '内容')}</label>
              <TextArea rows={5} value={n.body} onCommit={(v) => updRec(db.notes, n.id, { body: v })} />
            </div>
            <div className="field">
              <label className="lbl">{L('來源', '出どころ')}</label>
              <TextInput value={n.source} placeholder={L('哪裡聽到的、哪本書上看到的', 'どこで聞いたか、どの本で見たか')}
                onCommit={(v) => updRec(db.notes, n.id, { source: v })} />
            </div>
            <div className="row">
              <button className="flat" onClick={() => setOpenId(null)}>{L('收合', '閉じる')}</button>
              <span style={{ flex: 1 }} />
              <button className="flat danger" onClick={() => { delRec(db.notes, n.id); setOpenId(null) }}>{L('刪除', '削除')}</button>
            </div>
          </div>
        ) : (
          <div className="card" key={n.id}>
            <div style={{ fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{n.body}</div>
            {n.source && <div className="sub" style={{ marginTop: 4 }}>—{n.source}</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="flat" onClick={() => onInsert(n.body)}>{L('插進稿子', '本文に挿入')}</button>
              <button className="flat" onClick={() => setOpenId(n.id)}>{L('編輯', '編集')}</button>
              <span style={{ flex: 1 }} />
              <button className="flat danger" onClick={() => delRec(db.notes, n.id)}>{L('刪', '削除')}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
