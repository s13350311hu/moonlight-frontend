import { useState } from 'react'
import { addRec, db, delRec, updRec, type Entry, type EntryType } from '../lib/db'
import { L } from '../lib/i18n'
import { TextArea, TextInput } from './Field'

const TYPES: { id: EntryType; label: () => string }[] = [
  { id: 'character', label: () => L('角色', '人物') },
  { id: 'place', label: () => L('地點', '場所') },
  { id: 'item', label: () => L('物件', '物') },
  { id: 'lore', label: () => L('設定', '世界観') },
]

export function Codex({ projectId, entries, mentioned }: { projectId: string; entries: Entry[]; mentioned: Set<string> }) {
  const [openId, setOpenId] = useState<string | null>(null)

  async function add(type: EntryType) {
    const id = await addRec(db.entries, { projectId, type, name: L('新條目', '新しい項目'), aliases: [], body: '' })
    setOpenId(id)
  }

  return (
    <>
      <div className="hint">{L('本章提到的條目會亮起來。別名也算。', 'この章で触れられた項目が光ります。別名も見ます。')}</div>
      <div className="scroll">
        <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          {TYPES.map((t) => <button key={t.id} onClick={() => add(t.id)}>＋{t.label()}</button>)}
        </div>

        {!entries.length && (
          <div className="empty">
            {L('還沒有設定。', 'まだ何もありません。')}<br />
            {L('先建幾個角色，別名填進去，', 'まず人物をいくつか作り、別名を入れておくと、')}<br />
            {L('內文提到他的時候這裡就會亮。', '本文に出たときここが光ります。')}
          </div>
        )}

        {TYPES.map((t) => {
          const group = entries.filter((e) => e.type === t.id)
          if (!group.length) return null
          return (
            <div key={t.id}>
              <div className="group-label">{t.label()}</div>
              {group.map((e) => openId === e.id ? (
                <div className="card lit" key={e.id}>
                  <div className="field">
                    <label className="lbl">{L('名字', '名前')}</label>
                    <TextInput value={e.name} onCommit={(v) => updRec(db.entries, e.id, { name: v })} />
                  </div>
                  <div className="field">
                    <label className="lbl">{L('別名（用「、」隔開，內文出現這些字也算提到他）', '別名（「、」で区切る。本文にこれらが出ても同じ人物と見なす）')}</label>
                    <TextInput value={e.aliases.join('、')}
                      onCommit={(v) => updRec(db.entries, e.id, { aliases: v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) })} />
                  </div>
                  <div className="field">
                    <label className="lbl">{L('設定', '設定')}</label>
                    <TextArea rows={5} value={e.body} onCommit={(v) => updRec(db.entries, e.id, { body: v })} />
                  </div>
                  <div className="row">
                    <button className="flat" onClick={() => setOpenId(null)}>{L('收合', '閉じる')}</button>
                    <span style={{ flex: 1 }} />
                    <button className="flat danger" onClick={() => { delRec(db.entries, e.id); setOpenId(null) }}>{L('刪除條目', '項目を削除')}</button>
                  </div>
                </div>
              ) : (
                <div className={`card${mentioned.has(e.id) ? ' lit' : ''}`} key={e.id}>
                  <div className="card-top">
                    <strong style={{ flex: 1 }}>{e.name}</strong>
                    {mentioned.has(e.id) && <span className="tag seal">{L('本章', 'この章')}</span>}
                    <button className="flat" onClick={() => setOpenId(e.id)}>{L('編輯', '編集')}</button>
                  </div>
                  <div className="sub">{e.body.slice(0, 110) || L('（還沒寫）', '（未記入）')}{e.body.length > 110 ? '…' : ''}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}
