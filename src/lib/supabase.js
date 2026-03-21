import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('.env ファイルに VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)

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
