import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
    const { assignment_id } = await req.json();
    if (!assignment_id) return json({ error: 'assignment_id required' }, 400);

    const { data: assignment, error: aErr } = await admin
      .from('weekly_kpi_assignments').select('*').eq('id', assignment_id).maybeSingle();
    if (aErr || !assignment) return json({ error: 'Assignment not found' }, 404);

    const { data: client } = await admin.from('clients').select('name').eq('id', assignment.client_id).maybeSingle();
    const { data: profile } = await admin.from('profiles').select('full_name').eq('user_id', assignment.rep_id).maybeSingle();

    const totalDms = (assignment.outreach_dms_target || 0) + (assignment.carried_outreach || 0);
    const totalCalls = (assignment.calls_booked_target || 0) + (assignment.carried_calls || 0);
    const totalDeals = (assignment.closed_deals_target || 0) + (assignment.carried_deals || 0);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

    const prompt = `Generate a Monday-Friday daily to-do plan for salesperson ${profile?.full_name || 'rep'} working on client "${client?.name || 'client'}".

Weekly targets (including carry-over):
- Outreach DMs: ${totalDms}
- Calls booked: ${totalCalls}
- Closed deals: ${totalDeals}
- Conversion rate target: ${assignment.conversion_rate_target}%

Return STRICT JSON: { "tasks": [{ "day_of_week": 1-5, "task_text": "...", "task_type": "dm|call|follow_up|admin|other", "target_count": number }] }
Each day should have 2-4 measurable tasks. Distribute the targets across the week. Use day_of_week 1=Mon..5=Fri.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a tactical sales operations coach. Output strict JSON only, no markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: 'AI rate limit. Try again shortly.' }, 429);
    if (aiRes.status === 402) return json({ error: 'AI credits exhausted.' }, 402);
    if (!aiRes.ok) return json({ error: 'AI error: ' + await aiRes.text() }, 500);

    const ai = await aiRes.json();
    const content = ai.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const tasks: any[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];

    // wipe existing todos for this assignment, then insert fresh
    await admin.from('weekly_todos').delete().eq('assignment_id', assignment_id);

    const rows = tasks
      .filter((t) => t && typeof t.task_text === 'string')
      .map((t) => ({
        assignment_id,
        rep_id: assignment.rep_id,
        day_of_week: Math.min(6, Math.max(0, Number(t.day_of_week) || 1)),
        task_text: String(t.task_text).slice(0, 500),
        task_type: ['dm','call','follow_up','admin','other'].includes(t.task_type) ? t.task_type : 'other',
        target_count: Math.max(1, Number(t.target_count) || 1),
      }));

    if (rows.length) await admin.from('weekly_todos').insert(rows);

    return json({ ok: true, count: rows.length, tasks: rows });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}