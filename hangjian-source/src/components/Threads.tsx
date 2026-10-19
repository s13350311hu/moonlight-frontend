import { addRec, db, delRec, updRec, type Chapter, type Thread, type ThreadStatus } from '../lib/db'
import { L } from '../lib/i18n'
import { TextArea, TextInput } from './Field'

const STATUS: { id: ThreadStatus; label: () => string }[] = [
  { id: 'open', label: () => L('未回收', '未回収') },
  { id: 'paid', label: () => L('已回收', '回収済み') },
  { id: 'dropped', label: () => L('放棄', '取り下げ') },
]

export function Threads({ projectId, threads, chapters, currentId }: { projectId: string; threads: Thread[]; chapters: Chapter[]; currentId: string }) {
  const open = threads.filter((t) => t.status === 'open').length
  const sorted = [...threads].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1))

  return (
    <>
      <div className="hint">
        {open
          ? L(`${open} 條還沒回收。`, `未回収が ${open} 件。`)
          : L('埋了東西就記一筆。', '何か張ったら一件書いておく。')}
        {L('寫到第二十章才想起來忘了回收，那時候已經來不及。',
           '第二十章まで来てから思い出しても、もう間に合わない。')}
      </div>
      <div className="scroll">
        <div className="row" style={{ marginBottom: 8 }}>
          <button style={{ flex: 1 }} onClick={() => addRec(db.threads, {
            projectId, title: L('新伏筆', '新しい伏線'), note: '', plantedIn: currentId, payoffIn: null, status: 'open',
          })}>{L('＋ 記一個伏筆', '＋ 伏線を一件')}</button>
        </div>

        {!threads.length && <div className="empty">{L('還沒有伏筆。', 'まだ伏線がありません。')}</div>}

        {sorted.map((t) => (
          <div className="card" key={t.id}>
            <div className="card-top">
              <span className={`tag${t.status === 'paid' ? ' ok' : t.status === 'open' ? ' seal' : ''}`}>
                {STATUS.find((s) => s.id === t.status)!.label()}
              </span>
              <span style={{ flex: 1 }} />
              <button className="flat danger" onClick={() => delRec(db.threads, t.id)}>{L('刪', '削除')}</button>
            </div>
            <div className="field">
              <TextInput value={t.title} onCommit={(v) => updRec(db.threads, t.id, { title: v })} />
            </div>
            <div className="field">
              <TextArea rows={2} placeholder={L('這是什麼？打算怎麼收？', 'これは何か。どう回収するか。')} value={t.note}
                onCommit={(v) => updRec(db.threads, t.id, { note: v })} />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label className="lbl">{L('埋在', '張った章')}</label>
                <select value={t.plantedIn ?? ''} onChange={(e) => updRec(db.threads, t.id, { plantedIn: e.target.value || null })}>
                  <option value="">—</option>
                  {chapters.map((c, i) => <option key={c.id} value={c.id}>{`第${i + 1}章`} {c.title}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label className="lbl">{L('回收於', '回収する章')}</label>
                <select value={t.payoffIn ?? ''} onChange={(e) => {
                  const v = e.target.value || null
                  updRec(db.threads, t.id, { payoffIn: v, status: v ? 'paid' : 'open' })
                }}>
                  <option value="">—</option>
                  {chapters.map((c, i) => <option key={c.id} value={c.id}>{`第${i + 1}章`} {c.title}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
