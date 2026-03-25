import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F2F5F9', surface: '#FFFFFF', border: '#DDE3EC',
  accent: '#1B5FAD', text: '#1A2540', textMuted: '#8A97AA',
  danger: '#B91C1C', dangerBg: '#FEF2F2',
  success: '#0F7B5A', shadowMd: '0 4px 16px rgba(26,37,64,0.12)',
}

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('パスワードが一致しません'); return }
    if (password.length < 6) { setError('パスワードは6文字以上で入力してください'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => onDone(), 2000)
  }

  const inp = {
    width: '100%', background: '#F7F9FC', border: `1px solid ${C.border}`,
    borderRadius: 5, padding: '10px 13px', color: C.text, fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.accent, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>🔑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>新しいパスワードを設定</div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, boxShadow: C.shadowMd }}>
          {done ? (
            <div style={{ textAlign: 'center', color: C.success, fontSize: 15 }}>
              ✅ パスワードを更新しました。ログイン画面に戻ります…
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 5 }}>新しいパスワード</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="6文字以上" style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 5 }}>パスワード（確認）</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} placeholder="もう一度入力" style={inp} />
              </div>
              {error && (
                <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}30`, borderRadius: 5, padding: '10px 13px', marginBottom: 16, color: C.danger, fontSize: 13 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? C.border : C.accent, color: '#fff', border: 'none', borderRadius: 6, padding: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '更新中...' : 'パスワードを更新する'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
