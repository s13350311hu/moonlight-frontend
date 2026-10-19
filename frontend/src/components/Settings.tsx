import { useEffect, useState } from 'react'
import { L } from '../lib/i18n'
import { getClient, isConfigured, readConfig, writeConfig } from '../sync/supabase'
import { forcePushAll, subscribeSync, sync, type SyncStatus } from '../sync/syncEngine'

const STATE_LABEL: Record<SyncStatus['state'], () => string> = {
  idle: () => L('已同步', '同期済み'),
  syncing: () => L('同步中…', '同期中…'),
  offline: () => L('離線', 'オフライン'),
  error: () => L('出錯', 'エラー'),
  unconfigured: () => L('還沒設定', '未設定'),
  signedout: () => L('還沒登入', '未ログイン'),
}

export function Settings() {
  const cfg = readConfig()
  const [url, setUrl] = useState(cfg?.url ?? '')
  const [anon, setAnon] = useState(cfg?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [who, setWho] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeSync(setStatus), [])

  useEffect(() => {
    const c = getClient()
    if (!c) return
    c.auth.getUser().then(({ data }) => setWho(data.user?.email ?? null))
    const { data: sub } = c.auth.onAuthStateChange((_e, session) => {
      setWho(session?.user?.email ?? null)
      if (session) void sync()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function saveConfig() {
    setErr(''); setMsg('')
    if (!url.trim() || !anon.trim()) { setErr(L('兩個欄位都要填。', '両方とも入力してください。')); return }
    writeConfig({ url, anonKey: anon })
    setMsg(L('存好了。接著登入。', '保存しました。次はログインです。'))
    void sync()
  }

  async function auth() {
    setErr(''); setMsg(''); setBusy(true)
    try {
      const c = getClient()
      if (!c) { setErr(L('先填 Supabase 網址和 anon key。', '先に Supabase の URL と anon key を入れてください。')); return }
      const { error } = mode === 'in'
        ? await c.auth.signInWithPassword({ email: email.trim(), password: pw })
        : await c.auth.signUp({ email: email.trim(), password: pw })
      if (error) { setErr(error.message); return }
      setMsg(mode === 'in' ? L('登入了。', 'ログインしました。') : L('註冊了。信箱如果要求驗證，去收一下信。', '登録しました。確認メールが届いていたら確認してください。'))
      setPw('')
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="hint">
        {L('同步用的是同一個 Supabase 專案的 records 表。填上網址和 key、登入之後，不同裝置看到的就是同一份稿子。',
           '同期には同じ Supabase の records 表を使います。URL と key を入れてログインすれば、どの端末でも同じ原稿になります。')}
      </div>
      <div className="scroll">
        <div className="group-label">{L('同步狀態', '同期の状態')}</div>
        <div className="card">
          <div className="card-top">
            <span className={`sync-dot ${status?.state ?? 'unconfigured'}`} />
            <strong style={{ flex: 1 }}>{status ? STATE_LABEL[status.state]() : '—'}</strong>
            <button className="flat" onClick={() => void sync()}>{L('立即同步', 'いま同期')}</button>
          </div>
          <div className="sub">
            {who ? L(`已登入：${who}`, `ログイン中：${who}`) : L('尚未登入', '未ログイン')}
            {status?.pending ? L(`　·　${status.pending} 筆等著上傳`, `　·　送信待ち ${status.pending} 件`) : ''}
            {status?.lastSyncAt ? L(`　·　上次 ${new Date(status.lastSyncAt).toLocaleString('zh-TW')}`, `　·　前回 ${new Date(status.lastSyncAt).toLocaleString('ja-JP')}`) : ''}
          </div>
          {status?.message && <div className="sub" style={{ marginTop: 4 }}>{status.message}</div>}
        </div>

        <div className="group-label">Supabase</div>
        <div className="field">
          <label className="lbl">{L('專案網址', 'プロジェクトの URL')}</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </div>
        <div className="field">
          <label className="lbl">anon key</label>
          <input value={anon} onChange={(e) => setAnon(e.target.value)} placeholder="eyJ…" />
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={saveConfig} style={{ flex: 1 }}>{L('儲存設定', '設定を保存')}</button>
          {isConfigured() && <button className="flat danger" onClick={() => { writeConfig(null); setUrl(''); setAnon(''); setMsg(L('清掉了。', '消しました。')) }}>{L('清除', '消す')}</button>}
        </div>

        <div className="group-label">{L('帳號', 'account')}</div>
        {who ? (
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="sub" style={{ flex: 1 }}>{who}</span>
            <button className="flat" onClick={() => void getClient()?.auth.signOut()}>{L('登出', 'ログアウト')}</button>
          </div>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 8 }}>
              <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')} style={{ flex: 1 }}>{L('登入', 'ログイン')}</button>
              <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')} style={{ flex: 1 }}>{L('註冊', '新規登録')}</button>
            </div>
            <div className="field">
              <label className="lbl">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label className="lbl">{L('密碼', 'パスワード')}</label>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                onKeyDown={(e) => { if (e.key === 'Enter') void auth() }} />
            </div>
            <div className="row" style={{ marginBottom: 12 }}>
              <button onClick={() => void auth()} disabled={busy} style={{ flex: 1 }}>
                {busy ? L('處理中…', '処理中…') : mode === 'in' ? L('登入', 'ログイン') : L('註冊', '新規登録')}
              </button>
            </div>
          </>
        )}

        {err && <div className="err">{err}</div>}
        {msg && <div className="ok-msg">{msg}</div>}

        <div className="group-label">{L('修復', '修復')}</div>
        <div className="row">
          <button className="flat" style={{ flex: 1 }} onClick={async () => {
            await forcePushAll(); setMsg(L('全部標成待上傳了，正在推。', 'すべてを送信待ちにしました。送信中です。')); void sync()
          }}>{L('把本機整包重新上傳', '手もとの全部を送り直す')}</button>
        </div>
        <div className="sub" style={{ marginTop: 6 }}>
          {L('雲端跟本機對不起來的時候用。它只會把本機的版本推上去，不會刪掉雲端已有的東西。',
             'クラウドと手もとが食い違うときに使います。手もとの版を送るだけで、クラウドにあるものを消すことはありません。')}
        </div>
      </div>
    </>
  )
}
