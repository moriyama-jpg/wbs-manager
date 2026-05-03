import { allowedDomain, createServiceClient, isAllowedEmail, requireActiveMember } from './_supabaseAuth.js'

async function findUserByEmail(serviceClient, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    const user = data.users.find(u => u.email?.toLowerCase() === email)
    if (user) return user
    if (data.users.length < 100) break
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let serviceClient
  try {
    ;({ serviceClient } = await requireActiveMember(req, { admin: true }))
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message })
  }

  const email = String(req.body?.email || '').trim().toLowerCase()
  const role = req.body?.role === 'admin' ? 'admin' : 'member'

  if (!isAllowedEmail(email)) {
    return res.status(400).json({ error: `@${allowedDomain} のメールアドレスのみ招待できます` })
  }

  try {
    serviceClient = serviceClient || createServiceClient()
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || 'https://wbs-manager-ten.vercel.app'
    let user
    let alreadyRegistered = false

    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/?reset=1`,
    })

    if (error) {
      if (!/already been registered/i.test(error.message || '')) throw error
      alreadyRegistered = true
      user = await findUserByEmail(serviceClient, email)
      if (!user) throw error

      const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/?reset=1`,
      })
      if (resetError) throw resetError
    } else {
      user = data.user
    }

    const userId = user?.id
    if (!userId) throw new Error('招待ユーザーIDを取得できませんでした')

    const { data: member, error: memberError } = await serviceClient
      .from('members')
      .upsert({
        id: userId,
        email,
        role,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('id,email,role,status')
      .single()

    if (memberError) throw memberError

    return res.status(200).json({ member, alreadyRegistered })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
