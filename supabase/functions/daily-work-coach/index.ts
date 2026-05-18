import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface ReqBody { user_id?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userId = user.id;
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);

    const [profileRes, leadsRes, activitiesRes, dealsRes, kpiRes] = await Promise.all([
      supabase.from('profiles').select('full_name, level, total_xp, current_streak').eq('user_id', userId).maybeSingle(),
      supabase.from('pipeline_leads').select('stage, last_activity_at, follow_ups_completed').eq('owner_id', userId),
      supabase.from('lead_activities').select('activity_type, created_at').eq('user_id', userId).gte('created_at', weekStart.toISOString()),
      supabase.from('deals').select('status, created_at, revenue').eq('rep_id', userId).gte('created_at', weekStart.toISOString()),
      supabase.from('kpi_targets').select('metric_name, target_value, period').eq('rep_id', userId),
    ]);

    const profile = profileRes.data || { full_name: 'Rep', level: 1, total_xp: 0, current_streak: 0 };
    const leads = leadsRes.data || [];
    const activities = activitiesRes.data || [];
    const deals = dealsRes.data || [];
    const targets = (kpiRes.data || []) as Array<{ metric_name: string; target_value: number; period: string }>;

    const stageCounts: Record<string, number> = {};
    leads.forEach((l: any) => { stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1; });

    const dms = activities.filter((a: any) => a.activity_type === 'dm_sent').length;
    const calls = activities.filter((a: any) => ['call_made', 'meeting_held', 'meeting_booked'].includes(a.activity_type)).length;
    const closedWon = deals.filter((d: any) => d.status === 'won').length;
    const closeRate = deals.length ? Math.round((closedWon / deals.length) * 100) : 0;

    const tFor = (m: string, def: number) => targets.find(t => t.metric_name === m)?.target_value ?? def;
    const targetDM = tFor('outreach_dms', 35);
    const targetCalls = tFor('calls_conducted', 10);
    const targetClosed = tFor('deals_closed', 8);
    const targetCloseRate = tFor('close_rate', 25);

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const context = `
Salesperson: ${profile.full_name} (Level ${profile.level}, ${profile.current_streak}🔥 day streak)
This week so far:
- DMs sent: ${dms} / target ${targetDM}
- Calls conducted: ${calls} / target ${targetCalls}
- Deals closed: ${closedWon} / target ${targetClosed}
- Close rate: ${closeRate}% / target ${targetCloseRate}%

Pipeline:
- New leads: ${stageCounts.new_lead || 0}
- DM sent: ${stageCounts.dm_sent || 0}
- Responded: ${stageCounts.responded || 0}
- Discovery booked: ${stageCounts.discovery_booked || 0}
- Follow-up needed: ${stageCounts.follow_up || 0}
- Closed won: ${stageCounts.closed_won || 0}

Total active leads: ${leads.filter((l: any) => !['closed_won', 'closed_lost'].includes(l.stage)).length}
`.trim();

    if (!lovableKey) {
      return new Response(JSON.stringify({
        plan: `**Plan of Action**\n\n${context}\n\nFocus on closing the biggest gap above to hit your KPIs today.`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are an elite sales coach for the NetoHub team. Be concise, energetic, and tactical. Output 3-5 numbered next-actions in markdown that this rep can do TODAY to close their KPI gaps. Reference their actual numbers. Keep total under 180 words. End with one motivational line.' },
          { role: 'user', content: context },
        ],
      }),
    });

    if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'AI rate limit. Try again shortly.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add credits in workspace settings.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return new Response(JSON.stringify({ error: 'AI error: ' + text }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ai = await aiRes.json();
    const plan = ai.choices?.[0]?.message?.content ?? 'No plan generated.';

    return new Response(JSON.stringify({ plan, stats: { dms, calls, closedWon, closeRate, targetDM, targetCalls, targetClosed, targetCloseRate } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
