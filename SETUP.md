# WBS Manager — セットアップ手順書

テレワークメンバーとプロジェクトWBSを共同編集できる Web アプリを  
**Supabase + Vercel** の無料枠で公開するまでの手順です。

---

## 必要なもの（すべて無料）

| ツール | 用途 | 登録先 |
|--------|------|--------|
| GitHub アカウント | ソースコード管理 | https://github.com |
| Supabase アカウント | DB・認証・リアルタイム | https://supabase.com |
| Vercel アカウント | ホスティング（GitHub連携） | https://vercel.com |
| Node.js 18 以上 | ローカル開発 | https://nodejs.org |

---

## STEP 1 — GitHub にコードをアップロード

```bash
# 1. GitHubで新しいリポジトリを作成（例: wbs-manager）
# 2. ローカルで初期化

cd wbs-manager          # このフォルダに解凍したファイルを置く
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/wbs-manager.git
git push -u origin main
```

---

## STEP 2 — Supabase プロジェクトを作成

1. https://supabase.com にログイン → **「New project」**
2. 以下を入力：
   - **Project name**: `wbs-manager`
   - **Database Password**: 任意のパスワード（メモしておく）
   - **Region**: `Northeast Asia (Tokyo)` を選択
3. 作成完了まで約1分待つ

---

## STEP 3 — データベースを初期化

1. Supabase ダッシュボード左メニュー → **「SQL Editor」**
2. **「New query」** をクリック
3. `schema.sql` の内容をすべてコピー＆ペーストして **「Run」**
4. 画面下に `Success` と表示されれば完了

---

## STEP 4 — Supabase の API キーを確認

1. 左メニュー → **「Settings」** → **「API」**
2. 以下をメモ（後で使います）：
   - **Project URL** : `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public** キー（長い文字列）

---

## STEP 5 — ローカルで動作確認

```bash
# 依存パッケージのインストール
npm install

# .env ファイルを作成
cp .env.example .env.local
```

`.env.local` を開いて編集：

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co   ← STEP 4 の URL
VITE_SUPABASE_ANON_KEY=eyJhbGci...                   ← STEP 4 の anon キー
ANTHROPIC_API_KEY=sk-ant-...                          ← Anthropic Console の APIキー
```

```bash
# 開発サーバーを起動（Vercel Dev が必要: npm i -g vercel）
vercel dev

# または Vite のみ（/api/* は動かないがUIは確認できる）
npm run dev
```

ブラウザで http://localhost:5173 を開いてログイン画面が出ればOK。

---

## STEP 6 — Vercel にデプロイ

### 6-1. Vercel とリポジトリを連携

1. https://vercel.com にログイン → **「New Project」**
2. **「Import Git Repository」** で STEP 1 の GitHub リポジトリを選択
3. **Framework Preset**: `Vite` を選択
4. **「Deploy」** は押さず、まず環境変数を設定する

### 6-2. 環境変数を登録（重要）

Vercel の **「Environment Variables」** セクションに以下を登録：

| 変数名 | 値 | 対象環境 |
|--------|-----|---------|
| `VITE_SUPABASE_URL` | Supabase の Project URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Supabase の anon キー | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | Anthropic の APIキー | **Production のみ** |

> ⚠️ `ANTHROPIC_API_KEY` は絶対に `VITE_` プレフィックスを付けないでください。  
> `VITE_` を付けるとブラウザに露出してしまいます。

### 6-3. デプロイ実行

**「Deploy」** ボタンをクリック → 2〜3分でデプロイ完了。  
`https://wbs-manager-xxx.vercel.app` のようなURLが発行されます。

---

## STEP 7 — チームメンバーを招待

### メール招待の方法

Supabase ダッシュボード → **「Authentication」** → **「Users」** → **「Invite user」**  
メールアドレスを入力して送信。招待メールのリンクをクリックするとアカウント作成完了。

### または：メンバー自身がサインアップ

デプロイしたURL（例: `https://wbs-manager-xxx.vercel.app`）にアクセスしてもらい、  
ログイン画面の **「アカウントをお持ちでない方はこちら」** からサインアップ。

> 💡 不特定多数のサインアップを防ぎたい場合は  
> Supabase → Settings → Authentication → **「Disable sign-ups」** をONにして  
> 管理者招待のみに限定できます。

---

## STEP 8 — 独自ドメインを設定（任意）

1. Vercel ダッシュボード → プロジェクト → **「Settings」** → **「Domains」**
2. 取得済みのドメインを入力して **「Add」**
3. DNSレコードの設定をドメイン管理会社で行う

---

## 運用メモ

### コードを更新してデプロイする手順

```bash
git add .
git commit -m "変更内容のメモ"
git push origin main
# → Vercel が自動的に再デプロイ（約2分）
```

### Supabase 無料枠の制限

| リソース | 無料枠 |
|--------|--------|
| データベース | 500 MB |
| 月間アクティブユーザー | 50,000 人 |
| ストレージ | 1 GB |
| Edge Functions 実行回数 | 500,000 回 / 月 |

コンサルティング会社の社内利用であれば無料枠で十分です。

### Anthropic API の費用目安

WBS生成1回あたり約 `$0.003〜0.008`（Claude Sonnet 4）。  
月100回生成でも約100円前後です。

---

## よくあるトラブル

**Q: ログインできない**  
→ Supabase の Authentication > Users でアカウントが確認済みになっているか確認。  
　確認メールが届いていない場合は迷惑メールフォルダを確認。

**Q: WBS生成でエラーになる**  
→ Vercel の環境変数に `ANTHROPIC_API_KEY` が正しく設定されているか確認。  
　Vercel ダッシュボード > Settings > Environment Variables で確認できます。

**Q: チームメンバーの変更が即時反映されない**  
→ Supabase Realtime が有効になっているか確認。  
　SQL Editor で `ALTER PUBLICATION supabase_realtime ADD TABLE projects;` を再実行。

**Q: 本番環境でAPIが404になる**  
→ `api/generate-wbs.js` ファイルがリポジトリに含まれているか確認。  
　`git status` でファイルがトラッキングされているか確認してください。
