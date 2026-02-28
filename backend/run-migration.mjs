/**
 * Runs the Phase 2 SQL migrations against the Supabase project
 * using the Management API with proper JSON encoding.
 * Usage: node run-migration.mjs
 */

const TOKEN = 'sbp_6488e6a829bce8f3cc6978381fd2af97d6395596';
const PROJECT_REF = 'ikfuafcygrfwgayxzwbz';
const BASE_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function runSQL(label, query) {
  console.log(`\n▸ ${label}`);
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`  ✓ OK`);
  } else {
    console.error(`  ✗ ERROR: ${text.slice(0, 300)}`);
  }
  return res.ok;
}

// ── SQL statements ────────────────────────────────────────────────────────────

const statements = [

  ['Add push_sent_at column to notifications', `
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
  `],

  ['Add updated_at column to recalls', `
    ALTER TABLE public.recalls
      ADD COLUMN IF NOT EXISTS updated_at timestamptz;
  `],

  ['Create set_updated_at trigger function', `
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$;
  `],

  ['Create updated_at trigger on recalls', `
    DROP TRIGGER IF EXISTS recalls_set_updated_at ON public.recalls;
    CREATE TRIGGER recalls_set_updated_at
      BEFORE UPDATE ON public.recalls
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  `],

  ['Create get_user_id_by_email helper', `
    CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
    RETURNS uuid
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
    $$;
    GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
  `],

  ['Create match_recalls_to_items function', `
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

      FOR recall_rec IN
        SELECT *
        FROM public.recalls
        WHERE created_at > NOW() - INTERVAL '48 hours'
        ORDER BY created_at DESC
      LOOP

        FOR item_rec IN
          SELECT i.id, i.user_id, i.name, i.brand, i.model, i.category
          FROM public.items i
        LOOP

          item_brand_lc := lower(coalesce(item_rec.brand, ''));
          item_name_lc  := lower(coalesce(item_rec.name, ''));
          item_model_lc := lower(coalesce(item_rec.model, ''));
          item_cat_lc   := lower(coalesce(item_rec.category, ''));

          brand_match := false;
          name_match  := false;
          cat_match   := false;

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

            IF item_brand_lc <> '' AND elem_brand_lc <> '' THEN
              IF item_brand_lc LIKE '%' || elem_brand_lc || '%'
              OR elem_brand_lc LIKE '%' || item_brand_lc || '%' THEN
                brand_match := true;
              END IF;
            END IF;

            IF elem_name_lc <> '' THEN
              IF (item_name_lc <> '' AND (
                    item_name_lc  LIKE '%' || elem_name_lc || '%' OR
                    elem_name_lc  LIKE '%' || item_name_lc  || '%'))
              OR (item_model_lc <> '' AND (
                    item_model_lc LIKE '%' || elem_name_lc || '%' OR
                    elem_name_lc  LIKE '%' || item_model_lc || '%'))
              THEN
                name_match := true;
              END IF;
            END IF;

            IF item_cat_lc <> '' AND elem_cat_lc <> '' AND item_cat_lc = elem_cat_lc THEN
              cat_match := true;
            END IF;

          END LOOP;

          IF brand_match AND (name_match OR cat_match OR recall_rec.source = 'NHTSA') THEN

            INSERT INTO public.item_recalls (item_id, recall_id)
            VALUES (item_rec.id, recall_rec.id)
            ON CONFLICT (item_id, recall_id) DO NOTHING;

            IF FOUND THEN
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

        END LOOP;
      END LOOP;

      RETURN matched_count;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.match_recalls_to_items() TO service_role;
  `],

  ['Enable RLS on recalls + policies', `
    ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can read recalls" ON public.recalls;
    CREATE POLICY "Anyone can read recalls"
      ON public.recalls FOR SELECT USING (true);
  `],

  ['Create performance indexes', `
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
    CREATE INDEX IF NOT EXISTS idx_items_category ON public.items (category);
    CREATE INDEX IF NOT EXISTS idx_warranties_end_date ON public.warranties (end_date);
  `],

  ['Enable pg_net extension', `
    CREATE EXTENSION IF NOT EXISTS pg_net;
  `],

  ['Schedule fetch-recalls cron job (every 6 hours)', `
    SELECT cron.schedule(
      'warranty-app-fetch-recalls',
      '0 0,6,12,18 * * *',
      $$
      SELECT net.http_post(
        url     := 'https://ikfuafcygrfwgayxzwbz.supabase.co/functions/v1/fetch-recalls',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnVhZmN5Z3Jmd2dheXh6d2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE1NTYxNCwiZXhwIjoyMDg3NzMxNjE0fQ.4rChIYF5YS9n0cB1wVkdePBI6rRHpLd5g3x6E8KL-W8'
        ),
        body    := '{}'::jsonb
      );
      $$
    );
  `],

  ['Schedule warranty-check cron job (daily 9am UTC)', `
    SELECT cron.schedule(
      'warranty-app-warranty-check',
      '0 9 * * *',
      $$
      SELECT net.http_post(
        url     := 'https://ikfuafcygrfwgayxzwbz.supabase.co/functions/v1/warranty-check',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrZnVhZmN5Z3Jmd2dheXh6d2J6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE1NTYxNCwiZXhwIjoyMDg3NzMxNjE0fQ.4rChIYF5YS9n0cB1wVkdePBI6rRHpLd5g3x6E8KL-W8'
        ),
        body    := '{}'::jsonb
      );
      $$
    );
  `],

];

// ── Run everything ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

for (const [label, sql] of statements) {
  const ok = await runSQL(label, sql);
  if (ok) passed++; else failed++;
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`✓ ${passed} succeeded   ✗ ${failed} failed`);
