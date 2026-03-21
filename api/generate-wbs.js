/**
 * /api/generate-wbs.js
 * Vercel Serverless Function — Anthropic API のプロキシ
 *
 * APIキーをサーバーサイドで保持することで
 * ブラウザからキーが漏洩しないようにする
 */

export const config = { maxDuration: 60 }

export default async function handler(req) {
  // POST のみ受け付け
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY が設定されていません' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { projectName, projectDesc } = body
  if (!projectName) {
    return new Response(JSON.stringify({ error: 'projectName は必須です' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

const prompt = `プロジェクト名: ${projectName}
概要: ${projectDesc||'なし'}

以下のJSON形式のみで返答。フェーズ3〜4個、各タスク3個、各サブタスク2個。

{"projectName":"...","summary":"...","totalDuration":"...","phases":[{"id":"ph1","name":"...","duration":"...","owner":"...","tasks":[{"id":"t1","name":"...","duration":"...","owner":"...","subtasks":[{"id":"s1","name":"...","duration":"...","owner":"..."}]}]}]}`
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: `Anthropic API エラー: ${err}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const text = data.content?.map(b => b.text || '').join('') || ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'AIからの応答をJSONとして解析できませんでした' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const wbs = JSON.parse(match[0])

    return new Response(JSON.stringify({ wbs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
