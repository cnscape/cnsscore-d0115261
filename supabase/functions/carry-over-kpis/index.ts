import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Snap a date to ISO Monday (00:00 UTC)
function toMonday(d: Date): string {
  const day = d.getUTCDay() || 7; // Sun=0 -> 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { rep_id, client_id, week_start } = body;
    if (!rep_id || !client_id || !week_start) return json({ error: 'rep_id, client_id, week_start required' }, 400);

    const prevMonday = toMonday(new Date(week_start + 'T00:00:00Z'));
    const nextMonday = addDays(prevMonday, 7);
    const weekEnd = addDays(prevMonday, 7);

    const { data: prev } = await admin
      .from('weekly_kpi_assignments').select('*')
      .eq('rep_id', rep_id).eq('client_id', client_id).eq('week_start', prevMonday)
      .maybeSingle();
    if (!prev) return json({ error: 'No assignment for that week' }, 404);

    // Actuals
    const [actsRes, dealsRes] = await Promise.all([
      admin.from('lead_activities').select('activity_type, created_at').eq('user_id', rep_id)
        .gte('created_at', prevMonday).lt('created_at', weekEnd),
      admin.from('deals').select('status, created_at, client_id').eq('rep_id', rep_id).eq('client_id', client_id)
        .gte('created_at', prevMonday).lt('created_at', weekEnd),
    ]);
    const acts = actsRes.data || [];
    const deals = dealsRes.data || [];
    const actualDms = acts.filter((a: any) => a.activity_type === 'dm_sent').length;
    const actualCalls = acts.filter((a: any) => ['call_made','meeting_booked'].includes(a.activity_type)).length;
    const actualDeals = deals.filter((d: any) => d.status === 'won').length;

    const carriedOutreach = Math.max(0, (prev.outreach_dms_target + prev.carried_outreach) - actualDms);
    const carriedCalls = Math.max(0, (prev.calls_booked_target + prev.carried_calls) - actualCalls);
    const carriedDeals = Math.max(0, (prev.closed_deals_target + prev.carried_deals) - actualDeals);

    const upsertPayload = {
      rep_id, client_id, week_start: nextMonday,
      outreach_dms_target: prev.outreach_dms_target,
      calls_booked_target: prev.calls_booked_target,
      conversion_rate_target: prev.conversion_rate_target,
      closed_deals_target: prev.closed_deals_target,
      carried_outreach: carriedOutreach,
      carried_calls: carriedCalls,
      carried_deals: carriedDeals,
      created_by: user.id,
    };

    const { data: upserted, error: upErr } = await admin
      .from('weekly_kpi_assignments')
      .upsert(upsertPayload, { onConflict: 'rep_id,client_id,week_start' })
      .select().maybeSingle();
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, assignment: upserted, actuals: { actualDms, actualCalls, actualDeals } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}