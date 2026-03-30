import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg: '#F2F5F9', surface: '#FFFFFF', border: '#DDE3EC', borderMd: '#C4CCDA',
  accent: '#1B5FAD', accentBg: '#EBF2FC', accentHov: '#154D90',
  text: '#1A2540', textSub: '#4B5A72', textMuted: '#8A97AA',
  danger: '#B91C1C', dangerBg: '#FEF2F2', success: '#0F7B5A',
  shadow: '0 1px 3px rgba(26,37,64,0.08)',
  shadowMd: '0 4px 16px rgba(26,37,64,0.12)',
}

export default function Auth({ hashError }) {
  const [mode, setMode]       = useState(hashError ? 'reset' : 'login')   // 'login' | 'signup' | 'reset'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(hashError || '')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMessage('確認メールを送りました。メールのリンクをクリックしてアカウントを有効化してください。')

      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/?reset=1`,
        })
        if (error) throw error
        setMessage('パスワードリセット用のメールを送りました。')
      }
    } catch (err) {
      const msgs = {
        'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
        'Email not confirmed': 'メールアドレスの確認が完了していません。確認メールをご確認ください',
        'User already registered': 'このメールアドレスはすでに登録されています',
        'Password should be at least 6 characters': 'パスワードは6文字以上で入力してください',
      }
      setError(msgs[err.message] || err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: '100%', background: '#F7F9FC', border: `1px solid ${C.border}`, borderRadius: 5,
    padding: '10px 13px', color: C.text, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, background: C.accent, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>WBS Manager</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>プロジェクト管理ツール</div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 32, boxShadow: C.shadowMd }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 24 }}>
            {mode === 'login' ? 'ログイン' : mode === 'signup' ? 'アカウント作成' : 'パスワードリセット'}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 5 }}>メールアドレス</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="you@example.com" style={inp}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {mode !== 'reset' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, color: C.textMuted, marginBottom: 5 }}>パスワード</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} placeholder="6文字以上" style={inp}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
            )}

            {error && (
              <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}30`, borderRadius: 5, padding: '10px 13px', marginBottom: 16, color: C.danger, fontSize: 13 }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: '#ECFAF5', border: `1px solid ${C.success}30`, borderRadius: 5, padding: '10px 13px', marginBottom: 16, color: C.success, fontSize: 13 }}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: loading ? C.border : C.accent, color: loading ? C.textMuted : '#fff',
              border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
            }}>
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : mode === 'signup' ? 'アカウント作成' : 'リセットメールを送る'}
            </button>
          </form>

          {/* Mode switchers */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {mode === 'login' && <>
              <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13 }}>
                アカウントをお持ちでない方はこちら
              </button>
              <button onClick={() => { setMode('reset'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 12 }}>
                パスワードを忘れた方
              </button>
            </>}
            {mode !== 'login' && (
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 13 }}>
                ← ログインに戻る
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
