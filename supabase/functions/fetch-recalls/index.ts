/**
 * fetch-recalls Edge Function
 *
 * Polls all US government recall APIs, normalises the data,
 * upserts into the `recalls` table, then calls match_recalls_to_items()
 * to check every registered item and fire push notifications for matches.
 *
 * Schedule: every 6 hours via pg_cron (see backend/cron-setup.sql)
 *
 * Sources:
 *   CPSC  — saferproducts.gov  (electronics, appliances, toys, furniture…)
 *   FDA   — api.fda.gov        (food, drugs, medical devices)
 *   USDA  — fsis.usda.gov      (meat, poultry, eggs)
 *   NHTSA — api.nhtsa.gov      (vehicles, tires, car seats)
 */

import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 86_400_000);
const DATE_STR = SEVEN_DAYS_AGO.toISOString().split('T')[0]; // YYYY-MM-DD

// ─────────────────────────────────────────────────────────────
//  Type shared by every normalised recall record
// ─────────────────────────────────────────────────────────────
interface NormalisedRecall {
  source: 'CPSC' | 'FDA' | 'USDA' | 'NHTSA';
  external_id: string;
  title: string;
  description: string | null;
  hazard: string | null;
  remedy: string | null;
  affected_products: object;   // array of {brand, name, model, upc, category}
  recall_date: string | null;
  url: string | null;
}

// ─────────────────────────────────────────────────────────────
//  CPSC — Consumer Product Safety Commission
//  https://www.saferproducts.gov/RestWebServices
// ─────────────────────────────────────────────────────────────
async function fetchCPSC(): Promise<NormalisedRecall[]> {
  try {
    const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateFrom=${DATE_STR}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'WarrantyApp/1.0' } });
    if (!res.ok) throw new Error(`CPSC HTTP ${res.status}`);
    const data: any[] = await res.json();

    return data.map((r: any): NormalisedRecall => {
      const products = (r.Products ?? []).map((p: any) => ({
        brand: r.Manufacturers?.[0]?.Name ?? null,
        name: p.Name ?? null,
        model: p.Model ?? null,
        upc: p.UPC ?? null,
        category: mapCPSCCategory(p.CategoryID ?? ''),
      }));

      return {
        source: 'CPSC',
        external_id: `CPSC-${r.RecallID}`,
        title: r.Title ?? r.Headline ?? 'CPSC Recall',
        description: r.Description ?? null,
        hazard: r.Hazards?.[0]?.HazardDescription ?? r.Hazards?.[0]?.Name ?? null,
        remedy: r.Remedies?.[0]?.Name ?? null,
        affected_products: products,
        recall_date: r.RecallDate ? r.RecallDate.split('T')[0] : null,
        url: r.Url ?? null,
      };
    });
  } catch (err) {
    console.error('CPSC fetch failed:', err);
    return [];
  }
}

function mapCPSCCategory(id: string): string {
  const map: Record<string, string> = {
    '1101': 'Electronics', '1102': 'Electronics', '1103': 'Electronics',
    '0403': 'Toys', '0404': 'Toys',
    '0101': 'Appliances', '0102': 'Appliances', '0103': 'Appliances',
    '0201': 'Furniture', '0202': 'Furniture',
    '0601': 'Clothing & Accessories',
    '0701': 'Tools & Equipment', '0702': 'Tools & Equipment',
  };
  return map[id] ?? 'Other';
}

// ─────────────────────────────────────────────────────────────
//  FDA — Food and Drug Administration
//  https://api.fda.gov  (food + drug + device enforcement)
// ─────────────────────────────────────────────────────────────
async function fetchFDA(): Promise<NormalisedRecall[]> {
  const endpoints = [
    { url: `https://api.fda.gov/food/enforcement.json?limit=50&sort=recall_initiation_date:desc`, category: 'Food & Beverage' },
    { url: `https://api.fda.gov/drug/enforcement.json?limit=50&sort=recall_initiation_date:desc`, category: 'Medical Devices' },
    { url: `https://api.fda.gov/device/enforcement.json?limit=50&sort=recall_initiation_date:desc`, category: 'Medical Devices' },
  ];

  const results: NormalisedRecall[] = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers: { 'User-Agent': 'WarrantyApp/1.0' } });
      if (!res.ok) continue;
      const json = await res.json();
      const items: any[] = json.results ?? [];

      // Filter to last 7 days
      const recent = items.filter((r: any) => {
        const dateStr = r.recall_initiation_date ?? '';
        if (!dateStr) return true;
        // FDA format: YYYYMMDD
        const d = new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
        return d >= SEVEN_DAYS_AGO;
      });

      for (const r of recent) {
        results.push({
          source: 'FDA',
          external_id: `FDA-${r.recall_number ?? r.event_id ?? Math.random()}`,
          title: r.product_description?.slice(0, 200) ?? 'FDA Recall',
          description: r.reason_for_recall ?? null,
          hazard: r.code_info ?? r.classification ?? null,
          remedy: 'Contact manufacturer or retailer for instructions',
          affected_products: [{
            brand: r.recalling_firm ?? null,
            name: r.product_description ?? null,
            model: null,
            upc: null,
            category: ep.category,
          }],
          recall_date: dateFromFDA(r.recall_initiation_date),
          url: null,
        });
      }
    } catch (err) {
      console.error(`FDA fetch failed (${ep.category}):`, err);
    }
  }

  return results;
}

