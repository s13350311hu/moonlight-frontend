import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addRec, alive, db, delRec, updRec, type Sketch } from '../lib/db'
import { cardWords, DECK } from '../lib/deck'
import { L } from '../lib/i18n'
import { TextArea, TextInput } from './Field'

/** 三張卡各自站的位置。對應「場景＝誰想要什麼／什麼擋著／付出什麼」。 */
const SLOTS = [
  { label: () => L('推力', '推進力'), hint: () => L('讓這一場動起來的東西', 'この場面を動かすもの') },
  { label: () => L('阻力', '障害'), hint: () => L('擋在中間的東西', '間に立ちはだかるもの') },
  { label: () => L('代價', '代償'), hint: () => L('這一場結束時有人失去的東西', 'この場面の終わりに誰かが失うもの') },
] as const

/**
 * 《物語の体操》第一講圖 6 的六個位置。排法是十字：
 *        3 過去
 *        1 現在
 *   5 敵對  2 近未來  4 援助
 *        6 結局
 */
const SPREAD = [
  { n: 1, label: () => L('主角的現在', '主人公の現在'), short: () => L('現在', '現在'), hint: () => L('他此刻的處境，故事從這裡開始', 'いまの境遇。物語はここから始まる') },
  { n: 2, label: () => L('主角的近未來', '主人公の近い未来'), short: () => L('近未來', '近い未来'), hint: () => L('照這樣下去，馬上要發生的事', 'このままなら、すぐに起きること') },
  { n: 3, label: () => L('主角的過去', '主人公の過去'), short: () => L('過去', '過去'), hint: () => L('他帶著什麼走到今天', '何を抱えてここまで来たか') },
  { n: 4, label: () => L('援助者', '援助者'), short: () => L('援助', '援助'), hint: () => L('幫他的人，或幫他的東西', '助ける人、あるいは助けるもの') },
  { n: 5, label: () => L('敵對者', '敵対者'), short: () => L('敵對', '敵対'), hint: () => L('擋住他的人，或擋住他的東西', '阻む人、あるいは阻むもの') },
  { n: 6, label: () => L('結局（目的）', '結末（目的）'), short: () => L('結局', '結末'), hint: () => L('最後落在哪裡，他要的到底是什麼', 'どこに落ち着くか。結局なにが欲しかったのか') },
] as const

interface Drawn { n: number; face: 0 | 1 }

/**
 * 面板切走再切回來，元件會被卸載，排好的牌和寫到一半的字就沒了。
 * 所以把當下的工作狀態另外存一份在本機（依作品分開），
 * 換分頁、重新整理、關掉再開都還在。真正要留起來的練習才寫進 sketches。
 */
interface Scratch { scene: Drawn[]; cards: Drawn[]; parts: string[]; story: string; id: string | null }
const EMPTY: Scratch = { scene: [], cards: [], parts: [], story: '', id: null }
const scratchKey = (pid: string) => `hj.cards.${pid}`

function loadScratch(pid: string): Scratch {
  try {
    const raw = localStorage.getItem(scratchKey(pid))
    if (!raw) return { ...EMPTY }
    return { ...EMPTY, ...JSON.parse(raw) }
  } catch { return { ...EMPTY } }
}
function saveScratch(pid: string, patch: Partial<Scratch>) {
  try {
    localStorage.setItem(scratchKey(pid), JSON.stringify({ ...loadScratch(pid), ...patch }))
  } catch { /* 無痕視窗之類的，存不進去就算了 */ }
}

function drawOne(exclude: number[]): Drawn {
  const pool = DECK.map((_, i) => i).filter((i) => !exclude.includes(i))
  return { n: pool[Math.floor(Math.random() * pool.length)], face: Math.random() < 0.5 ? 0 : 1 }
}
function drawMany(count: number): Drawn[] {
  const out: Drawn[] = []
  for (let i = 0; i < count; i++) out.push(drawOne(out.map((c) => c.n)))
  return out
}
const wordsOf = (c: Drawn) => cardWords(DECK[c.n], c.face)
const faceOf = (c: Drawn) => (c.face === 0 ? L('正位', '正位置') : L('逆位', '逆位置'))

