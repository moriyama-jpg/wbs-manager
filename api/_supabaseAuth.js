import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const allowedDomain = 'flyingcolors.co.jp'

export function isAllowedEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${allowedDomain}`)
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
}

export function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey)
}

export async function requireActiveMember(req, { admin = false } = {}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    const err = new Error('Supabase環境変数が設定されていません')
    err.status = 500
    throw err
  }

  const token = getBearerToken(req)
  if (!token) {
    const err = new Error('ログインが必要です')
    err.status = 401
    throw err
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await authClient.auth.getUser(token)
  if (userError || !user) {
    const err = new Error('ログインが必要です')
    err.status = 401
    throw err
  }

  if (!isAllowedEmail(user.email)) {
    const err = new Error(`@${allowedDomain} のメールアドレスのみ利用できます`)
    err.status = 403
    throw err
  }

  const { data: member, error: memberError } = await authClient
    .from('members')
    .select('id,email,role,status')
    .eq('id', user.id)
    .single()

  if (memberError || !member || member.status !== 'active' || member.email.toLowerCase() !== user.email.toLowerCase()) {
    const err = new Error('利用権限がありません')
    err.status = 403
    throw err
  }

  if (admin && member.role !== 'admin') {
    const err = new Error('管理者権限が必要です')
    err.status = 403
    throw err
  }

  return { user, member, serviceClient: admin ? createServiceClient() : null }
}
