export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' })
  }

  const { projectName, projectDesc } = req.body
  if (!projectName) {
    return res.status(400).json({ error: 'projectName は必須です' })
  }

  const prompt = `プロジェクト名: ${projectName}
概要: ${projectDesc || 'なし'}

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
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: `Anthropic API エラー: ${JSON.stringify(data)}` })
    }

    const text = data.content?.map(b => b.text || '').join('') || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return res.status(500).json({ error: 'JSONが取得できませんでした' })
    }

    const wbs = JSON.parse(match[0])
    return res.status(200).json({ wbs })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