export function Cards({ projectId, onAppend }: { projectId: string; onAppend: (text: string) => void }) {
  const [mode, setMode] = useState<'scene' | 'story'>('scene')
  return (
    <>
      <div className="mode-row" style={{ padding: '8px 8px 0' }}>
        <button className={mode === 'scene' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('scene')}>{L('接下一場', '次の場面')}</button>
        <button className={mode === 'story' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('story')}>{L('用卡牌寫故事', 'カードで物語を書く')}</button>
      </div>
      {mode === 'scene' ? <SceneCards projectId={projectId} /> : <StoryCards projectId={projectId} onAppend={onAppend} />}
    </>
  )
}

/** 三張卡，給眼前這一場用。 */
function SceneCards({ projectId }: { projectId: string }) {
  const [cards, setRaw] = useState<Drawn[]>(() => loadScratch(projectId).scene)
  const setCards = (next: Drawn[]) => { setRaw(next); saveScratch(projectId, { scene: next }) }
  useEffect(() => { setRaw(loadScratch(projectId).scene) }, [projectId])
  return (
    <>
      <div className="hint">{L('三張字卡，分別站在推力、阻力、代價上。每張有正位和逆位，可以轉向。', '三枚のカードを推進力・障害・代償の位置に置く。正位置と逆位置があり、向きを変えられる。')}</div>
      <div className="scroll">
        <div className="row" style={{ marginBottom: 8 }}>
          <button style={{ flex: 1 }} onClick={() => setCards(drawMany(3))}>{cards.length ? L('整副重發', '引き直す') : L('發三張', '三枚引く')}</button>
        </div>
        {!cards.length && (
          <div className="empty">
            {L('卡上只有一組詞，不指涉任何東西。', 'カードには言葉の組しかない。何かを指してはいない。')}<br />
            {L('用處是丟一組不相干的詞進來，逼你接。', '役目は、無関係な言葉を投げ込んでつながせること。')}<br /><br />
            {L('接的時候不要問它象徵什麼——', 'つなぐとき、それが何の象徴かは問わない。')}<br />
            {L('問它在你這一場裡具體是什麼東西。', 'この場面で具体的に何なのかを問う。')}
          </div>
        )}
        {cards.map((c, i) => (
          <div className="draw-card" key={i}>
            <div className="card-top">
              <span className="tag seal">{SLOTS[i].label()}</span>
              <span className="sub" style={{ flex: 1 }}>{faceOf(c)}</span>
              <button className="flat" title={L('轉向（正位⇄逆位）', '向きを変える（正位置⇄逆位置）')}
                onClick={() => setCards(cards.map((x, j) => (j === i ? { ...x, face: x.face === 0 ? 1 : 0 } : x)))}>⇄</button>
              <button className="flat" title={L('換一張', '引き直す')}
                onClick={() => setCards(cards.map((x, j) => (j === i ? drawOne(cards.filter((_, k) => k !== i).map((y) => y.n)) : x)))}>↻</button>
            </div>
            <div className="sub">{SLOTS[i].hint()}</div>
            <div className="draw-words">{wordsOf(c)}</div>
          </div>
        ))}
        {cards.length > 0 && <div className="note">{L('正位和逆位往往指向相反的東西。同一組卡轉一下，就是另一種情節。', '正位置と逆位置はたいてい反対を向く。同じ組でも、向きを変えれば別の筋になる。')}</div>}
      </div>
    </>
  )
}

