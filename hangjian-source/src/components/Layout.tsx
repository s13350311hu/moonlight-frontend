import { useState } from 'react'
import { db, DEFAULT_LAYOUT, updRec, type LayoutPrefs, type Project } from '../lib/db'
import { getLang, L, setLang } from '../lib/i18n'
import { TextInput } from './Field'

const FONTS: { id: LayoutPrefs['font']; label: () => string; note: () => string }[] = [
  { id: 'serif', label: () => L('宋體', '明朝'), note: () => L('預設。長篇閱讀最不累', '既定。長く読んでも疲れにくい') },
  { id: 'sans', label: () => L('黑體', 'ゴシック'), note: () => L('筆畫均勻，螢幕上清楚', '線が均一で、画面ではっきり見える') },
  { id: 'kai', label: () => L('楷體', '楷書'), note: () => L('像手寫稿。系統沒有的話會退回宋體', '手書き原稿のよう。無い環境では明朝に戻る') },
  { id: 'mono', label: () => L('等寬', '等幅'), note: () => L('每個字佔一格，方便數字數', '一字が一マス。文字数を数えやすい') },
]

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div className="field">
      <label className="lbl">
        {label}
        <span style={{ float: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Number.isInteger(value) ? value : value.toFixed(2)}{unit ?? ''}
        </span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export function Layout({ project, projects, onDelete }: {
  project: Project
  projects: Project[]
  onDelete: (id: string) => void
}) {
  const Lp = { ...DEFAULT_LAYOUT, ...(project.layout ?? {}) }
  const [armed, setArmed] = useState(false)
  const lang = getLang()
  const set = (patch: Partial<LayoutPrefs>) =>
    updRec(db.project, project.id, { layout: { ...Lp, ...patch } })

  return (
    <>
      <div className="hint">
        {L('整份稿子的版面。設定存在作品上，所以每台裝置看到的樣子一致。',
           '原稿全体の組版。設定は作品に保存されるので、どの端末でも同じ見た目になる。')}
      </div>
      <div className="scroll">
        <div className="group-label">{L('介面語言', '表示言語')}</div>
        <div className="row" style={{ marginBottom: 14 }}>
          <button className={lang === 'zh' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('zh')}>中文</button>
          <button className={lang === 'ja' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setLang('ja')}>日本語</button>
        </div>

        <div className="group-label">{L('這部作品', 'この作品')}</div>
        <div className="field">
          <label className="lbl">{L('名稱', '題名')}</label>
          <TextInput value={project.title} onCommit={(v) => updRec(db.project, project.id, { title: v })} />
        </div>
        <div className="field">
          <label className="lbl">{L('一句話大綱', '一行のあらすじ')}</label>
          <TextInput value={project.logline} placeholder={L('誰、想要什麼、什麼擋著', '誰が、何を求め、何に阻まれるか')}
            onCommit={(v) => updRec(db.project, project.id, { logline: v })} />
        </div>
        {projects.length > 1 && (
          <>
            <div className="row" style={{ marginBottom: 6 }}>
              <button className="danger" style={{ flex: 1 }}
                onClick={() => { if (armed) { onDelete(project.id); setArmed(false) } else { setArmed(true); setTimeout(() => setArmed(false), 4000) } }}>
                {armed ? L('再按一次，整部刪掉', 'もう一度押すと、作品ごと消えます') : L('刪掉這部作品', 'この作品を削除')}
              </button>
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>
              {L('章節、設定集、伏筆、素材、卡牌練習會一起消失，其他裝置同步後也會跟著消失。',
                 '章・設定資料・伏線・素材・カードの練習も一緒に消え、同期後は他の端末からも消えます。')}
            </div>
          </>
        )}

        <div className="group-label">{L('字體', '書体')}</div>
        <div className="row" style={{ flexWrap: 'wrap', marginBottom: 4 }}>
          {FONTS.map((f) => (
            <button key={f.id} className={Lp.font === f.id ? 'on' : ''} onClick={() => set({ font: f.id })}>{f.label()}</button>
          ))}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>{FONTS.find((f) => f.id === Lp.font)!.note()}</div>

        <div className="group-label">{L('尺寸', '大きさ')}</div>
        <Slider label={L('字級', '文字サイズ')} value={Lp.size} min={13} max={26} step={1} unit=" px" onChange={(v) => set({ size: v })} />
        <Slider label={L('行距', '行間')} value={Lp.lineHeight} min={1.4} max={3} step={0.05} onChange={(v) => set({ lineHeight: v })} />
        <Slider label={L('字距', '字間')} value={Lp.letterSpacing} min={0} max={0.2} step={0.01} unit=" em" onChange={(v) => set({ letterSpacing: v })} />
        <Slider label={L('版心寬度', '一行の幅')} value={Lp.measure} min={26} max={64} step={1} unit=" rem" onChange={(v) => set({ measure: v })} />
        <div className="sub" style={{ marginBottom: 12 }}>
          {L('版心太寬，眼睛從行尾找回行首就會吃力。中文一行大約二十八到三十五個字最好讀。',
             '一行が長すぎると、行末から行頭に戻るのが辛くなる。日本語なら一行二十八〜三十五字あたりが読みやすい。')}
        </div>

        <div className="group-label">{L('段落縮排', '段落の字下げ')}</div>
        <div className="row" style={{ marginBottom: 6 }}>
          {([0, 1, 2] as const).map((n) => (
            <button key={n} className={Lp.indent === n ? 'on' : ''} style={{ flex: 1 }} onClick={() => set({ indent: n })}>
              {n === 0 ? L('不縮排', '下げない') : L(`${n} 格`, `${n} 字`)}
            </button>
          ))}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>
          {L('每段首行縮排，寫的時候就看得到。匯出 Word 會變成真正的首行縮排屬性，匯出 Markdown 則在段落開頭補上等量的全形空格。',
             '各段落の一行目を下げる。書いている最中から見える。Word へ書き出すと本物の字下げになり、Markdown では段落の先頭に全角空白が入る。')}
        </div>

        <div className="group-label">{L('預覽', 'プレビュー')}</div>
        <div className="card" style={{
          fontFamily: 'var(--ed-font)', fontSize: `${Math.min(Lp.size, 17)}px`,
          lineHeight: Lp.lineHeight, letterSpacing: `${Lp.letterSpacing}em`,
        }}>
          <span style={{ display: 'block', textIndent: `${Lp.indent}em` }}>
            {L('阿澤把菸按熄在紙杯裡，水面浮起一層灰。他沒有抬頭。',
               '男は煙草を紙コップに押しつけた。水面に灰が浮いた。顔は上げなかった。')}
          </span>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="flat" style={{ flex: 1 }} onClick={() => set({ ...DEFAULT_LAYOUT })}>{L('回到預設', '既定に戻す')}</button>
        </div>
      </div>
    </>
  )
}
