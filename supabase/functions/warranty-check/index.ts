/**
 * warranty-check Edge Function
 *
 * Runs daily. Finds warranties expiring in the next 30 days and
 * sends a push notification to the item owner as a heads-up.
 *
 * Schedule: 9:00 AM UTC daily via pg_cron
 */

import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

Deno.serve(async (_req) => {
  console.log(`[warranty-check] Starting at ${new Date().toISOString()}`);

  try {
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];
    const in7  = new Date(Date.now() +  7 * 86_400_000).toISOString().split('T')[0];

    // Find warranties expiring within 30 days that the user hasn't been notified about
    const { data: expiring, error } = await supabaseAdmin
      .from('warranties')
      .select(`
        id,
        end_date,
        items (
          id,
          name,
          brand,
          user_id,
          profiles!user_id (push_token)
        )
      `)
      .gte('end_date', today)
      .lte('end_date', in30)
      .not('items', 'is', null);

    if (error) throw error;
    if (!expiring?.length) {
      console.log('[warranty-check] No expiring warranties found');
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const notifications: object[] = [];
    const pushMessages: object[] = [];

    for (const w of expiring) {
      const item = (w as any).items;
      if (!item) continue;

      const endDate = new Date(w.end_date!);
      const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86_400_000);
      const itemLabel = [item.brand, item.name].filter(Boolean).join(' ');

      let urgency = '';
      if (daysLeft <= 7) urgency = '⚠️ Expires in 7 days or less!';
      else if (daysLeft <= 14) urgency = 'Expiring in 2 weeks';
      else urgency = 'Expiring in 30 days';

      const message = `Warranty for your ${itemLabel} expires on ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. ${urgency}`;

      // Check if we already sent this notification recently (within 7 days)
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', item.id)
        .is('recall_id', null)
        .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString());

      if ((count ?? 0) > 0) continue; // Already notified this week

      notifications.push({
        user_id: item.user_id,
        item_id: item.id,
        recall_id: null,
        message,
      });

      const pushToken = item.profiles?.push_token;
      if (pushToken) {
        pushMessages.push({
          to: pushToken,
          title: daysLeft <= 7 ? '⚠️ Warranty Expiring Soon' : '📋 Warranty Reminder',
          body: message,
          data: { type: 'warranty', itemId: item.id },
          sound: 'default',
        });
      }
    }

    // Insert notifications
    if (notifications.length) {
      await supabaseAdmin.from('notifications').insert(notifications);
    }

    // Send push notifications in batches of 100
    if (pushMessages.length) {
      const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
      for (let i = 0; i < pushMessages.length; i += 100) {
        const chunk = pushMessages.slice(i, i + 100);
        await fetch(EXPO_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(chunk),
        });
      }
    }

    console.log(`[warranty-check] Sent ${notifications.length} warranty reminders, ${pushMessages.length} push notifications`);

    return new Response(JSON.stringify({
      ok: true,
      checked: expiring.length,
      notified: notifications.length,
      pushed: pushMessages.length,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[warranty-check] Error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
