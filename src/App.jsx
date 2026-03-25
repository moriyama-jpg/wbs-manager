import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import WBSApp from './WBSApp'
import ResetPassword from './components/ResetPassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    // 初回: 現在のセッションを取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // ログイン/ログアウト/パスワードリセットを監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)  // ← リセットリンクを踏んだ時
      } else {
        setIsRecovery(false)
      }
      setSession(session)
    })

    return () => subscription.unsubscribe()
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
  if (isRecovery) return <ResetPassword onDone={() => setIsRecovery(false)} />

  // 未ログイン → ログイン画面
  if (!session) return <Auth />

  // ログイン済み → メインアプリ
  return <WBSApp session={session} />
}
