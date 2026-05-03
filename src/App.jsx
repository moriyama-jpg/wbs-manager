import { useState, useEffect } from 'react'
import { supabase, fetchCurrentMember } from './lib/supabase'
import Auth from './components/Auth'
import WBSApp from './WBSApp'
import ResetPassword from './components/ResetPassword'

// URLハッシュからSupabaseのエラーを抽出
function getHashError() {
  const hash = window.location.hash
  if (!hash) return null
  const params = new URLSearchParams(hash.substring(1))
  const desc = params.get('error_description')
  if (desc) return decodeURIComponent(desc.replace(/\+/g, ' '))
  return null
}

export default function App() {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(
    () => sessionStorage.getItem('password_recovery') === '1'
  )
  // URLハッシュにエラーがあればAuth画面に渡す（リンク期限切れ等）
  const [hashError] = useState(getHashError)

  useEffect(() => {
    // ハッシュエラーがあればsessionStorageのリカバリーフラグをクリア
    if (hashError) {
      sessionStorage.removeItem('password_recovery')
      setIsRecovery(false)
    }
  }, [hashError])

  useEffect(() => {
    let cancelled = false

    const applySession = async (nextSession) => {
      setSession(nextSession)
      setMember(null)
      setAuthError('')

      if (!nextSession) return

      try {
        const currentMember = await fetchCurrentMember()
        if (cancelled) return
        if (currentMember.status !== 'active') {
          setAuthError('このアカウントは現在利用できません。管理者に確認してください。')
          await supabase.auth.signOut()
          setSession(null)
          return
        }
        setMember(currentMember)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setAuthError('このアカウントには利用権限がありません。管理者からの招待を確認してください。')
        await supabase.auth.signOut()
        setSession(null)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session).finally(() => {
        if (!cancelled) setLoading(false)
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      applySession(session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F5F9' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #DDE3EC', borderTop: '3px solid #1B5FAD', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // パスワードリセットリンクを踏んだ → 新パスワード入力画面
  if (isRecovery) return <ResetPassword onDone={() => { sessionStorage.removeItem('password_recovery'); setIsRecovery(false) }} />

  // 未ログイン → ログイン画面（ハッシュエラーがあれば表示）
  if (!session) return <Auth hashError={hashError} authError={authError} />

  if (!member) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F5F9' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #DDE3EC', borderTop: '3px solid #1B5FAD', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ログイン済み → メインアプリ
  return <WBSApp session={session} member={member} />
}
