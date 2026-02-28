-- WarrantyApp Phase 2 Migrations
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/ikfuafcygrfwgayxzwbz/sql/new
-- Run ALL of these in one go.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add push_sent_at to notifications (tracks whether push was delivered)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HELPER: get_user_id_by_email
--    Used by the Transfer Ownership screen to find a recipient by email.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORE: match_recalls_to_items()
--
--    Called by fetch-recalls edge function after new recalls are upserted.
--    For each recently added recall, fuzzy-matches against all user items:
--      1. Brand/manufacturer name match (case-insensitive, partial)
--      2. Product name / model match
--      3. Category match (as a secondary signal)
--
--    Creates item_recalls and notifications rows for each match.
--    Returns the number of new matches found.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_recalls_to_items()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count  integer := 0;
  recall_rec     RECORD;
  item_rec       RECORD;
  affected_elem  jsonb;
  brand_match    boolean;
  name_match     boolean;
  cat_match      boolean;
  item_brand_lc  text;
  item_name_lc   text;
  item_model_lc  text;
  item_cat_lc    text;
  elem_brand_lc  text;
  elem_name_lc   text;
  elem_cat_lc    text;
  notification_msg text;
BEGIN

  -- ── Loop over recalls added or updated in the last 48 hours ──────────────
  FOR recall_rec IN
    SELECT *
    FROM public.recalls
    WHERE created_at > NOW() - INTERVAL '48 hours'
       OR (updated_at IS NOT NULL AND updated_at > NOW() - INTERVAL '48 hours')
    ORDER BY created_at DESC
  LOOP

    -- ── Loop over every registered item in the system ──────────────────────
    FOR item_rec IN
      SELECT i.id, i.user_id, i.name, i.brand, i.model, i.category
      FROM public.items i
    LOOP

      -- Skip if already matched
      IF EXISTS (
        SELECT 1 FROM public.item_recalls ir
        WHERE ir.item_id = recall_rec.id AND ir.recall_id = recall_rec.id
      ) THEN CONTINUE; END IF;

      -- Prepare lower-case comparison values
      item_brand_lc := lower(coalesce(item_rec.brand, ''));
      item_name_lc  := lower(coalesce(item_rec.name, ''));
      item_model_lc := lower(coalesce(item_rec.model, ''));
      item_cat_lc   := lower(coalesce(item_rec.category, ''));

      brand_match := false;
      name_match  := false;
      cat_match   := false;

      -- ── Check each affected_product element in the recall ─────────────────
      FOR affected_elem IN
        SELECT value FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(recall_rec.affected_products) = 'array'
              THEN recall_rec.affected_products
            ELSE '[]'::jsonb
          END
        )
      LOOP
        elem_brand_lc := lower(coalesce(affected_elem->>'brand', ''));
        elem_name_lc  := lower(coalesce(affected_elem->>'name', ''));
        elem_cat_lc   := lower(coalesce(affected_elem->>'category', ''));

        -- Brand match: either direction partial
        IF item_brand_lc <> '' AND elem_brand_lc <> '' THEN
          IF item_brand_lc LIKE '%' || elem_brand_lc || '%'
          OR elem_brand_lc LIKE '%' || item_brand_lc || '%' THEN
            brand_match := true;
          END IF;
        END IF;

        -- Name/model match: item name or model appears in recall product name
        IF elem_name_lc <> '' THEN
          IF (item_name_lc  <> '' AND (item_name_lc  LIKE '%' || elem_name_lc || '%' OR elem_name_lc LIKE '%' || item_name_lc  || '%'))
          OR (item_model_lc <> '' AND (item_model_lc LIKE '%' || elem_name_lc || '%' OR elem_name_lc LIKE '%' || item_model_lc || '%'))
          THEN
            name_match := true;
          END IF;
        END IF;

        -- Category match
        IF item_cat_lc <> '' AND elem_cat_lc <> '' AND item_cat_lc = elem_cat_lc THEN
          cat_match := true;
        END IF;

      END LOOP;

      -- ── Match logic ────────────────────────────────────────────────────────
      -- Require brand match PLUS at least one of (name_match OR cat_match)
      -- Exception: NHTSA recalls match on brand alone for vehicle items
      IF brand_match AND (name_match OR cat_match OR recall_rec.source = 'NHTSA') THEN

        -- Insert item_recall (ON CONFLICT DO NOTHING is our guard)
        INSERT INTO public.item_recalls (item_id, recall_id)
        VALUES (item_rec.id, recall_rec.id)
        ON CONFLICT (item_id, recall_id) DO NOTHING;

        IF FOUND THEN
          -- Build a human-readable notification message
          notification_msg := format(
            'Your %s may be affected by a %s recall: "%s"',
            coalesce(item_rec.brand || ' ' || item_rec.name, item_rec.name),
            recall_rec.source,
            left(recall_rec.title, 120)
          );

          INSERT INTO public.notifications (user_id, item_id, recall_id, message)
          VALUES (item_rec.user_id, item_rec.id, recall_rec.id, notification_msg)
          ON CONFLICT DO NOTHING;

          matched_count := matched_count + 1;
        END IF;

      END IF;

    END LOOP; -- items
  END LOOP;   -- recalls

  RETURN matched_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_recalls_to_items() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Add updated_at to recalls (so match function can track changes)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.recalls
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS recalls_set_updated_at ON public.recalls;
CREATE TRIGGER recalls_set_updated_at
  BEFORE UPDATE ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Allow service_role to bypass RLS for recalls table
