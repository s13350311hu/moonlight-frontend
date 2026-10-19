import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, TextRun,
} from 'docx'
import { chapterHtml, DEFAULT_LAYOUT, type Chapter, type Project } from './db'

/** Word 用的字體名。挑在 Windows 和 macOS 都叫得出來的。 */
const DOCX_FONT: Record<string, string> = {
  serif: 'PMingLiU',
  sans: 'Microsoft JhengHei',
  kai: 'DFKai-SB',
  mono: 'Consolas',
}

/** docx 的底線要物件、標記要顏色名稱，不是布林值。 */
interface Marks {
  bold?: boolean
  italics?: boolean
  underline?: Record<string, never>
  strike?: boolean
  color?: string
  highlight?: 'yellow'
}

/** Tiptap 的顏色是 rgb() 或 #rrggbb，docx 要不帶井號的六碼。 */
function hex(color: string): string | undefined {
  const m = color.match(/#([0-9a-f]{6})/i)
  if (m) return m[1].toUpperCase()
  const rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return undefined
}

function alignOf(el: Element): typeof AlignmentType[keyof typeof AlignmentType] | undefined {
  const a = (el as HTMLElement).style?.textAlign
  if (a === 'center') return AlignmentType.CENTER
  if (a === 'right') return AlignmentType.RIGHT
  if (a === 'justify') return AlignmentType.JUSTIFIED
  return undefined
}

/** 把一個區塊元素裡的文字拆成帶格式的 TextRun。 */
function runs(node: Node, inherited: Marks, font: string, size: number): TextRun[] {
  const out: TextRun[] = []
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? ''
      if (!text) return
      out.push(new TextRun({ text, font, size, ...inherited }))
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as HTMLElement
    const m: Marks = { ...inherited }
    switch (el.tagName) {
      case 'STRONG': case 'B': m.bold = true; break
      case 'EM': case 'I': m.italics = true; break
      case 'U': m.underline = {}; break
      case 'S': case 'DEL': case 'STRIKE': m.strike = true; break
      case 'MARK': m.highlight = 'yellow'; break
      case 'BR': out.push(new TextRun({ text: '', break: 1 })); return
    }
    const c = el.style?.color && hex(el.style.color)
    if (c) m.color = c
    out.push(...runs(el, m, font, size))
  })
  return out
}

function para(el: Element, opts: {
  font: string; size: number; indent: number; line: number
  heading?: typeof HeadingLevel[keyof typeof HeadingLevel]
  bullet?: boolean; numbered?: boolean; quote?: boolean
}): Paragraph {
  const children = runs(el, opts.quote ? { italics: true } : {}, opts.font, opts.size)
  const firstLine = opts.heading || opts.bullet || opts.numbered || opts.quote ? 0 : opts.indent
  return new Paragraph({
    children: children.length ? children : [new TextRun({ text: '', font: opts.font, size: opts.size })],
    heading: opts.heading,
    alignment: alignOf(el),
    spacing: { line: opts.line, lineRule: 'auto', after: 0 },
    indent: { firstLine, left: opts.quote ? 480 : undefined },
    ...(opts.bullet ? { bullet: { level: 0 } } : {}),
    ...(opts.numbered ? { numbering: { reference: 'hj-ol', level: 0 } } : {}),
  })
}

export async function toDocxBlob(project: Project, chapters: Chapter[]): Promise<Blob> {
  const L = { ...DEFAULT_LAYOUT, ...(project.layout ?? {}) }
  const font = DOCX_FONT[L.font] ?? DOCX_FONT.serif
  const size = 24                       // half-points，等於 12pt
  const indent = L.indent * 240         // 240 twips = 12pt = 一個字
  const line = Math.round(L.lineHeight * 240)
  const children: Paragraph[] = []

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: project.title, font, size: 40, bold: true })],
  }))
  if (project.logline.trim()) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: project.logline.trim(), font, size: 22, italics: true })],
    }))
  }

  const parser = new DOMParser()
  chapters.forEach((c, i) => {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: i > 0,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text: c.title || `第${i + 1}章`, font, size: 32, bold: true })],
    }))

    const doc = parser.parseFromString(`<body>${chapterHtml(c)}</body>`, 'text/html')
    doc.body.childNodes.forEach((n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return
      const el = n as Element
      const base = { font, size, indent, line }
      switch (el.tagName) {
        case 'H2': children.push(para(el, { ...base, heading: HeadingLevel.HEADING_2 })); break
        case 'H3': children.push(para(el, { ...base, heading: HeadingLevel.HEADING_3 })); break
        case 'UL': el.querySelectorAll(':scope > li').forEach((li) => children.push(para(li, { ...base, bullet: true }))); break
        case 'OL': el.querySelectorAll(':scope > li').forEach((li) => children.push(para(li, { ...base, numbered: true }))); break
        case 'BLOCKQUOTE': el.querySelectorAll(':scope > p').forEach((q) => children.push(para(q, { ...base, quote: true }))); break
        case 'HR':
          children.push(new Paragraph({
            children: [], spacing: { before: 200, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB' } },
          }))
          break
        default: children.push(para(el, base))
      }
    })
  })

  const doc = new Document({
    creator: '行間',
    title: project.title,
    numbering: {
      config: [{
        reference: 'hj-ol',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{ children }],
  })
  return Packer.toBlob(doc)
}

/** HTML 轉 Markdown。只處理編輯器會產生的那幾種標籤。 */
export function toMarkdown(project: Project, chapters: Chapter[]): string {
  const L = { ...DEFAULT_LAYOUT, ...(project.layout ?? {}) }
  const pad = '　'.repeat(L.indent)
  const parser = new DOMParser()
  const out = [`# ${project.title}`]
  if (project.logline.trim()) out.push(`> ${project.logline.trim()}`)

  const inline = (node: Node): string => {
    let s = ''
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) { s += child.textContent ?? ''; return }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const el = child as Element
      const inner = inline(el)
      switch (el.tagName) {
        case 'STRONG': case 'B': s += `**${inner}**`; break
        case 'EM': case 'I': s += `*${inner}*`; break
        case 'S': case 'DEL': case 'STRIKE': s += `~~${inner}~~`; break
        case 'MARK': s += `==${inner}==`; break
        case 'BR': s += '\n'; break
        default: s += inner
      }
    })
    return s
  }

  chapters.forEach((c, i) => {
    out.push('', `## ${c.title || `第${i + 1}章`}`, '')
    const doc = parser.parseFromString(`<body>${chapterHtml(c)}</body>`, 'text/html')
    doc.body.childNodes.forEach((n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return
      const el = n as Element
      const t = inline(el).trim()
      switch (el.tagName) {
        case 'H2': out.push(`### ${t}`, ''); break
        case 'H3': out.push(`#### ${t}`, ''); break
        case 'UL': el.querySelectorAll(':scope > li').forEach((li) => out.push(`- ${inline(li).trim()}`)); out.push(''); break
        case 'OL': el.querySelectorAll(':scope > li').forEach((li, k) => out.push(`${k + 1}. ${inline(li).trim()}`)); out.push(''); break
        case 'BLOCKQUOTE': el.querySelectorAll(':scope > p').forEach((q) => out.push(`> ${inline(q).trim()}`)); out.push(''); break
        case 'HR': out.push('---', ''); break
        default: if (t) out.push(pad + t, ''); else out.push('')
      }
    })
  })
  return out.join('\n')
}
