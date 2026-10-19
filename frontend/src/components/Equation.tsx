import { useState } from 'react'
import { db, updRec, type Chapter, type Entry, type Project } from '../lib/db'
import { getLang, L } from '../lib/i18n'
import {
  ACTANTS, actantHint, actantLabel, CRAFT, FUNCTIONS, PHASE_LABEL, ROLES,
  roleDomain, roleLabel, type ActantId,
} from '../lib/propp'
import { TextInput } from './Field'

/** 大塚英志《物語の体操》第三講：先把六個行為項填滿，再把三十一個機能鋪成章節。 */
export function Equation({ project, chapters, entries }: {
  project: Project
  chapters: Chapter[]
  entries: Entry[]
}) {
  const [showRoles, setShowRoles] = useState(false)
  const [showCraft, setShowCraft] = useState(false)

  const filled = ACTANTS.filter((a) => (project.actants[a.id] ?? '').trim()).length

  function setActant(id: ActantId, value: string) {
    updRec(db.project, project.id, { actants: { ...project.actants, [id]: value } })
  }

  return (
    <>
      <div className="hint">
        {L('大塚英志《物語の体操》第三講。先填六個行為項，再把機能鋪成章節。',
           '大塚英志『物語の体操』第三講。まず六つの行為者を埋め、次に機能を章に並べる。')}
      </div>
      <div className="scroll">
        <datalist id="entry-names">
          {entries.map((e) => <option key={e.id} value={e.name} />)}
        </datalist>

        <div className="group-label">
          {L('行為項（格雷馬斯）', '行為者（グレマス）')}　{filled}/6
        </div>
        {ACTANTS.map((a) => (
          <div className="field" key={a.id}>
            <label className="lbl">
              {actantLabel(a)}　{getLang() === 'zh' && <span style={{ opacity: 0.65 }}>{a.ja}　</span>}{actantHint(a)}
            </label>
            <TextInput list="entry-names" value={project.actants[a.id] ?? ''}
              placeholder={L('填設定集裡的名字，或直接寫一句', '設定資料の名前か、一行の説明')}
              onCommit={(v) => setActant(a.id, v)} />
          </div>
        ))}

        <button className="flat" style={{ width: '100%', marginBottom: 8 }} onClick={() => setShowRoles(!showRoles)}>
          {showRoles ? L('收起', '閉じる') : L('七種登場人物與他們的行為領域', '七つの登場人物と、その行為の領域')}
        </button>
        {showRoles && (
          <div className="card">
            {ROLES.map((r) => (
              <div key={r.id} style={{ marginBottom: 7 }}>
                <strong>{roleLabel(r)}</strong>{getLang() === 'zh' && <span className="sub">　{r.ja}</span>}
                <div className="sub">{roleDomain(r)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="group-label">{L('章節掛的機能（普羅普）', '章に掛ける機能（プロップ）')}</div>
        {chapters.map((c, i) => (
          <div className="row" key={c.id} style={{ marginBottom: 5 }}>
            <span className="sub" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i + 1}. {c.title}
            </span>
            <select style={{ width: 180 }} value={c.func ?? ''}
              onChange={(e) => updRec(db.chapters, c.id, { func: e.target.value || null })}>
              <option value="">—</option>
              {(['prepare', 'trouble', 'quest', 'trial', 'return', 'settle'] as const).map((phase) => (
                <optgroup key={phase} label={PHASE_LABEL[phase]()}>
                  {FUNCTIONS.filter((f) => f.phase === phase).map((f) => (
                    <option key={f.code} value={f.code}>{f.code}　{f.ja}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ))}

        <button className="flat" style={{ width: '100%', margin: '10px 0 8px' }} onClick={() => setShowCraft(!showCraft)}>
          {showCraft ? L('收起', '閉じる') : L('描寫判準（小説作法ABC 第六章）', '描写の判断基準（『小説作法ABC』第六章）')}
        </button>
        {showCraft && (
          <div className="card">
            {CRAFT.map((c) => (
              <div key={c.title} style={{ marginBottom: 8 }}>
                <strong>{L(c.title, c.jaTitle)}</strong>
                <div className="sub">{L(c.body, c.jaBody)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
