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

-- 招待済みメンバー管理テーブル
CREATE TABLE IF NOT EXISTS members (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('admin','member')),
  status     TEXT NOT NULL DEFAULT 'invited'
             CHECK (status IN ('invited','active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_active_member(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members
    WHERE id = user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_member(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members
    WHERE id = user_id
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE POLICY "members_select_self_or_admin"
  ON members FOR SELECT
  USING (id = auth.uid() OR is_admin_member());

CREATE POLICY "members_admin_insert"
  ON members FOR INSERT
  WITH CHECK (is_admin_member());

CREATE POLICY "members_admin_update"
  ON members FOR UPDATE
  USING (is_admin_member())
  WITH CHECK (is_admin_member());

-- active メンバーだけがプロジェクトを利用可能
CREATE POLICY "active_members_select_projects"
  ON projects FOR SELECT
  USING (is_active_member());

CREATE POLICY "active_members_insert_projects"
  ON projects FOR INSERT
  WITH CHECK (is_active_member() AND created_by = auth.uid());

CREATE POLICY "active_members_update_projects"
  ON projects FOR UPDATE
  USING (is_active_member())
  WITH CHECK (is_active_member());

CREATE POLICY "active_members_delete_projects"
  ON projects FOR DELETE
  USING (
    is_active_member()
    AND (created_by = auth.uid() OR is_admin_member())
  );

-- ── Realtime 有効化 ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- ── インデックス ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_status_idx     ON projects (status);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects (created_by);
CREATE INDEX IF NOT EXISTS members_email_idx       ON members (email);
CREATE INDEX IF NOT EXISTS members_status_idx      ON members (status);
