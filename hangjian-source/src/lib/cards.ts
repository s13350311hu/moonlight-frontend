import { cardWords, DECK, type WordCard } from './deck'

/** 三張卡各自站的位置。對應「場景＝誰想要什麼／什麼擋著／付出什麼」。 */
export const SLOTS = [
  { id: 'push', label: '推力', hint: '讓這一場動起來的東西' },
  { id: 'block', label: '阻力', hint: '擋在中間的東西' },
  { id: 'cost', label: '代價', hint: '這一場結束時有人失去的東西' },
] as const

export interface Card {
  slot: (typeof SLOTS)[number]['id']
  card: WordCard
  /** 0 為正位，1 為逆位。 */
  face: 0 | 1
}

function drawOne(slot: Card['slot'], exclude: number[] = []): Card {
  const pool = DECK.filter((c) => !exclude.includes(c.id))
  const card = pool[Math.floor(Math.random() * pool.length)]
  return { slot, card, face: Math.random() < 0.5 ? 0 : 1 }
}

/** 發三張，不重複。 */
export function drawCards(): Card[] {
  const out: Card[] = []
  for (const slot of SLOTS) out.push(drawOne(slot.id, out.map((c) => c.card.id)))
  return out
}

export function redraw(target: Card, all: Card[]): Card {
  const exclude = all.filter((c) => c !== target).map((c) => c.card.id)
  return drawOne(target.slot, exclude)
}

export function wordsOf(c: Card): string {
  return cardWords(c.card, c.face)
}

/** 同一張卡的正位與逆位往往指向相反的東西，轉一下就是另一種情節。 */
export function faceLabel(c: Card): string {
  return c.face === 0 ? '正位' : '逆位'
}

/** 轉向：正位換逆位，或反過來。 */
export function flip(c: Card): Card {
  return { ...c, face: c.face === 0 ? 1 : 0 }
}

export function slotLabel(c: Card): string {
  return SLOTS.find((s) => s.id === c.slot)!.label
}

export function formatCards(cards: Card[]): string {
  return cards
    .map((c) => `〔${slotLabel(c)}・${faceLabel(c)}〕${wordsOf(c)}\n　　（這張卡轉過來是：${c.card.faces[c.face === 0 ? 1 : 0]}）`)
    .join('\n')
}
