import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('.env ファイルに VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── メンバー権限 ──────────────────────────────────────────────────────────────

/** ログイン中ユーザーのメンバー情報 */
export async function fetchCurrentMember() {
  const { data, error } = await supabase
    .from('members')
    .select('id,email,role,status')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()
  if (error) throw error
  return data
}

/** 管理者用: メンバー一覧 */
export async function fetchMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('id,email,role,status,created_at,updated_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** 管理者用: メンバー招待 */
export async function inviteMember(email, role = 'member') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('ログインが必要です')

  const res = await fetch('/api/invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, role }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '招待に失敗しました')
  return data
}

// ── プロジェクト CRUD ──────────────────────────────────────────────────────

/** 全プロジェクト取得（updated_at 降順） */
export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

/** 単一プロジェクト取得 */
export async function fetchProject(id) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** プロジェクト作成 */
export async function createProject(fields) {
  const { data, error } = await supabase
    .from('projects')
    .insert([fields])
    .select()
    .single()
  if (error) throw error
  return data
}

/** プロジェクト更新 */
export async function updateProject(id, fields) {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** プロジェクト削除 */
export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

/** Realtime 購読（ダッシュボードのリアルタイム更新用） */
export function subscribeProjects(callback) {
  const channel = supabase
    .channel('projects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, callback)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
