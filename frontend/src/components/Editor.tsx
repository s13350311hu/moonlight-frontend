import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type Editor as TipTapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { L } from '../lib/i18n'

/**
 * extensions 和 editorProps 一定要是模組層級的常數。
 * Tiptap 的 useEditor 每次重繪都會比對 options，而 extensions 是比對物件 identity
 * （@tiptap/react 的 compareOptions）。寫在 render 裡就會每次產生新實例，比對失敗，
 * 於是呼叫 setOptions → view.updateState()，整個編輯器視圖被重置，焦點會被吸過去。
 * 症狀是：在別的欄位打一個字，游標就跳進本文。
 */
const EXTENSIONS = [
  // v3 的 StarterKit 已經含 underline / link / undoRedo，不要再重複加
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Highlight,
]
const EDITOR_PROPS = { attributes: { class: 'prose', spellcheck: 'false' } }

const COLORS = [
  { v: '', label: () => L('預設', '既定') },
  { v: '#A8342A', label: () => L('朱', '朱') },
  { v: '#4C6B45', label: () => L('綠', '緑') },
  { v: '#2F5A7A', label: () => L('藍', '青') },
  { v: '#8A6A1F', label: () => L('褐', '茶') },
  { v: '#8A8E83', label: () => L('灰', '灰') },
]

function Btn({ on, title, onClick, children, wide }: {
  on?: boolean; title: string; onClick: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <button type="button" className={`tb${on ? ' on' : ''}${wide ? ' wide' : ''}`} title={title}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: TipTapEditor }) {
  // 每次按鈕都重新開一條 chain。不要在 render 時就建好共用一條。
  const c = () => editor.chain().focus()
  return (
    <div className="toolbar">
      <Btn title={L('粗體　⌘B', '太字　⌘B')} on={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn title={L('斜體　⌘I', '斜体　⌘I')} on={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn title={L('底線　⌘U', '下線　⌘U')} on={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title={L('刪除線', '取り消し線')} on={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <span className="tb-sep" />
      <Btn title={L('大標', '大見出し')} on={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>H1</Btn>
      <Btn title={L('小標', '小見出し')} on={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>H2</Btn>
      <Btn title={L('項目清單', '箇条書き')} on={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>•</Btn>
      <Btn title={L('編號清單', '番号付き')} on={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>1.</Btn>
      <Btn title={L('引用', '引用')} on={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>❝</Btn>
      <Btn title={L('分隔線', '区切り線')} onClick={() => c().setHorizontalRule().run()}>—</Btn>
      <span className="tb-sep" />
      <Btn title={L('靠左', '左揃え')} on={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}>⇤</Btn>
      <Btn title={L('置中（場景分隔常用）', '中央揃え（場面の区切りに）')} on={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}>≡</Btn>
      <Btn title={L('靠右', '右揃え')} on={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}>⇥</Btn>
      <span className="tb-sep" />
      <Btn title={L('標記起來', 'マーカー')} on={editor.isActive('highlight')} onClick={() => c().toggleHighlight().run()}>▨</Btn>
      <div className="tb-colors">
        {COLORS.map((col) => (
          <button key={col.v || 'none'} type="button" className="swatch" title={L(`文字顏色：${col.label()}`, `文字色：${col.label()}`)}
            style={{ background: col.v || 'transparent', borderColor: col.v || 'var(--line-2)' }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (col.v ? c().setColor(col.v).run() : c().unsetColor().run())}>
            {col.v ? '' : '✕'}
          </button>
        ))}
      </div>
      <span className="tb-sep" />
      <Btn title={L('復原　⌘Z', '取り消し　⌘Z')} onClick={() => c().undo().run()}>↶</Btn>
      <Btn title={L('重做　⇧⌘Z', 'やり直し　⇧⌘Z')} onClick={() => c().redo().run()}>↷</Btn>
    </div>
  )
}

export function Editor({ chapterId, html, onUpdate, onReady }: {
  chapterId: string
  html: string
  /** 每次內容變動都會叫。html 給儲存，text 是純文字投影。 */
  onUpdate: (html: string, text: string) => void
  onReady?: (editor: TipTapEditor) => void
}) {
  const loadedId = useRef<string | null>(null)
  /** 最後一次由這個編輯器送出去的內容。存檔是延遲的，外面繞回來的 html
   *  可能比編輯器裡的還舊；認得出是自己送的就不會被自己蓋掉。 */
  const lastEmitted = useRef('')

  // content 只在建立時用得到。把它當成會變的 option 傳進去，
  // 一樣會讓 compareOptions 失敗、觸發 updateState，所以只取第一次的值。
  const initial = useRef(html)

  const editor = useEditor({
    extensions: EXTENSIONS,
    editorProps: EDITOR_PROPS,
    content: initial.current,
    onUpdate: ({ editor: ed }) => {
      const h = ed.getHTML()
      lastEmitted.current = h
      onUpdate(h, ed.getText())
    },
  })

  useEffect(() => { if (editor && onReady) onReady(editor) }, [editor, onReady])

  // 換章節、或別台裝置同步下來新內容時才換掉內容。
  useEffect(() => {
    if (!editor) return

    if (loadedId.current !== chapterId) {
      loadedId.current = chapterId
      lastEmitted.current = html
      editor.commands.setContent(html, { emitUpdate: false })
      return
    }
    // 同一章。以下任何一種情況都不能動內容：
    if (editor.isFocused) return                 // 使用者正在打
    if (html === lastEmitted.current) return     // 這是自己剛送出去的，繞一圈回來而已
    if (editor.getHTML() === html) return        // 本來就一樣
    editor.commands.setContent(html, { emitUpdate: false })
  }, [editor, chapterId, html])

  if (!editor) return <div className="empty">{L('編輯器載入中…', 'エディタを読み込み中…')}</div>

  return (
    <>
      <Toolbar editor={editor} />
      <div className="editor-wrap"><EditorContent editor={editor} /></div>
    </>
  )
}
