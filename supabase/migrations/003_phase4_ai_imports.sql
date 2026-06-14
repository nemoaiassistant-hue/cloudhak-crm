-- ═══════════════════════════════════════════════════════════
-- CloudHak CRM — Phase 4 Schema (AI + White-label extras)
-- ═══════════════════════════════════════════════════════════

-- ═══ AI CHAT SESSIONS ═══

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subaccount_id UUID NOT NULL REFERENCES sub_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  context_type TEXT NOT NULL DEFAULT 'general' CHECK (context_type IN ('general', 'contact', 'pipeline', 'automation_help')),
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_subaccount ON ai_chat_sessions(subaccount_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_chat_messages(session_id);

-- ═══ AI CONTACT INSIGHTS (cached) ═══

CREATE TABLE IF NOT EXISTS ai_contact_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  subaccount_id UUID NOT NULL REFERENCES sub_accounts(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  suggested_tags TEXT[] NOT NULL DEFAULT '{}',
  suggested_actions JSONB NOT NULL DEFAULT '[]',
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_contact ON ai_contact_insights(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_subaccount ON ai_contact_insights(subaccount_id);

-- ═══ DATA IMPORT JOBS ═══

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subaccount_id UUID NOT NULL REFERENCES sub_accounts(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('ghl', 'csv', 'hubspot', 'salesforce')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  error_log JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_subaccount ON import_jobs(subaccount_id);
