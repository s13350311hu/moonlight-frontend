import { useEffect, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/**
 * 注音、日文這類要組字的輸入法，在組字途中如果外面再把值塞回去一次，
 * 組字就會被打斷，畫面上只剩下沒選字的注音。React 的受控輸入每按一次鍵
 * 就會做這件事，所以這裡改成非受控：值交給 DOM 自己管。
 *
 * 另外，打字期間**完全不寫資料庫**：寫進去會觸發查詢、重繪、同步回寫，
 * 整條鏈路都可能反過來動到這個欄位。停手 500 毫秒、或游標離開這一格，
 * 才把值送出去。這樣打字的時候整條鏈路是安靜的。
 */
function useIME<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  commit: (v: string) => void,
) {
  const ref = useRef<T>(null)
  const composing = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<string | null>(null)
  const commitRef = useRef(commit)
  commitRef.current = commit

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current === null) return
    const v = pending.current
    pending.current = null
    commitRef.current(v)
  }
  const schedule = (v: string) => {
    pending.current = v
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500) as unknown as number
  }

  // 收掉的時候要把還沒送出去的值補送，不然剛打的字會不見
  useEffect(() => () => flush(), [])

  useEffect(() => {
    const el = ref.current
    if (!el || composing.current) return
    // 游標停在這一格、或還有沒送出去的變更，都代表使用者正在用它，別去動
    if (document.activeElement === el || pending.current !== null) return
    if (el.value !== value) el.value = value
  }, [value])

  return {
    ref,
    defaultValue: value,
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: (e: { currentTarget: T }) => {
      composing.current = false
      schedule(e.currentTarget.value)
    },
    onChange: (e: { currentTarget: T }) => {
      // 組字途中的事件不要理，等選完字 compositionend 再算
      if (!composing.current) schedule(e.currentTarget.value)
    },
    onBlur: flush,
  }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & {
  value: string
  onCommit: (v: string) => void
}
export function TextInput({ value, onCommit, onBlur, ...rest }: InputProps) {
  const ime = useIME<HTMLInputElement>(value, onCommit)
  // 外面傳進來的 onBlur 不能被蓋掉，不然「離開欄位就收起來」那種用法會失效
  return <input {...rest} {...ime} onBlur={(e) => { ime.onBlur(); onBlur?.(e) }} />
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'defaultValue'> & {
  value: string
  onCommit: (v: string) => void
}
export function TextArea({ value, onCommit, onBlur, ...rest }: AreaProps) {
  const ime = useIME<HTMLTextAreaElement>(value, onCommit)
  return <textarea {...rest} {...ime} onBlur={(e) => { ime.onBlur(); onBlur?.(e) }} />
}