--    (needed by edge functions that use service role key)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;

-- Public read (anyone authenticated can see recalls)
DROP POLICY IF EXISTS "Anyone can read recalls" ON public.recalls;
CREATE POLICY "Anyone can read recalls"
  ON public.recalls FOR SELECT
  USING (true);

-- Only service_role can insert/update recalls
DROP POLICY IF EXISTS "Service role manages recalls" ON public.recalls;
CREATE POLICY "Service role manages recalls"
  ON public.recalls FOR ALL
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Performance indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_recalls_source ON public.recalls (source);
CREATE INDEX IF NOT EXISTS idx_recalls_created_at ON public.recalls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recalls_external_id ON public.recalls (external_id);
CREATE INDEX IF NOT EXISTS idx_item_recalls_recall_id ON public.item_recalls (recall_id);
CREATE INDEX IF NOT EXISTS idx_item_recalls_item_id ON public.item_recalls (item_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_push_unsent
  ON public.notifications (created_at DESC)
  WHERE push_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_items_brand ON public.items (lower(brand));
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category);
CREATE INDEX IF NOT EXISTS idx_warranties_end_date ON public.warranties (end_date);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Enable pg_net for HTTP calls (required by cron → edge functions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CRON JOBS — schedule both edge functions
--    pg_cron is pre-enabled on all Supabase projects.
--
--    Replace the Bearer token with your service_role key if needed.
--    The key is stored in .env.local.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('warranty-app-fetch-recalls') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'warranty-app-fetch-recalls'
);
SELECT cron.unschedule('warranty-app-warranty-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'warranty-app-warranty-check'
);

-- Fetch recalls every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.schedule(
  'warranty-app-fetch-recalls',
  '0 0,6,12,18 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://ikfuafcygrfwgayxzwbz.supabase.co/functions/v1/fetch-recalls',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnVhZmN5Z3Jmd2dheXh6d2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE1NTYxNCwiZXhwIjoyMDg3NzMxNjE0fQ.4rChIYF5YS9n0cB1wVkdePBI6rRHpLd5g3x6E8KL-W8'
    ),
    body   := '{}'::jsonb
  );
  $$
);

-- Check warranty expirations every day at 9:00 AM UTC
SELECT cron.schedule(
  'warranty-app-warranty-check',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://ikfuafcygrfwgayxzwbz.supabase.co/functions/v1/warranty-check',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnVhZmN5Z3Jmd2dheXh6d2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE1NTYxNCwiZXhwIjoyMDg3NzMxNjE0fQ.4rChIYF5YS9n0cB1wVkdePBI6rRHpLd5g3x6E8KL-W8'
    ),
    body   := '{}'::jsonb
  );
  $$
);

-- Confirm jobs are scheduled
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'warranty-app-%';
