-- ═══════════════════════════════════════════════════════════
-- CloudHak CRM — Phase 1 RLS + Functions + Triggers
-- ═══════════════════════════════════════════════════════════

-- ═══ AUTO-UPDATE updated_at TRIGGERS ═══

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sub_accounts_updated BEFORE UPDATE ON sub_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_opportunities_updated BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workflows_updated BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_forms_updated BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ AUTO-CREATE USER PROFILE ON SIGNUP ═══

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ═══ AUTO-CREATE ACTIVITY ON CONTACT CHANGES ═══

CREATE OR REPLACE FUNCTION log_contact_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contact_activity (contact_id, type, summary, created_by)
  VALUES (NEW.id, 'created', 'Contact created', NEW.assigned_to);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_created
  AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_contact_created();

-- ═══ SECURITY DEFINER HELPER: Get user's sub-account IDs ═══
-- Returns ALL sub-account IDs the current user has access to

CREATE OR REPLACE FUNCTION get_my_subaccount_ids()
RETURNS UUID[]
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ARRAY_AGG(subaccount_id)
  FROM user_subaccount_roles
  WHERE user_id = auth.uid();
$$;

-- ═══ SECURITY DEFINER HELPER: Get user's org IDs ═══

CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS UUID[]
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ARRAY_AGG(DISTINCT sa.org_id)
  FROM user_subaccount_roles usr
  JOIN sub_accounts sa ON sa.id = usr.subaccount_id
  WHERE usr.user_id = auth.uid();
$$;

-- ═══ ENABLE RLS ON ALL TABLES ═══

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subaccount_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ═══ RLS POLICIES ═══

-- Organizations: user can see orgs where they have sub-account access
CREATE POLICY orgs_select ON organizations FOR SELECT
  USING (id IN (SELECT unnest(get_my_org_ids())));

-- Sub-accounts: user can see sub-accounts they're assigned to
CREATE POLICY subaccounts_select ON sub_accounts FOR SELECT
  USING (id IN (SELECT unnest(get_my_subaccount_ids())));

-- Users table: can read own profile + profiles in same sub-accounts
CREATE POLICY users_read_own ON users FOR SELECT
  USING (id = auth.uid());

-- user_subaccount_roles: can see roles for own user + roles in same sub-accounts
CREATE POLICY user_roles_own ON user_subaccount_roles FOR ALL
  USING (user_id = auth.uid() OR subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Contacts: scoped by subaccount_id
CREATE POLICY contacts_select ON contacts FOR SELECT
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));
CREATE POLICY contacts_insert ON contacts FOR INSERT
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));
CREATE POLICY contacts_update ON contacts FOR UPDATE
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));
CREATE POLICY contacts_delete ON contacts FOR DELETE
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- contact_custom_field_defs: scoped by subaccount
CREATE POLICY cfd_all ON contact_custom_field_defs FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- contact_activity: scoped via contact's subaccount
CREATE POLICY activity_all ON contact_activity FOR ALL
  USING (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- contact_notes: scoped via contact's subaccount
CREATE POLICY notes_all ON contact_notes FOR ALL
  USING (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Pipelines: scoped by subaccount
CREATE POLICY pipelines_all ON pipelines FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- pipeline_stages: scoped via pipeline's subaccount
CREATE POLICY stages_all ON pipeline_stages FOR ALL
  USING (pipeline_id IN (
    SELECT id FROM pipelines WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (pipeline_id IN (
    SELECT id FROM pipelines WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Opportunities: scoped by subaccount
CREATE POLICY opportunities_all ON opportunities FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Calendar events: scoped by subaccount
CREATE POLICY calendar_all ON calendar_events FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Booking rules: scoped by subaccount
CREATE POLICY booking_all ON booking_rules FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Tasks: scoped by subaccount
CREATE POLICY tasks_all ON tasks FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Conversations: scoped by subaccount
CREATE POLICY conversations_all ON conversations FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Messages: scoped via conversation's subaccount
CREATE POLICY messages_all ON messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (conversation_id IN (
    SELECT id FROM conversations WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Workflows: scoped by subaccount
CREATE POLICY workflows_all ON workflows FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Workflow steps: scoped via workflow's subaccount
CREATE POLICY workflow_steps_all ON workflow_steps FOR ALL
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (workflow_id IN (
    SELECT id FROM workflows WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Workflow executions: scoped via workflow
CREATE POLICY workflow_exec_all ON workflow_executions FOR ALL
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (workflow_id IN (
    SELECT id FROM workflows WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Forms: scoped by subaccount
CREATE POLICY forms_all ON forms FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Form submissions: scoped via form's subaccount
CREATE POLICY submissions_all ON form_submissions FOR ALL
  USING (form_id IN (
    SELECT id FROM forms WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (form_id IN (
    SELECT id FROM forms WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- Audit log: scoped by subaccount
CREATE POLICY audit_all ON audit_log FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));

-- Consent records: scoped via contact's subaccount
CREATE POLICY consent_all ON consent_records FOR ALL
  USING (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ))
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts WHERE subaccount_id IN (SELECT unnest(get_my_subaccount_ids()))
  ));

-- API keys: scoped by subaccount
CREATE POLICY api_keys_all ON api_keys FOR ALL
  USING (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())))
  WITH CHECK (subaccount_id IN (SELECT unnest(get_my_subaccount_ids())));
