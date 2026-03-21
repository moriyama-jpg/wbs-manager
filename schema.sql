-- ═══════════════════════════════════════════════════════════
--  WBS Manager — Supabase SQL スキーマ
--  Supabase ダッシュボード > SQL Editor で実行してください
-- ═══════════════════════════════════════════════════════════

-- プロジェクトテーブル
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL DEFAULT '新規プロジェクト',
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planning'
               CHECK (status IN ('planning','active','review','done','hold')),
  wbs          JSONB NOT NULL DEFAULT '{"phases":[]}',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security (RLS) ────────────────────────────────
-- ログイン済みユーザー全員がチームのプロジェクトを共有できる設定
-- （社内ツールとして全員が同じプロジェクトを見る想定）

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 認証ユーザーは全プロジェクトを閲覧可能
CREATE POLICY "authenticated_select"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');

-- 認証ユーザーは新規プロジェクトを作成可能
CREATE POLICY "authenticated_insert"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 認証ユーザーは全プロジェクトを編集可能（チーム共同編集）
CREATE POLICY "authenticated_update"
  ON projects FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 削除は作成者のみ可能
CREATE POLICY "creator_delete"
  ON projects FOR DELETE
  USING (auth.uid() = created_by);

-- ── Realtime 有効化 ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- ── インデックス ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_status_idx     ON projects (status);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects (created_by);