function dateFromFDA(raw: string | null): string | null {
  if (!raw || raw.length !== 8) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

// ─────────────────────────────────────────────────────────────
//  USDA FSIS — Food Safety and Inspection Service
//  https://www.fsis.usda.gov/fsis/api/recall/v/1
// ─────────────────────────────────────────────────────────────
async function fetchUSDA(): Promise<NormalisedRecall[]> {
  try {
    const res = await fetch('https://www.fsis.usda.gov/fsis/api/recall/v/1', {
      headers: { 'User-Agent': 'WarrantyApp/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);
    const data: any[] = await res.json();

    return data
      .filter((r: any) => {
        const d = new Date(r.recall_date ?? r.press_release_date ?? '');
        return !isNaN(d.getTime()) && d >= SEVEN_DAYS_AGO;
      })
      .map((r: any): NormalisedRecall => ({
        source: 'USDA',
        external_id: `USDA-${r.recall_number ?? r.id}`,
        title: `${r.establishment_name ?? 'Unknown'} — ${r.recall_class ?? ''} Recall`,
        description: r.reason_for_recall ?? r.products?.[0]?.product_name ?? null,
        hazard: r.recall_class ? `Class ${r.recall_class} recall` : null,
        remedy: 'Do not consume. Return to place of purchase or discard.',
        affected_products: (r.products ?? []).map((p: any) => ({
          brand: r.establishment_name ?? null,
          name: p.product_name ?? null,
          model: null,
          upc: p.pkg_sizes ?? null,
          category: 'Food & Beverage',
        })),
        recall_date: r.recall_date?.split('T')[0] ?? r.press_release_date?.split('T')[0] ?? null,
        url: r.press_release_url ?? null,
      }));
  } catch (err) {
    console.error('USDA fetch failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
//  NHTSA — National Highway Traffic Safety Administration
//  Fetches recalls for any vehicle items registered in the app.
//  https://api.nhtsa.gov/recalls/recallsByVehicle
// ─────────────────────────────────────────────────────────────
async function fetchNHTSA(): Promise<NormalisedRecall[]> {
  try {
    // Get all vehicle items from the database
    const { data: vehicles, error } = await supabaseAdmin
      .from('items')
      .select('id, brand, model, purchase_date')
      .eq('category', 'Vehicles')
      .not('brand', 'is', null);

    if (error || !vehicles?.length) return [];

    const results: NormalisedRecall[] = [];
    const seen = new Set<string>();

    for (const v of vehicles) {
      if (!v.brand) continue;
      const make = encodeURIComponent(v.brand.trim().toUpperCase());
      const model = v.model ? encodeURIComponent(v.model.trim().toUpperCase()) : null;
      const year = v.purchase_date ? new Date(v.purchase_date).getFullYear() : new Date().getFullYear();

      // Build NHTSA query — model optional
      let nhtsaUrl = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${make}&modelYear=${year}`;
      if (model) nhtsaUrl += `&model=${model}`;

      try {
        const res = await fetch(nhtsaUrl, { headers: { 'User-Agent': 'WarrantyApp/1.0' } });
        if (!res.ok) continue;
        const json = await res.json();
        const recalls: any[] = json.results ?? [];

        for (const r of recalls) {
          const extId = `NHTSA-${r.NHTSACampaignNumber}`;
          if (seen.has(extId)) continue;
          seen.add(extId);

          results.push({
            source: 'NHTSA',
            external_id: extId,
            title: `${r.Manufacturer ?? v.brand} ${r.Component ?? 'Vehicle'} Recall`,
            description: r.Summary ?? null,
            hazard: r.Consequence ?? null,
            remedy: r.Remedy ?? null,
            affected_products: [{
              brand: r.Manufacturer ?? v.brand,
              name: r.Subject ?? null,
              model: model ? decodeURIComponent(model) : v.model,
              upc: null,
              category: 'Vehicles',
            }],
            recall_date: r.ReportReceivedDate
              ? new Date(r.ReportReceivedDate).toISOString().split('T')[0]
              : null,
            url: `https://www.nhtsa.gov/vehicle-safety/recalls#${r.NHTSACampaignNumber}`,
          });
        }
      } catch {
        // Skip this vehicle on error
      }
    }

    return results;
  } catch (err) {
    console.error('NHTSA fetch failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
//  Upsert recalls to database
// ─────────────────────────────────────────────────────────────
async function upsertRecalls(recalls: NormalisedRecall[]): Promise<number> {
  if (!recalls.length) return 0;

  const { error, count } = await supabaseAdmin
    .from('recalls')
    .upsert(recalls, {
      onConflict: 'external_id',
      ignoreDuplicates: false,   // update if changed
    });

  if (error) {
    console.error('Upsert error:', error.message);
    return 0;
  }

  return count ?? recalls.length;
}

// ─────────────────────────────────────────────────────────────
//  Edge Function handler
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Allow cron (no auth header) or service role calls
  const start = Date.now();
  console.log(`[fetch-recalls] Starting at ${new Date().toISOString()}`);

  try {
    // Fetch from all sources in parallel
    const [cpsc, fda, usda, nhtsa] = await Promise.all([
      fetchCPSC(),
      fetchFDA(),
      fetchUSDA(),
      fetchNHTSA(),
    ]);

    const all = [...cpsc, ...fda, ...usda, ...nhtsa];
    console.log(`[fetch-recalls] Fetched: CPSC=${cpsc.length} FDA=${fda.length} USDA=${usda.length} NHTSA=${nhtsa.length} Total=${all.length}`);

    const upserted = await upsertRecalls(all);
    console.log(`[fetch-recalls] Upserted ${upserted} recalls`);

    // Trigger matching (call the SQL function)
    const { data: matchCount, error: matchErr } = await supabaseAdmin
      .rpc('match_recalls_to_items');

    if (matchErr) {
      console.error('[fetch-recalls] Match error:', matchErr.message);
    } else {
      console.log(`[fetch-recalls] Matched ${matchCount} item-recall pairs`);
    }

    // Send push notifications for new unnotified matches
    await sendPendingPushNotifications();

    const elapsed = Date.now() - start;
    return new Response(JSON.stringify({
      ok: true,
      elapsed_ms: elapsed,
      fetched: { cpsc: cpsc.length, fda: fda.length, usda: usda.length, nhtsa: nhtsa.length, total: all.length },
      upserted,
      matched: matchCount ?? 0,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[fetch-recalls] Fatal error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ─────────────────────────────────────────────────────────────
//  Send push notifications for unnotified item-recall matches
// ─────────────────────────────────────────────────────────────
async function sendPendingPushNotifications() {
  // Get notifications that haven't been sent yet (no push_sent_at)
  // We join to get the user's push token and recall details
  const { data: pending, error } = await supabaseAdmin
    .from('notifications')
    .select(`
      id,
      message,
      user_id,
      recalls (title, source),
      profiles!user_id (push_token)
    `)
    .is('push_sent_at', null)
    .limit(500);

  if (error || !pending?.length) {
    if (error) console.error('Push query error:', error.message);
    return;
  }

  const messages = pending
    .filter((n: any) => n.profiles?.push_token)
    .map((n: any) => ({
      to: n.profiles.push_token as string,
      title: `🚨 Recall Alert — ${n.recalls?.source ?? 'Gov'}`,
      body: n.message,
      data: { notificationId: n.id },
      sound: 'default' as const,
    }));

  if (!messages.length) return;

  // Send via Expo
  const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  const chunks: typeof messages[] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error('Expo push send failed:', e);
    }
  }

  // Mark as sent by updating a sent timestamp
  const ids = pending.map((n: any) => n.id);
  await supabaseAdmin
    .from('notifications')
    .update({ push_sent_at: new Date().toISOString() } as any)
    .in('id', ids);

  console.log(`[fetch-recalls] Sent ${messages.length} push notifications`);
}