/** 《物語の体操》第一講：六張牌排成十字，讀成一個故事的骨架，然後把它寫出來。 */
function StoryCards({ projectId, onAppend }: { projectId: string; onAppend: (text: string) => void }) {
  const [id, setId] = useState<string | null>(() => loadScratch(projectId).id)
  const [cards, setCardsRaw] = useState<Drawn[]>(() => loadScratch(projectId).cards)
  const [parts, setPartsRaw] = useState<string[]>(() => loadScratch(projectId).parts)
  const [story, setStoryRaw] = useState(() => loadScratch(projectId).story)
  const [msg, setMsg] = useState('')
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const sc = loadScratch(projectId)
    setCardsRaw(sc.cards); setPartsRaw(sc.parts); setStoryRaw(sc.story); setId(sc.id)
  }, [projectId])

  /** 每次改動：先寫本機暫存，再排一次自動存檔（有寫東西才會真的存成練習）。 */
  function keep(next: { cards?: Drawn[]; parts?: string[]; story?: string }) {
    const c = next.cards ?? cards
    const p = next.parts ?? parts
    const st = next.story ?? story
    if (next.cards) setCardsRaw(next.cards)
    if (next.parts) setPartsRaw(next.parts)
    if (next.story !== undefined) setStoryRaw(next.story)
    saveScratch(projectId, { cards: c, parts: p, story: st })
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void autosave(c, p, st) }, 900) as unknown as number
  }

  async function autosave(c: Drawn[], p: string[], st: string) {
    const hasContent = st.trim() || p.some((x) => x.trim())
    if (!hasContent || !c.length) return
    const title = (st.trim().slice(0, 18) || p.find((x) => x.trim())?.slice(0, 18) || L('未命名練習', '無題の練習')).replace(/\n/g, ' ')
    if (id) {
      await updRec(db.sketches, id, { title, cards: c, parts: p, story: st })
    } else {
      const newId = await addRec(db.sketches, { projectId, title, cards: c, parts: p, story: st, createdAt: Date.now() })
      setId(newId)
      saveScratch(projectId, { id: newId })
    }
  }

  const saved = useLiveQuery(async () => alive(await db.sketches.toArray()).sort((a, b) => b.createdAt - a.createdAt), [], [] as Sketch[])

  function start() {
    // 重發是開一份新練習，不要蓋掉上一份存好的
    setId(null); setMsg('')
    saveScratch(projectId, { id: null })
    keep({ cards: drawMany(6), parts: Array(6).fill(''), story: '' })
  }
  function open(s: Sketch) {
    setId(s.id); setMsg('')
    saveScratch(projectId, { id: s.id })
    keep({ cards: s.cards, parts: s.parts, story: s.story ?? '' })
  }
  function clear() {
    setId(null); setMsg('')
    saveScratch(projectId, { id: null })
    keep({ cards: [], parts: [], story: '' })
  }
  function addWild() {
    keep({ cards: [...cards, drawOne(cards.map((c) => c.n))], parts: [...parts, ''] })
  }

  async function persist() {
    const title = (story.trim().slice(0, 18) || parts.find((p) => p.trim())?.slice(0, 18) || L('未命名練習', '無題の練習')).replace(/\n/g, ' ')
    if (id) await updRec(db.sketches, id, { title, cards, parts, story })
    else setId(await addRec(db.sketches, { projectId, title, cards, parts, story, createdAt: Date.now() }))
    setMsg(L('存好了。', '保存しました。'))
  }

  return (
    <>
      <div className="hint">
        {L('六張排成十字，分別是主角的現在、近未來、過去、援助者、敵對者、結局。讀成一個故事的骨架，再把它寫出來。',
           '六枚を十字に並べる。主人公の現在・近い未来・過去・援助者・敵対者・結末。物語の骨組みとして読み、それを書き出す。')}
      </div>
      <div className="scroll">
        {!cards.length ? (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <button style={{ flex: 1 }} onClick={start}>{L('發六張', '六枚引く')}</button>
            </div>
            <div className="spread">
              <div className="sp mid"><b>3</b>{L('過去', '過去')}</div>
              <div className="sp mid"><b>1</b>{L('現在', '現在')}</div>
              <div className="sp"><b>5</b>{L('敵對者', '敵対者')}</div>
              <div className="sp"><b>2</b>{L('近未來', '近い未来')}</div>
              <div className="sp"><b>4</b>{L('援助者', '援助者')}</div>
              <div className="sp mid"><b>6</b>{L('結局', '結末')}</div>
            </div>
            <div className="empty">
              卡上只有一組詞，不指涉任何東西。<br />
              把它放進位置裡才有意思——<br />
              「解放」落在敵對者上，那個擋路的人就是來鬆開什麼的。
            </div>
          </>
        ) : (
          <>
            <div className="spread">
              {[3, 1, 5, 2, 4, 6].map((num, slot) => {
                const pos = SPREAD.find((p) => p.n === num)!
                const mid = slot === 0 || slot === 1 || slot === 5
                return (
                  <div className={`sp${mid ? ' mid' : ''}${parts[num - 1]?.trim() ? ' done' : ''}`} key={num}>
                    <b>{num}</b>{pos.short()}
                  </div>
                )
              })}
            </div>

            <div className="row" style={{ marginBottom: 8 }}>
              <button className="flat" onClick={start}>{L('整副重發', '引き直す')}</button>
              <span style={{ flex: 1 }} />
              <button className="flat" onClick={clear}>{L('清掉', '消す')}</button>
            </div>

            {cards.map((c, i) => {
              const pos = SPREAD[i]
              return (
                <div className="draw-card" key={i} style={{ marginBottom: 10 }}>
                  <div className="card-top">
                    <span className="tag seal">{pos ? `${pos.n}　${pos.label()}` : L('額外', '追加')}</span>
                    <span className="sub" style={{ flex: 1 }}>{faceOf(c)}</span>
                    <button className="flat" title={L('轉向（正位⇄逆位）', '向きを変える（正位置⇄逆位置）')}
                      onClick={() => keep({ cards: cards.map((x, j) => (j === i ? { ...x, face: x.face === 0 ? 1 : 0 } : x)) })}>⇄</button>
                    <button className="flat" title={L('換一張', '引き直す')}
                      onClick={() => keep({ cards: cards.map((x, j) => (j === i ? drawOne(cards.filter((_, k) => k !== i).map((y) => y.n)) : x)) })}>↻</button>
                    {!pos && (
                      <button className="flat danger" title={L('拿掉', '外す')}
                        onClick={() => keep({ cards: cards.filter((_, j) => j !== i), parts: parts.filter((_, j) => j !== i) })}>✕</button>
                    )}
                  </div>
                  {pos && <div className="sub">{pos.hint()}</div>}
                  <div className="draw-words" style={{ marginBottom: 6 }}>{wordsOf(c)}</div>
                  <TextInput placeholder={pos
                    ? L(`這張在你的故事裡的「${pos.short()}」是什麼？`, `この一枚は、あなたの物語の「${pos.short()}」では何か。`)
                    : L('這張是什麼？', 'この一枚は何か。')}
                    value={parts[i] ?? ''} onCommit={(v) => keep({ parts: parts.map((x, j) => (j === i ? v : x)) })} />
                </div>
              )
            })}

            <div className="row" style={{ marginBottom: 10 }}>
              <button className="flat" onClick={addWild}>{L('插一張不相干的', '無関係な一枚を差す')}</button>
            </div>

            <div className="group-label">{L('把六張接起來', '六枚をつなぐ')}</div>
            <TextArea rows={10} placeholder={L('從現在寫起，或從過去寫起都行。六張都要用上。', '現在から書いても、過去から書いてもいい。六枚すべて使う。')}
              value={story} onCommit={(v) => keep({ story: v })} />

            <div className="row" style={{ margin: '8px 0 6px' }}>
              <span className="sub" style={{ flex: 1 }}>{story.replace(/\s/g, '').length}{L(' 字', ' 字')}</span>
              <button className="flat" onClick={persist}>{L('存起來', '保存する')}</button>
            </div>
            <div className="row">
              <button style={{ flex: 1 }} disabled={!story.trim()} onClick={() => { onAppend(story.trim()); setMsg(L('接到稿子後面了。', '本文の末尾につなぎました。')) }}>{L('接進稿子', '本文につなぐ')}</button>
              <button className="flat" disabled={!story.trim()} onClick={async () => {
                await addRec(db.notes, { projectId, body: story.trim(), source: '卡牌練習', createdAt: Date.now() })
                setMsg(L('存成素材了。', '素材として保存しました。'))
              }}>{L('存成素材', '素材として保存')}</button>
            </div>
            {msg && <div className="ok-msg">{msg}</div>}
          </>
        )}

        {saved.length > 0 && (
          <>
            <div className="group-label">{L(`存過的練習 ${saved.length} 則`, `保存した練習 ${saved.length} 件`)}</div>
            {saved.map((s) => (
              <div className="card" key={s.id}>
                <div className="card-top">
                  <strong style={{ flex: 1 }}>{s.title}</strong>
                  <button className="flat" onClick={() => open(s)}>{L('開啟', '開く')}</button>
                  <button className="flat danger" onClick={() => { delRec(db.sketches, s.id); if (id === s.id) clear() }}>{L('刪', '削除')}</button>
                </div>
                <div className="sub">{new Date(s.createdAt).toLocaleDateString(L('zh-TW', 'ja-JP'))}　·　{s.cards.length}{L(' 張', ' 枚')}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
